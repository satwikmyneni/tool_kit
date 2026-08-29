"""Tests for PDF Merger."""

import io
import pytest
from pypdf import PdfWriter


def _make_pdf(num_pages=1, width=72, height=72):
    """Create a minimal valid PDF in memory."""
    writer = PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=width, height=height)
    buf = io.BytesIO()
    writer.write(buf)
    buf.seek(0)
    return buf


def test_pdf_page_loads(client):
    response = client.get("/tools/pdf-merger")
    assert response.status_code == 200
    assert b"PDF Merger" in response.data


def test_pdf_merge_two_valid_files(client):
    pdf1 = _make_pdf(1)
    pdf2 = _make_pdf(2)
    response = client.post(
        "/tools/pdf-merger/merge",
        data={
            "files": [
                (pdf1, "doc1.pdf"),
                (pdf2, "doc2.pdf"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert response.content_type == "application/pdf"
    # Verify it starts with %PDF
    assert response.data[:4] == b"%PDF"


def test_pdf_merge_one_file_rejected(client):
    pdf1 = _make_pdf(1)
    response = client.post(
        "/tools/pdf-merger/merge",
        data={"files": [(pdf1, "doc1.pdf")]},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_pdf_merge_invalid_file(client):
    fake = io.BytesIO(b"this is not a pdf")
    response = client.post(
        "/tools/pdf-merger/merge",
        data={
            "files": [
                (fake, "bad.pdf"),
                (_make_pdf(1), "good.pdf"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_pdf_merge_order_preserved(client):
    """Merging a 1-page and a 2-page PDF should produce 3 pages."""
    from pypdf import PdfReader

    pdf1 = _make_pdf(1)
    pdf2 = _make_pdf(2)
    response = client.post(
        "/tools/pdf-merger/merge",
        data={
            "files": [
                (pdf1, "one.pdf"),
                (pdf2, "two.pdf"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    reader = PdfReader(io.BytesIO(response.data))
    assert len(reader.pages) == 3


def test_pdf_merge_preserves_exact_page_order(client):
    from pypdf import PdfReader

    response = client.post(
        "/tools/pdf-merger/merge",
        data={"files": [(_make_pdf(width=100), "first.pdf"), (_make_pdf(width=200), "second.pdf")]},
        content_type="multipart/form-data",
    )
    reader = PdfReader(io.BytesIO(response.data))
    assert [int(page.mediabox.width) for page in reader.pages] == [100, 200]


def test_pdf_rejects_wrong_extension_even_with_pdf_content(client):
    response = client.post(
        "/tools/pdf-merger/merge",
        data={"files": [(_make_pdf(), "first.txt"), (_make_pdf(), "second.pdf")]},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_pdf_file_count_limit(client, app):
    app.config["MAX_PDF_FILES"] = 2
    response = client.post(
        "/tools/pdf-merger/merge",
        data={"files": [(_make_pdf(), f"{index}.pdf") for index in range(3)]},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_pdf_individual_file_size_limit(client, app):
    app.config["MAX_PDF_FILE_BYTES"] = 100
    response = client.post(
        "/tools/pdf-merger/merge",
        data={"files": [(_make_pdf(), "large.pdf"), (_make_pdf(), "other.pdf")]},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "too large" in response.get_json()["error"].lower()
