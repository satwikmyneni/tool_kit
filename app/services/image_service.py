import io
import threading

from flask import current_app
from PIL import Image, UnidentifiedImageError

from app.services.file_service import image_to_png_bytes, open_image, read_image_upload
from app.utils.errors import ToolError

_lock = threading.Lock()
_session = None


def _load_session():
    global _session
    if _session is not None:
        return _session
    with _lock:
        if _session is not None:
            return _session
        try:
            from rembg import new_session
        except ImportError as exc:
            raise ToolError(
                "Background removal is not installed on this server. See the README for setup.",
                status_code=503,
            ) from exc
        model = current_app.config.get("REMBG_MODEL", "u2netp")
        try:
            _session = new_session(model)
        except Exception as exc:
            current_app.logger.exception("Failed to initialize rembg model")
            raise ToolError(
                "Background removal could not start. The model may still need to be downloaded. See the README.",
                status_code=503,
            ) from exc
        return _session


def remove_background(file_storage, remover=None):
    data = read_image_upload(file_storage, current_app.config["MAX_IMAGE_BYTES"])
    image = open_image(data)
    png_input = image_to_png_bytes(image.convert("RGBA"))

    if remover is not None:
        try:
            result = remover(png_input)
        except Exception as exc:
            current_app.logger.exception("Background removal failed")
            raise ToolError("That image could not be processed.") from exc
    else:
        session = _load_session()
        try:
            from rembg import remove
        except ImportError as exc:
            raise ToolError(
                "Background removal is not installed on this server. See the README for setup.",
                status_code=503,
            ) from exc
        try:
            result = remove(png_input, session=session)
        except Exception as exc:
            current_app.logger.exception("Background removal failed")
            raise ToolError(
                "Something went wrong while processing your file. Please check the file and try again."
            ) from exc

    return _validated_transparent_png(result)


def _validated_transparent_png(result):
    try:
        if isinstance(result, Image.Image):
            image = result
        elif isinstance(result, (bytes, bytearray)):
            image = Image.open(io.BytesIO(result))
            image.load()
        else:
            raise ToolError("That image could not be processed.")
        rgba = image.convert("RGBA")
        alpha_min, _alpha_max = rgba.getchannel("A").getextrema()
        if alpha_min == 255:
            raise ToolError(
                "No removable background was detected. Try an image with a clearer subject."
            )
        return image_to_png_bytes(rgba)
    except ToolError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        current_app.logger.info("Background remover returned an invalid image: %s", exc)
        raise ToolError("That image could not be processed.") from exc
