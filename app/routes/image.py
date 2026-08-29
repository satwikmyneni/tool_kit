from flask import Blueprint, current_app, render_template, request

from app import limiter
from app.services.image_service import remove_background
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("image", __name__)


@bp.route("/tools/background-remover")
def page():
    return render_template("image/index.html", **tool_page_context("background-remover"))


@bp.route("/tools/background-remover/process", methods=["POST"])
@limiter.limit(lambda: current_app.config["RATELIMIT_IMAGE"])
def process_image():
    try:
        data = remove_background(request.files.get("image"))
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("Background removal failed: %s", error)
        return handle_tool_error(
            ToolError("Something went wrong while processing your file. Please check the file and try again.")
        )
    return send_generated_file(data, "background-removed.png", "image/png")
