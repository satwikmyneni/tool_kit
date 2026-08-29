import io

from flask import current_app
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError

from app.services.file_service import read_pdf_upload
from app.utils.errors import ToolError


def merge_pdfs(file_storages):
    files = [item for item in file_storages if item and getattr(item, "filename", None)]
    if len(files) < 2:
        raise ToolError("Add at least two PDF files to merge.")
    max_files = current_app.config["MAX_PDF_FILES"]
    if len(files) > max_files:
        raise ToolError(f"You can merge up to {max_files} PDF files at a time.")

    writer = PdfWriter()
    max_bytes = current_app.config["MAX_PDF_FILE_BYTES"]
    for upload in files:
        data = read_pdf_upload(upload, max_bytes)
        try:
            reader = PdfReader(io.BytesIO(data), strict=False)
            for page in reader.pages:
                writer.add_page(page)
        except (PdfReadError, ValueError, OSError) as exc:
            current_app.logger.info("PDF merge failed: %s", exc)
            raise ToolError(
                "Something went wrong while processing your file. Please check the file and try again."
            ) from exc

    output = io.BytesIO()
    writer.write(output)
    writer.close()
    return output.getvalue()
