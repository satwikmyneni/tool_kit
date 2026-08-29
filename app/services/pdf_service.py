"""Bounded in-memory PDF processing built on pypdf and Pillow."""

import io
import json
import re
import zipfile

from flask import current_app
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.errors import FileNotDecryptedError, PdfReadError, WrongPasswordError

from app.services.file_service import open_image, read_image_upload, read_pdf_upload
from app.utils.errors import ToolError


def _uploads(items):
    return [item for item in items if item and getattr(item, "filename", None)]


def _reader(upload, *, allow_encrypted=False, password=None):
    data = read_pdf_upload(upload, current_app.config["MAX_PDF_FILE_BYTES"], allow_encrypted=allow_encrypted)
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            if password is None:
                if allow_encrypted:
                    return reader, data
                raise ToolError("This PDF is password protected.")
            if not password or reader.decrypt(password) == 0:
                raise ToolError("The PDF password is incorrect.")
        page_count = len(reader.pages)
        if page_count < 1:
            raise ToolError("That PDF has no pages.")
        if page_count > current_app.config["MAX_PDF_PAGES"]:
            raise ToolError(f"That PDF has more than {current_app.config['MAX_PDF_PAGES']} pages.")
        return reader, data
    except ToolError:
        raise
    except (FileNotDecryptedError, WrongPasswordError) as exc:
        raise ToolError("The PDF password is incorrect.") from exc
    except (PdfReadError, ValueError, OSError) as exc:
        current_app.logger.info("Rejected PDF: %s", exc)
        raise ToolError("That PDF could not be read. Please check the file and try again.") from exc


def _write(writer):
    output = io.BytesIO()
    try:
        writer.write(output)
        return output.getvalue()
    finally:
        writer.close()


def _copy_metadata(reader, writer):
    metadata = reader.metadata
    if metadata:
        safe = {str(key): str(value) for key, value in metadata.items() if key and value is not None}
        if safe:
            writer.add_metadata(safe)


def merge_pdfs(file_storages):
    files = _uploads(file_storages)
    if len(files) < 2:
        raise ToolError("Add at least two PDF files to merge.")
    max_files = current_app.config["MAX_PDF_FILES"]
    if len(files) > max_files:
        raise ToolError(f"You can merge up to {max_files} PDF files at a time.")
    writer = PdfWriter()
    for upload in files:
        reader, _data = _reader(upload)
        for page in reader.pages:
            writer.add_page(page)
    return _write(writer)


def parse_page_selection(expression, page_count, *, allow_duplicates=False):
    value = (expression or "all").strip().lower()
    if value in {"", "all", "*"}:
        return list(range(page_count))
    if len(value) > 4000:
        raise ToolError("The page selection is too long.")
    selected = []
    for token in value.split(","):
        token = token.strip()
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", token)
        if not match:
            raise ToolError("Use page numbers like 1,3-5,8.")
        start = int(match.group(1))
        end = int(match.group(2) or start)
        if start < 1 or end < 1 or start > page_count or end > page_count:
            raise ToolError(f"Page numbers must be between 1 and {page_count}.")
        step = 1 if end >= start else -1
        for number in range(start, end + step, step):
            index = number - 1
            if allow_duplicates or index not in selected:
                selected.append(index)
    if not selected:
        raise ToolError("Select at least one page.")
    return selected


def _selected_pdf(reader, indices):
    writer = PdfWriter()
    _copy_metadata(reader, writer)
    for index in indices:
        writer.add_page(reader.pages[index])
    return _write(writer)


