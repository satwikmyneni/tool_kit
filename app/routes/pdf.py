from flask import Blueprint, current_app, jsonify, render_template, request

from app import limiter
from app.services.pdf_service import (
    compress_pdf,
    delete_pdf_pages,
    extract_pdf_pages,
    images_to_pdf,
    inspect_pdf,
    merge_pdfs,
    protect_pdf,
    reorder_pdf_pages,
    rotate_pdf,
    split_pdf,
    unlock_pdf,
    update_pdf_metadata,
)
from app.services.document_service import (
    libreoffice_available,
    office_to_pdf,
    pdf_to_docx,
    pdf_to_pptx,
    pdf_to_xlsx,
)
from app.services.pdf_preview_service import pdf_to_images, render_pdf_preview
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("pdf", __name__)


@bp.post("/api/pdf/preview")
@limiter.limit(lambda: current_app.config["RATELIMIT_PDF_PREVIEW"])
def preview():
    try:
        details = render_pdf_preview(request.files.get("pdf"), request.form.get("limit"))
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("PDF preview failed: %s", error)
        return handle_tool_error(ToolError("Something went wrong while rendering the PDF preview."))
    response = jsonify(details)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


@bp.route("/tools/pdf-merger")
def page():
    return render_template(
        "pdf/index.html",
        **tool_page_context("pdf-merger", {"container_class": "tool-wide"}),
    )


@bp.route("/tools/pdf-merger/merge", methods=["POST"])
@limiter.limit(lambda: current_app.config["RATELIMIT_PDF"])
def merge():
    try:
        data = merge_pdfs(request.files.getlist("files"))
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("PDF merge failed: %s", error)
        return handle_tool_error(
            ToolError("Something went wrong while processing your file. Please check the file and try again.")
        )
    return send_generated_file(data, "merged-pdf.pdf", "application/pdf")


PDF_UTILITY_SLUGS = {
    "pdf-splitter",
    "pdf-compressor",
    "images-to-pdf",
    "rotate-pdf",
    "delete-pdf-pages",
    "extract-pdf-pages",
    "reorder-pdf-pages",
    "pdf-metadata",
    "protect-pdf",
    "unlock-pdf",
    "pdf-inspector",
}


@bp.route("/tools/pdf-splitter", defaults={"slug": "pdf-splitter"})
@bp.route("/tools/pdf-compressor", defaults={"slug": "pdf-compressor"})
@bp.route("/tools/images-to-pdf", defaults={"slug": "images-to-pdf"})
@bp.route("/tools/rotate-pdf", defaults={"slug": "rotate-pdf"})
@bp.route("/tools/delete-pdf-pages", defaults={"slug": "delete-pdf-pages"})
@bp.route("/tools/extract-pdf-pages", defaults={"slug": "extract-pdf-pages"})
@bp.route("/tools/reorder-pdf-pages", defaults={"slug": "reorder-pdf-pages"})
@bp.route("/tools/pdf-metadata", defaults={"slug": "pdf-metadata"})
@bp.route("/tools/protect-pdf", defaults={"slug": "protect-pdf"})
@bp.route("/tools/unlock-pdf", defaults={"slug": "unlock-pdf"})
@bp.route("/tools/pdf-inspector", defaults={"slug": "pdf-inspector"})
def utility_page(slug):
    return render_template(
        "pdf/utility.html",
        **tool_page_context(slug, {"container_class": "tool-wide"}),
    )


