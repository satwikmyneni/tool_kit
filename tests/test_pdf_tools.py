import io
import zipfile

import pytest
from PIL import Image
from pypdf import PdfReader, PdfWriter

from app.services.pdf_service import parse_page_selection
from app.utils.errors import ToolError


def make_pdf(widths=(72, 80, 90)):
    writer = PdfWriter()
    for width in widths:
        writer.add_blank_page(width=width, height=100)
    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output


def make_image(color="red", mode="RGB"):
    output = io.BytesIO()
    Image.new(mode, (40, 30), color).save(output, format="PNG")
    output.seek(0)
    return output


def pdf_response(client, slug, fields=None, pdf=None):
    data = {"pdf": (pdf or make_pdf(), "source.pdf")}
    data.update(fields or {})
    return client.post(f"/tools/{slug}/process", data=data, content_type="multipart/form-data")


def test_page_selection_supports_ranges_reverse_and_duplicates(app):
    with app.app_context():
        assert parse_page_selection("1,3-4", 4) == [0, 2, 3]
        assert parse_page_selection("4-2", 4) == [3, 2, 1]
        assert parse_page_selection("1,1", 4, allow_duplicates=True) == [0, 0]
        with pytest.raises(ToolError):
            parse_page_selection("0,8", 4)


def test_pdf_split_selected_and_every_page_zip(client):
    selected = pdf_response(client, "pdf-splitter", {"mode": "selected", "pages": "3,1"})
    assert selected.status_code == 200
    assert [int(page.mediabox.width) for page in PdfReader(io.BytesIO(selected.data)).pages] == [90, 72]

    every = pdf_response(client, "pdf-splitter", {"mode": "every", "pages": ""})
    assert every.status_code == 200
    with zipfile.ZipFile(io.BytesIO(every.data)) as archive:
        assert archive.namelist() == ["page-1.pdf", "page-2.pdf", "page-3.pdf"]
        assert all(archive.read(name).startswith(b"%PDF") for name in archive.namelist())


def test_pdf_split_ranges_zip(client):
    response = pdf_response(client, "pdf-splitter", {"mode": "ranges", "pages": "1-2;3"})
    with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
        assert len(PdfReader(io.BytesIO(archive.read("range-1.pdf"))).pages) == 2


def test_pdf_compress_rotate_delete_extract_and_reorder(client):
    compressed = pdf_response(client, "pdf-compressor", {"level": "maximum"})
    assert compressed.status_code == 200
    assert len(PdfReader(io.BytesIO(compressed.data)).pages) == 3

    rotated = pdf_response(client, "rotate-pdf", {"pages": "2", "degrees": "90"})
    assert PdfReader(io.BytesIO(rotated.data)).pages[1].rotation == 90

    deleted = pdf_response(client, "delete-pdf-pages", {"pages": "2"})
    assert [int(page.mediabox.width) for page in PdfReader(io.BytesIO(deleted.data)).pages] == [72, 90]

    extracted = pdf_response(client, "extract-pdf-pages", {"pages": "2-3"})
    assert len(PdfReader(io.BytesIO(extracted.data)).pages) == 2

    reordered = pdf_response(client, "reorder-pdf-pages", {"pages": "3,1,3"})
    assert [int(page.mediabox.width) for page in PdfReader(io.BytesIO(reordered.data)).pages] == [90, 72, 90]


def test_delete_rejects_removing_every_page(client):
    response = pdf_response(client, "delete-pdf-pages", {"pages": "all"})
    assert response.status_code == 400
    assert "every page" in response.get_json()["error"].lower()


def test_images_to_pdf_preserves_order_and_page_options(client):
    response = client.post(
        "/tools/images-to-pdf/process",
        data={
            "images": [(make_image("red"), "red.png"), (make_image("blue"), "blue.png")],
            "page_size": "letter", "orientation": "landscape", "margin": "18", "fit": "contain",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    reader = PdfReader(io.BytesIO(response.data))
    assert len(reader.pages) == 2
    assert int(reader.pages[0].mediabox.width) == 792


def test_pdf_metadata_inspect_and_edit(client):
    inspected = client.post(
        "/tools/pdf-metadata/inspect",
        data={"pdf": (make_pdf(), "source.pdf")},
        content_type="multipart/form-data",
    )
    assert inspected.status_code == 200
    assert inspected.get_json()["page_count"] == 3

    edited = pdf_response(client, "pdf-metadata", {"title": "Toolbox title", "author": "Test author", "subject": "Subject", "creator": "Toolbox"})
    reader = PdfReader(io.BytesIO(edited.data))
    assert reader.metadata.title == "Toolbox title"
    assert reader.metadata.author == "Test author"


def test_pdf_protect_inspect_and_unlock_require_correct_password(client):
    protected = pdf_response(client, "protect-pdf", {"password": "correct horse"})
    assert protected.status_code == 200
    reader = PdfReader(io.BytesIO(protected.data))
    assert reader.is_encrypted

    inspected = client.post(
        "/tools/pdf-inspector/inspect",
        data={"pdf": (io.BytesIO(protected.data), "locked.pdf")},
        content_type="multipart/form-data",
    )
    assert inspected.get_json()["encrypted"] is True
    assert inspected.get_json()["page_count"] is None

    wrong = pdf_response(client, "unlock-pdf", {"password": "wrong"}, io.BytesIO(protected.data))
    assert wrong.status_code == 400
    unlocked = pdf_response(client, "unlock-pdf", {"password": "correct horse"}, io.BytesIO(protected.data))
    assert unlocked.status_code == 200
    assert not PdfReader(io.BytesIO(unlocked.data)).is_encrypted


def test_pdf_inspector_rejects_malformed_file(client):
    response = client.post(
        "/tools/pdf-inspector/inspect",
        data={"pdf": (io.BytesIO(b"not pdf"), "bad.pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
