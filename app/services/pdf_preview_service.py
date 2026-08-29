"""Bounded PDF rendering shared by preview and conversion tools."""

import base64
import io
import zipfile

import pymupdf
from flask import current_app

from app.services.file_service import read_pdf_upload
from app.utils.errors import ToolError


def open_pdf_document(upload):
    """Validate an upload and return an opened PyMuPDF document plus its bytes."""
    data = read_pdf_upload(upload, current_app.config["MAX_PDF_FILE_BYTES"])
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
        if document.needs_pass:
            document.close()
            raise ToolError("This PDF is password protected. Unlock it before using this tool.")
        page_count = document.page_count
        if page_count < 1:
            document.close()
            raise ToolError("That PDF has no pages.")
        if page_count > current_app.config["MAX_PDF_PAGES"]:
            document.close()
            raise ToolError(f"That PDF has more than {current_app.config['MAX_PDF_PAGES']} pages.")
        return document, data
    except ToolError:
        raise
    except (RuntimeError, ValueError) as exc:
        current_app.logger.info("PyMuPDF rejected a PDF: %s", exc)
        raise ToolError("That PDF could not be rendered. Please check the file and try again.") from exc


def _bounded_scale(page, dpi, max_width=None, max_height=None):
    rect = page.rect
    if rect.width <= 0 or rect.height <= 0:
        raise ToolError("A PDF page has invalid dimensions.")
    scale = max(0.1, min(float(dpi), 200.0) / 72.0)
    if max_width:
        scale = min(scale, max_width / rect.width)
    if max_height:
        scale = min(scale, max_height / rect.height)
    max_pixels = current_app.config["MAX_IMAGE_PIXELS"]
    pixels = rect.width * scale * rect.height * scale
    if pixels > max_pixels:
        scale *= (max_pixels / pixels) ** 0.5
    return max(scale, 0.02)


def render_page_png(page, dpi=120, *, max_width=None, max_height=None):
    scale = _bounded_scale(page, dpi, max_width, max_height)
    try:
        pixmap = page.get_pixmap(
            matrix=pymupdf.Matrix(scale, scale),
            colorspace=pymupdf.csRGB,
            alpha=False,
        )
        return pixmap.tobytes("png"), pixmap.width, pixmap.height
    except (RuntimeError, MemoryError, ValueError) as exc:
        raise ToolError("A PDF page could not be rendered safely.") from exc


def render_pdf_preview(upload, requested_limit=None):
    document, _data = open_pdf_document(upload)
    try:
        configured_limit = current_app.config["PDF_PREVIEW_MAX_PAGES"]
        try:
            requested = int(requested_limit) if requested_limit else configured_limit
        except (TypeError, ValueError):
            requested = configured_limit
        limit = min(max(1, requested), configured_limit, document.page_count)
        dpi = current_app.config["PDF_PREVIEW_DPI"]
        max_width = current_app.config["PDF_PREVIEW_MAX_WIDTH"]
        max_height = current_app.config["PDF_PREVIEW_MAX_HEIGHT"]
        pages = []
        for index in range(limit):
            page = document.load_page(index)
            image, width, height = render_page_png(
                page, dpi, max_width=max_width, max_height=max_height
            )
            pages.append(
                {
                    "number": index + 1,
                    "width": width,
                    "height": height,
                    "data_url": "data:image/png;base64," + base64.b64encode(image).decode("ascii"),
                }
            )
        return {
            "page_count": document.page_count,
            "rendered_count": limit,
            "truncated": limit < document.page_count,
            "pages": pages,
        }
    finally:
        document.close()


def pdf_to_images(upload, image_format, page_expression="all", dpi=120, quality=88):
    image_format = (image_format or "").lower()
    if image_format not in {"jpg", "png"}:
        raise ToolError("Choose PNG or JPG output.")
    try:
        dpi = int(dpi)
        quality = int(quality)
    except (TypeError, ValueError) as exc:
        raise ToolError("Choose valid image settings.") from exc
    if dpi not in {72, 96, 120, 150}:
        raise ToolError("Choose a supported image resolution.")
    if quality < 40 or quality > 95:
        raise ToolError("JPG quality must be between 40 and 95.")

    from app.services.pdf_service import parse_page_selection

    document, _data = open_pdf_document(upload)
    try:
        indices = parse_page_selection(page_expression, document.page_count)
        max_pages = current_app.config["MAX_CONVERSION_PAGES"]
        if len(indices) > max_pages:
            raise ToolError(f"Convert no more than {max_pages} pages at a time.")
        total_pixels = 0
        rendered = []
        for index in indices:
            page = document.load_page(index)
            png, width, height = render_page_png(page, dpi)
            total_pixels += width * height
            if total_pixels > current_app.config["MAX_CONVERSION_TOTAL_PIXELS"]:
                raise ToolError("Those pages are too large to convert safely at this resolution.")
            if image_format == "jpg":
                from PIL import Image

                source = Image.open(io.BytesIO(png)).convert("RGB")
                output = io.BytesIO()
                source.save(output, format="JPEG", quality=quality, optimize=True)
                image = output.getvalue()
            else:
                image = png
            rendered.append((index + 1, image))

        mimetype = "image/jpeg" if image_format == "jpg" else "image/png"
        extension = "jpg" if image_format == "jpg" else "png"
        if len(rendered) == 1:
            number, image = rendered[0]
            return image, f"pdf-page-{number}.{extension}", mimetype
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for number, image in rendered:
                archive.writestr(f"page-{number}.{extension}", image)
        return output.getvalue(), f"pdf-pages-{extension}.zip", "application/zip"
    finally:
        document.close()
