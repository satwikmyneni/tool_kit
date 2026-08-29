from flask import Blueprint, current_app, jsonify, render_template, request

from app import limiter
from app.services.image_service import inspect_image, process_image as transform_image, remove_background
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


@bp.route("/tools/image-compressor", defaults={"slug": "image-compressor"})
@bp.route("/tools/image-resizer", defaults={"slug": "image-resizer"})
@bp.route("/tools/image-converter", defaults={"slug": "image-converter"})
@bp.route("/tools/image-cropper", defaults={"slug": "image-cropper"})
@bp.route("/tools/image-rotator", defaults={"slug": "image-rotator"})
@bp.route("/tools/image-flipper", defaults={"slug": "image-flipper"})
@bp.route("/tools/image-metadata", defaults={"slug": "image-metadata"})
@bp.route("/tools/image-format-optimizer", defaults={"slug": "image-format-optimizer"})
def utility_page(slug):
    return render_template("image/utility.html", **tool_page_context(slug, {"container_class": "tool-wide"}))


IMAGE_OPERATIONS = {
    "image-compressor": "compress",
    "image-resizer": "resize",
    "image-converter": "convert",
    "image-cropper": "crop",
    "image-rotator": "rotate",
    "image-flipper": "flip",
    "image-metadata": "strip",
    "image-format-optimizer": "optimize",
}


@bp.post("/tools/image-compressor/process", defaults={"slug": "image-compressor"})
@bp.post("/tools/image-resizer/process", defaults={"slug": "image-resizer"})
@bp.post("/tools/image-converter/process", defaults={"slug": "image-converter"})
@bp.post("/tools/image-cropper/process", defaults={"slug": "image-cropper"})
@bp.post("/tools/image-rotator/process", defaults={"slug": "image-rotator"})
@bp.post("/tools/image-flipper/process", defaults={"slug": "image-flipper"})
@bp.post("/tools/image-metadata/process", defaults={"slug": "image-metadata"})
@bp.post("/tools/image-format-optimizer/process", defaults={"slug": "image-format-optimizer"})
@limiter.limit(lambda: current_app.config["RATELIMIT_IMAGE"])
def process_utility(slug):
    try:
        data, mimetype, filename = transform_image(request.files.get("image"), IMAGE_OPERATIONS[slug], request.form)
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("Image utility %s failed: %s", slug, error)
        return handle_tool_error(ToolError("Something went wrong while processing the image."))
    return send_generated_file(data, filename, mimetype)


@bp.post("/tools/image-metadata/inspect")
@limiter.limit(lambda: current_app.config["RATELIMIT_IMAGE"])
def inspect():
    try:
        details = inspect_image(request.files.get("image"))
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("Image inspect failed: %s", error)
        return handle_tool_error(ToolError("Something went wrong while inspecting the image."))
    response = jsonify(details)
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response
