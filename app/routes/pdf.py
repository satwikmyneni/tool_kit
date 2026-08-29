from flask import Blueprint, current_app, render_template, request

from app import limiter
from app.services.pdf_service import merge_pdfs
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