def split_pdf(upload, mode, pages):
    reader, _data = _reader(upload)
    page_count = len(reader.pages)
    if mode == "selected":
        indices = parse_page_selection(pages, page_count)
        return _selected_pdf(reader, indices), "extracted-pages.pdf", "application/pdf"
    if mode not in {"every", "ranges"}:
        raise ToolError("Choose a valid split mode.")
    groups = []
    if mode == "every":
        groups = [([index], f"page-{index + 1}.pdf") for index in range(page_count)]
    else:
        expressions = [item.strip() for item in (pages or "").split(";") if item.strip()]
        if not expressions:
            raise ToolError("Enter ranges separated by semicolons, such as 1-3;4-6.")
        if len(expressions) > 100:
            raise ToolError("Use no more than 100 page ranges.")
        groups = [(parse_page_selection(item, page_count), f"range-{index + 1}.pdf") for index, item in enumerate(expressions)]
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for indices, filename in groups:
            archive.writestr(filename, _selected_pdf(reader, indices))
    return output.getvalue(), "split-pdf-pages.zip", "application/zip"


def compress_pdf(upload, level="balanced"):
    reader, _data = _reader(upload)
    writer = PdfWriter()
    _copy_metadata(reader, writer)
    compression_level = {"light": 1, "balanced": 6, "maximum": 9}.get(level)
    if compression_level is None:
        raise ToolError("Choose a valid compression level.")
    for source_page in reader.pages:
        writer.add_page(source_page)
        try:
            writer.pages[-1].compress_content_streams(level=compression_level)
        except (AttributeError, ValueError):
            pass
    try:
        writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    except (AttributeError, ValueError):
        pass
    return _write(writer)


