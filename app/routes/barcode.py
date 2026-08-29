from flask import Blueprint, current_app, render_template, request

from app import limiter
from app.services.barcode_service import generate_barcode
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("barcode", __name__)


@bp.route("/tools/barcode-generator")
def page():
    return render_template("barcode/index.html", **tool_page_context("barcode-generator"))


@bp.route("/tools/barcode-generator/generate", methods=["POST"])
@limiter.limit(lambda: current_app.config["RATELIMIT_BARCODE"])
def generate():
    try:
        data = generate_barcode(
            request.form.get("text"),
            max_chars=current_app.config["MAX_BARCODE_CHARS"],
        )
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("Barcode generation failed: %s", error)
        return handle_tool_error(ToolError("Something went wrong while generating the barcode."))
    return send_generated_file(data, "toolbox-barcode.png", "image/png")