@bp.post("/tools/pdf-splitter/process", defaults={"slug": "pdf-splitter"})
@bp.post("/tools/pdf-compressor/process", defaults={"slug": "pdf-compressor"})
@bp.post("/tools/images-to-pdf/process", defaults={"slug": "images-to-pdf"})
@bp.post("/tools/rotate-pdf/process", defaults={"slug": "rotate-pdf"})
@bp.post("/tools/delete-pdf-pages/process", defaults={"slug": "delete-pdf-pages"})
@bp.post("/tools/extract-pdf-pages/process", defaults={"slug": "extract-pdf-pages"})
@bp.post("/tools/reorder-pdf-pages/process", defaults={"slug": "reorder-pdf-pages"})
@bp.post("/tools/pdf-metadata/process", defaults={"slug": "pdf-metadata"})
@bp.post("/tools/protect-pdf/process", defaults={"slug": "protect-pdf"})
@bp.post("/tools/unlock-pdf/process", defaults={"slug": "unlock-pdf"})
@limiter.limit(lambda: current_app.config["RATELIMIT_PDF"])
def process_utility(slug):
    try:
        upload = request.files.get("pdf")
        if slug == "pdf-splitter":
            data, filename, mimetype = split_pdf(upload, request.form.get("mode"), request.form.get("pages"))
        elif slug == "pdf-compressor":
            data, filename, mimetype = compress_pdf(upload, request.form.get("level")), "compressed-pdf.pdf", "application/pdf"
        elif slug == "images-to-pdf":
            data = images_to_pdf(
                request.files.getlist("images"),
                request.form.get("page_size", "a4"),
                request.form.get("orientation", "portrait"),
                request.form.get("margin", "18"),
                request.form.get("fit", "contain"),
            )
            filename, mimetype = "images-to-pdf.pdf", "application/pdf"
        elif slug == "rotate-pdf":
            data, filename, mimetype = rotate_pdf(
                upload,
                request.form.get("pages"),
                request.form.get("degrees"),
                request.form.get("rotations"),
            ), "rotated-pdf.pdf", "application/pdf"
        elif slug == "delete-pdf-pages":
            data, filename, mimetype = delete_pdf_pages(upload, request.form.get("pages")), "pages-deleted.pdf", "application/pdf"
        elif slug == "extract-pdf-pages":
            data, filename, mimetype = extract_pdf_pages(upload, request.form.get("pages")), "extracted-pages.pdf", "application/pdf"
        elif slug == "reorder-pdf-pages":
            data, filename, mimetype = reorder_pdf_pages(upload, request.form.get("pages")), "reordered-pages.pdf", "application/pdf"
        elif slug == "pdf-metadata":
            data = update_pdf_metadata(upload, request.form, request.form.get("password") or None)
            filename, mimetype = "metadata-updated.pdf", "application/pdf"
        elif slug == "protect-pdf":
            data, filename, mimetype = protect_pdf(upload, request.form.get("password", "")), "protected-pdf.pdf", "application/pdf"
        elif slug == "unlock-pdf":
            data, filename, mimetype = unlock_pdf(upload, request.form.get("password", "")), "unlocked-pdf.pdf", "application/pdf"
        else:
            raise ToolError("That PDF action is unavailable.", status_code=404)
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("PDF utility %s failed: %s", slug, error)
        return handle_tool_error(ToolError("Something went wrong while processing the PDF."))
    return send_generated_file(data, filename, mimetype)


@bp.post("/tools/pdf-inspector/inspect", defaults={"slug": "pdf-inspector"})
@bp.post("/tools/pdf-metadata/inspect", defaults={"slug": "pdf-metadata"})
@limiter.limit(lambda: current_app.config["RATELIMIT_PDF"])
def inspect(slug):
    try:
        details = inspect_pdf(request.files.get("pdf"), request.form.get("password") or None)
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("PDF inspect failed: %s", error)
        return handle_tool_error(ToolError("Something went wrong while inspecting the PDF."))
    response = jsonify(details)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


CONVERSION_SLUGS = {
    "pdf-to-jpg", "pdf-to-png", "pdf-to-word", "pdf-to-excel", "pdf-to-powerpoint",
    "word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf", "jpg-to-pdf", "png-to-pdf",
}


