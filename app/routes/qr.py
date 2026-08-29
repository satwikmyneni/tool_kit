from flask import Blueprint, current_app, render_template, request

from app import limiter
from app.services.qr_service import generate_qr
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("qr", __name__)


@bp.route("/tools/qr-generator")
def page():
    return render_template("qr/index.html", **tool_page_context("qr-generator"))


@bp.route("/tools/qr-generator/generate", methods=["POST"])
@limiter.limit(lambda: current_app.config["RATELIMIT_QR"])
def generate():
    try:
        data = generate_qr(
            request.form.get("text"),
            box_size=request.form.get("size"),
            border=request.form.get("margin"),
            error_correction=request.form.get("error_correction", "M"),
            fill_color=request.form.get("fill_color", "#000000"),
            back_color=request.form.get("back_color", "#ffffff"),
            max_chars=current_app.config["MAX_QR_CHARS"],
        )
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("QR generation failed: %s", error)
        return handle_tool_error(ToolError("Something went wrong while generating the QR code."))
    return send_generated_file(data, "toolbox-qr-code.png", "image/png")
