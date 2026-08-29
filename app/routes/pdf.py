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
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("pdf", __name__)


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
            data, filename, mimetype = rotate_pdf(upload, request.form.get("pages"), request.form.get("degrees")), "rotated-pdf.pdf", "application/pdf"
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
