from flask import Blueprint, current_app, render_template, request

from app import limiter
from app.services.gif_service import create_gif
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("gif", __name__)


@bp.route("/tools/gif-maker")
def page():
    return render_template(
        "gif/index.html",
        **tool_page_context("gif-maker", {"container_class": "tool-wide"}),
    )


@bp.route("/tools/gif-maker/create", methods=["POST"])
@limiter.limit(lambda: current_app.config["RATELIMIT_GIF"])
def create():
    loop = request.form.get("loop", "1") != "0"
    try:
        data = create_gif(
            request.files.getlist("files"),
            duration_ms=request.form.get("duration"),
            loop=loop,
            width=request.form.get("width"),
            height=request.form.get("height"),
        )
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("GIF creation failed: %s", error)
        return handle_tool_error(
            ToolError("Something went wrong while processing your file. Please check the file and try again.")
        )
    return send_generated_file(data, "toolbox-animation.gif", "image/gif")