@bp.get("/pdf-to-jpg", defaults={"slug": "pdf-to-jpg"})
@bp.get("/pdf-to-png", defaults={"slug": "pdf-to-png"})
@bp.get("/pdf-to-word", defaults={"slug": "pdf-to-word"})
@bp.get("/pdf-to-excel", defaults={"slug": "pdf-to-excel"})
@bp.get("/pdf-to-powerpoint", defaults={"slug": "pdf-to-powerpoint"})
@bp.get("/word-to-pdf", defaults={"slug": "word-to-pdf"})
@bp.get("/excel-to-pdf", defaults={"slug": "excel-to-pdf"})
@bp.get("/powerpoint-to-pdf", defaults={"slug": "powerpoint-to-pdf"})
@bp.get("/jpg-to-pdf", defaults={"slug": "jpg-to-pdf"})
@bp.get("/png-to-pdf", defaults={"slug": "png-to-pdf"})
def conversion_page(slug):
    return render_template(
        "pdf/conversion.html",
        office_engine_available=libreoffice_available(),
        **tool_page_context(slug, {"container_class": "tool-wide"}),
    )


@bp.post("/pdf-to-jpg/process", defaults={"slug": "pdf-to-jpg"})
@bp.post("/pdf-to-png/process", defaults={"slug": "pdf-to-png"})
@bp.post("/pdf-to-word/process", defaults={"slug": "pdf-to-word"})
@bp.post("/pdf-to-excel/process", defaults={"slug": "pdf-to-excel"})
@bp.post("/pdf-to-powerpoint/process", defaults={"slug": "pdf-to-powerpoint"})
@bp.post("/word-to-pdf/process", defaults={"slug": "word-to-pdf"})
@bp.post("/excel-to-pdf/process", defaults={"slug": "excel-to-pdf"})
@bp.post("/powerpoint-to-pdf/process", defaults={"slug": "powerpoint-to-pdf"})
@bp.post("/jpg-to-pdf/process", defaults={"slug": "jpg-to-pdf"})
@bp.post("/png-to-pdf/process", defaults={"slug": "png-to-pdf"})
@limiter.limit(lambda: current_app.config["RATELIMIT_PDF"])
def process_conversion(slug):
    try:
        if slug in {"pdf-to-jpg", "pdf-to-png"}:
            data, filename, mimetype = pdf_to_images(
                request.files.get("pdf"),
                "jpg" if slug == "pdf-to-jpg" else "png",
                request.form.get("pages", "all"),
                request.form.get("dpi", "120"),
                request.form.get("quality", "88"),
            )
        elif slug == "pdf-to-word":
            data, filename, mimetype = pdf_to_docx(request.files.get("pdf")), "converted-document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif slug == "pdf-to-excel":
            data, filename, mimetype = pdf_to_xlsx(request.files.get("pdf")), "extracted-tables.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif slug == "pdf-to-powerpoint":
            data, filename, mimetype = pdf_to_pptx(request.files.get("pdf")), "pdf-pages.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        elif slug in {"word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"}:
            data, filename, mimetype = office_to_pdf(request.files.get("document"), slug), "converted-document.pdf", "application/pdf"
        elif slug in {"jpg-to-pdf", "png-to-pdf"}:
            images = request.files.getlist("images")
            expected = {".jpg", ".jpeg"} if slug == "jpg-to-pdf" else {".png"}
            if any(not upload.filename.lower().endswith(tuple(expected)) for upload in images if upload.filename):
                raise ToolError(f"Choose only {'JPG' if slug == 'jpg-to-pdf' else 'PNG'} images for this tool.")
            data = images_to_pdf(
                images,
                request.form.get("page_size", "a4"),
                request.form.get("orientation", "portrait"),
                request.form.get("margin", "18"),
                request.form.get("fit", "contain"),
            )
            filename, mimetype = f"{slug}.pdf", "application/pdf"
        else:
            raise ToolError("That conversion is unavailable.", status_code=404)
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("Document conversion %s failed: %s", slug, error)
        return handle_tool_error(ToolError("Something went wrong while converting the document."))
    return send_generated_file(data, filename, mimetype)