def images_to_pdf(file_storages, page_size="a4", orientation="portrait", margin=18, fit="contain"):
    files = _uploads(file_storages)
    max_files = current_app.config["MAX_IMAGE_FILES"]
    if not files:
        raise ToolError("Add at least one image.")
    if len(files) > max_files:
        raise ToolError(f"You can add up to {max_files} images at a time.")
    if page_size not in {"a4", "letter", "auto"} or orientation not in {"portrait", "landscape"} or fit not in {"contain", "cover"}:
        raise ToolError("Choose valid page options.")
    try:
        margin = int(margin)
    except (TypeError, ValueError) as exc:
        raise ToolError("Choose a valid page margin.") from exc
    if margin < 0 or margin > 144:
        raise ToolError("Margin must be between 0 and 144 points.")
    pages = []
    for upload in files:
        data = read_image_upload(upload, current_app.config["MAX_IMAGE_BYTES"])
        source = open_image(data).convert("RGBA")
        if page_size == "auto":
            width, height = source.size
            width = min(width, 2000)
            height = min(height, 2000)
        else:
            width, height = (595, 842) if page_size == "a4" else (612, 792)
        if orientation == "landscape" and height > width:
            width, height = height, width
        if orientation == "portrait" and width > height:
            width, height = height, width
        available = (max(1, width - margin * 2), max(1, height - margin * 2))
        if fit == "contain":
            source.thumbnail(available, Image.Resampling.LANCZOS)
        else:
            scale = max(available[0] / source.width, available[1] / source.height)
            source = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.LANCZOS)
            left = max(0, (source.width - available[0]) // 2)
            top = max(0, (source.height - available[1]) // 2)
            source = source.crop((left, top, left + available[0], top + available[1]))
        canvas = Image.new("RGB", (width, height), "white")
        if source.mode == "RGBA":
            position = ((width - source.width) // 2, (height - source.height) // 2)
            canvas.paste(source.convert("RGB"), position, source.getchannel("A"))
        else:
            canvas.paste(source, ((width - source.width) // 2, (height - source.height) // 2))
        pages.append(canvas)
    output = io.BytesIO()
    pages[0].save(output, format="PDF", save_all=True, append_images=pages[1:], resolution=72.0)
    return output.getvalue()


def rotate_pdf(upload, pages, degrees, rotations=None):
    reader, _data = _reader(upload)
    if rotations:
        try:
            values = json.loads(rotations)
            if not isinstance(values, dict) or len(values) > len(reader.pages):
                raise ValueError
            rotation_map = {}
            for page_number, amount in values.items():
                index = int(page_number) - 1
                angle = int(amount) % 360
                if index < 0 or index >= len(reader.pages) or angle not in {0, 90, 180, 270}:
                    raise ValueError
                if angle:
                    rotation_map[index] = angle
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ToolError("The per-page rotation selection is invalid.") from exc
        if not rotation_map:
            raise ToolError("Rotate at least one page before processing.")
        writer = PdfWriter()
        _copy_metadata(reader, writer)
        for index, page in enumerate(reader.pages):
            writer.add_page(page)
            if index in rotation_map:
                writer.pages[-1].rotate(rotation_map[index])
        return _write(writer)
    try:
        degrees = int(degrees)
    except (TypeError, ValueError) as exc:
        raise ToolError("Choose a valid rotation.") from exc
    if degrees not in {90, 180, 270}:
        raise ToolError("Rotation must be 90, 180, or 270 degrees.")
    indices = set(parse_page_selection(pages, len(reader.pages)))
    writer = PdfWriter()
    _copy_metadata(reader, writer)
    for index, page in enumerate(reader.pages):
        writer.add_page(page)
        if index in indices:
            writer.pages[-1].rotate(degrees)
    return _write(writer)


def delete_pdf_pages(upload, pages):
    reader, _data = _reader(upload)
    removed = set(parse_page_selection(pages, len(reader.pages)))
    kept = [index for index in range(len(reader.pages)) if index not in removed]
    if not kept:
        raise ToolError("You cannot delete every page from the PDF.")
    return _selected_pdf(reader, kept)


def extract_pdf_pages(upload, pages):
    reader, _data = _reader(upload)
    return _selected_pdf(reader, parse_page_selection(pages, len(reader.pages)))


def reorder_pdf_pages(upload, pages):
    reader, _data = _reader(upload)
    indices = parse_page_selection(pages, len(reader.pages), allow_duplicates=True)
    if len(indices) > current_app.config["MAX_PDF_PAGES"]:
        raise ToolError("The requested output has too many pages.")
    return _selected_pdf(reader, indices)


def _metadata_dict(reader, byte_count):
    metadata = reader.metadata or {}
    fields = {
        "title": metadata.get("/Title", ""),
        "author": metadata.get("/Author", ""),
        "subject": metadata.get("/Subject", ""),
        "creator": metadata.get("/Creator", ""),
        "producer": metadata.get("/Producer", ""),
        "creation_date": metadata.get("/CreationDate", ""),
        "modification_date": metadata.get("/ModDate", ""),
    }
    return {key: str(value or "")[:1000] for key, value in fields.items()} | {
        "page_count": len(reader.pages),
        "file_size": byte_count,
        "encrypted": bool(reader.is_encrypted),
        "valid": True,
    }


def inspect_pdf(upload, password=None):
    reader, data = _reader(upload, allow_encrypted=True, password=password if password else None)
    if reader.is_encrypted and not password:
        return {"page_count": None, "file_size": len(data), "encrypted": True, "valid": True,
                "title": "", "author": "", "subject": "", "creator": "", "producer": "",
                "creation_date": "", "modification_date": ""}
    return _metadata_dict(reader, len(data))


def update_pdf_metadata(upload, fields, password=None):
    reader, _data = _reader(upload, allow_encrypted=True, password=password)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    mapping = {
        "/Title": fields.get("title", ""),
        "/Author": fields.get("author", ""),
        "/Subject": fields.get("subject", ""),
        "/Creator": fields.get("creator", "Toolbox"),
    }
    writer.add_metadata({key: str(value)[:1000] for key, value in mapping.items()})
    return _write(writer)


def protect_pdf(upload, password):
    if not password or len(password) < 4 or len(password) > 128:
        raise ToolError("Use a password between 4 and 128 characters.")
    reader, _data = _reader(upload)
    writer = PdfWriter()
    _copy_metadata(reader, writer)
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password, algorithm="AES-256")
    return _write(writer)


def unlock_pdf(upload, password):
    if not password:
        raise ToolError("Enter the PDF password.")
    reader, _data = _reader(upload, allow_encrypted=True, password=password)
    if not reader.is_encrypted:
        raise ToolError("That PDF is not password protected.")
    writer = PdfWriter()
    _copy_metadata(reader, writer)
    for page in reader.pages:
        writer.add_page(page)
    return _write(writer)
