import io
import os
import secrets
import shutil
import zipfile
from contextlib import contextmanager
from pathlib import Path

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.utils.errors import ToolError

PDF_MAGIC = b"%PDF"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"
WEBP_RIFF = b"RIFF"
WEBP_WEBP = b"WEBP"

IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}
PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
PDF_MIMETYPES = {"application/pdf", "application/x-pdf"}
IMAGE_MIMETYPES = {"image/png", "image/jpeg", "image/webp"}
OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
DOCUMENT_TYPES = {
    ".docx": ({"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"}, "word/"),
    ".xlsx": ({"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"}, "xl/"),
    ".pptx": ({"application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"}, "ppt/"),
    ".doc": ({"application/msword", "application/x-ole-storage"}, None),
    ".xls": ({"application/vnd.ms-excel", "application/x-ole-storage"}, None),
    ".ppt": ({"application/vnd.ms-powerpoint", "application/x-ole-storage"}, None),
}


def temp_root():
    root = Path(current_app.instance_path) / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


@contextmanager
def temporary_workspace():
    folder = temp_root() / secrets.token_hex(16)
    folder.mkdir(parents=True, exist_ok=True)
    try:
        yield folder
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def generated_name(suffix):
    suffix = suffix if suffix.startswith(".") else f".{suffix}"
    return f"{secrets.token_hex(16)}{suffix}"


def read_upload(file_storage, max_bytes, empty_message="Please choose a file."):
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ToolError(empty_message)
    stream = file_storage.stream
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(0)
    if size == 0:
        raise ToolError("That file is empty.")
    if size > max_bytes:
        raise ToolError("That file is too large. Please choose a smaller file.")
    data = file_storage.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ToolError("That file is too large. Please choose a smaller file.")
    return data


def validate_upload_metadata(file_storage, extensions, mimetypes, type_message):
    filename = getattr(file_storage, "filename", "") or ""
    if Path(filename).suffix.lower() not in extensions:
        raise ToolError(type_message)
    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype != "application/octet-stream" and mimetype not in mimetypes:
        raise ToolError(type_message)


def read_pdf_upload(file_storage, max_bytes, allow_encrypted=False):
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ToolError("Please choose a PDF file.")
    validate_upload_metadata(
        file_storage,
        PDF_EXTENSIONS,
        PDF_MIMETYPES,
        "Please upload a PDF file with a .pdf extension.",
    )
    data = read_upload(file_storage, max_bytes)
    return validate_pdf_bytes(data, allow_encrypted=allow_encrypted)


def read_image_upload(file_storage, max_bytes):
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ToolError("Please choose an image file.")
    validate_upload_metadata(
        file_storage,
        IMAGE_EXTENSIONS,
        IMAGE_MIMETYPES,
        "Please upload a PNG, JPEG, or WEBP image.",
    )
    return read_upload(file_storage, max_bytes)


def read_document_upload(file_storage, max_bytes, allowed_extensions):
    """Validate Office content without trusting the filename alone."""
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ToolError("Please choose a document file.")
    suffix = Path(file_storage.filename).suffix.lower()
    allowed = set(allowed_extensions)
    if suffix not in allowed or suffix not in DOCUMENT_TYPES:
        expected = ", ".join(sorted(allowed))
        raise ToolError(f"Please upload one of these document types: {expected}.")
    mimetypes, marker = DOCUMENT_TYPES[suffix]
    mimetype = (getattr(file_storage, "mimetype", "") or "").lower()
    if mimetype and mimetype != "application/octet-stream" and mimetype not in mimetypes:
        raise ToolError("The uploaded file type does not match its extension.")
    data = read_upload(file_storage, max_bytes)
    if marker:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                members = archive.infolist()
                names = {item.filename.replace("\\", "/") for item in members}
                expanded = sum(item.file_size for item in members)
                if len(members) > 5000 or expanded > max_bytes * 20:
                    raise ToolError("That Office document expands beyond the safe processing limit.")
                if "[Content_Types].xml" not in names or not any(name.startswith(marker) for name in names):
                    raise ToolError("That file is not a valid Office document of the selected type.")
        except ToolError:
            raise
        except (zipfile.BadZipFile, OSError, ValueError) as exc:
            raise ToolError("That Office document could not be validated.") from exc
    elif not data.startswith(OLE_MAGIC):
        raise ToolError("That legacy Office document could not be validated.")
    return data, suffix


def looks_like_pdf(data):
    return data.startswith(PDF_MAGIC)


def looks_like_image(data):
    if data.startswith(PNG_MAGIC) or data.startswith(JPEG_MAGIC):
        return True
    return len(data) >= 12 and data.startswith(WEBP_RIFF) and data[8:12] == WEBP_WEBP


def validate_pdf_bytes(data, allow_encrypted=False):
    if not looks_like_pdf(data):
        raise ToolError("Please upload a valid PDF file.")
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted and not allow_encrypted:
            raise ToolError("Encrypted PDFs cannot be merged. Remove the password and try again.")
        if reader.is_encrypted:
            return data
        page_count = len(reader.pages)
        if page_count < 1:
            raise ToolError("That PDF has no pages.")
        if page_count > current_app.config["MAX_PDF_PAGES"]:
            raise ToolError(f"That PDF has more than {current_app.config['MAX_PDF_PAGES']} pages.")
    except ToolError:
        raise
    except (PdfReadError, ValueError, OSError) as exc:
        current_app.logger.info("Rejected PDF: %s", exc)
        raise ToolError("That PDF could not be read. Please check the file and try again.") from exc
    return data


def open_image(data):
    if not looks_like_image(data):
        raise ToolError("Please upload a PNG, JPEG, or WEBP image.")
    max_pixels = current_app.config["MAX_IMAGE_PIXELS"]
    Image.MAX_IMAGE_PIXELS = max_pixels
    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in IMAGE_FORMATS:
            raise ToolError("Please upload a PNG, JPEG, or WEBP image.")
        width, height = image.size
        max_edge = current_app.config["MAX_IMAGE_EDGE"]
        if width > max_edge or height > max_edge or width * height > max_pixels:
            raise ToolError("That image is too large to process safely.")
        image.load()
    except Image.DecompressionBombError as exc:
        raise ToolError("That image is too large to process safely.") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        current_app.logger.info("Rejected image: %s", exc)
        raise ToolError("That image could not be read. Please check the file and try again.") from exc
    image = ImageOps.exif_transpose(image)
    return image


def image_to_png_bytes(image):
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
