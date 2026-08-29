import io
import threading

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError

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


OUTPUT_FORMATS = {
    "png": ("PNG", "image/png", ".png"),
    "jpeg": ("JPEG", "image/jpeg", ".jpg"),
    "webp": ("WEBP", "image/webp", ".webp"),
}


def _number(value, label, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ToolError(f"Enter a valid {label}.") from exc
    if number < minimum or number > maximum:
        raise ToolError(f"{label.capitalize()} must be between {minimum} and {maximum}.")
    return number


def _has_transparency(image):
    if image.mode in {"RGBA", "LA"}:
        return image.getchannel("A").getextrema()[0] < 255
    return image.mode == "P" and "transparency" in image.info


def _encode(image, target, quality=85, *, strip_metadata=True):
    target = (target or "png").lower()
    if target == "jpg":
        target = "jpeg"
    if target not in OUTPUT_FORMATS:
        raise ToolError("Choose PNG, JPEG, or WEBP output.")
    quality = _number(quality, "quality", 1, 100)
    output = io.BytesIO()
    format_name, mimetype, suffix = OUTPUT_FORMATS[target]
    if format_name == "JPEG":
        rgba = image.convert("RGBA")
        flattened = Image.new("RGB", rgba.size, "white")
        flattened.paste(rgba.convert("RGB"), mask=rgba.getchannel("A"))
        flattened.save(output, format="JPEG", quality=quality, optimize=True, progressive=True)
    elif format_name == "WEBP":
        image.convert("RGBA" if _has_transparency(image) else "RGB").save(
            output, format="WEBP", quality=quality, method=6
        )
    else:
        image.convert("RGBA" if _has_transparency(image) else "RGB").save(
            output, format="PNG", optimize=True, compress_level=9
        )
    return output.getvalue(), mimetype, suffix


def process_image(file_storage, operation, options):
    data = read_image_upload(file_storage, current_app.config["MAX_IMAGE_BYTES"])
    image = open_image(data)
    source_format = (image.format or "PNG").lower().replace("jpg", "jpeg")
    quality = options.get("quality", "85")
    target = options.get("format") or source_format

    if operation == "compress":
        pass
    elif operation == "resize":
        width_raw = options.get("width")
        height_raw = options.get("height")
        width = _number(width_raw, "width", 1, current_app.config["MAX_IMAGE_EDGE"]) if width_raw else None
        height = _number(height_raw, "height", 1, current_app.config["MAX_IMAGE_EDGE"]) if height_raw else None
        if not width and not height:
            raise ToolError("Enter a width or height.")
        keep_aspect = options.get("keep_aspect", "true") == "true"
        allow_upscale = options.get("allow_upscale") == "true"
        if keep_aspect:
            scale = min(width / image.width if width else float("inf"), height / image.height if height else float("inf"))
            if not allow_upscale:
                scale = min(1, scale)
            width = max(1, round(image.width * scale))
            height = max(1, round(image.height * scale))
        else:
            width = width or image.width
            height = height or image.height
            if not allow_upscale:
                width = min(width, image.width)
                height = min(height, image.height)
        if width * height > current_app.config["MAX_IMAGE_PIXELS"]:
            raise ToolError("The requested dimensions are too large.")
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    elif operation == "convert":
        pass
    elif operation == "crop":
        x = _number(options.get("x", 0), "left position", 0, image.width - 1)
        y = _number(options.get("y", 0), "top position", 0, image.height - 1)
        width = _number(options.get("width"), "crop width", 1, image.width)
        height = _number(options.get("height"), "crop height", 1, image.height)
        if x + width > image.width or y + height > image.height:
            raise ToolError("The crop rectangle must stay inside the image.")
        image = image.crop((x, y, x + width, y + height))
    elif operation == "rotate":
        degrees = _number(options.get("degrees"), "rotation", 90, 270)
        if degrees not in {90, 180, 270}:
            raise ToolError("Rotation must be 90, 180, or 270 degrees.")
        image = image.rotate(-degrees, expand=True, resample=Image.Resampling.BICUBIC)
    elif operation == "flip":
        direction = options.get("direction")
        if direction not in {"horizontal", "vertical"}:
            raise ToolError("Choose horizontal or vertical flip.")
        image = ImageOps.mirror(image) if direction == "horizontal" else ImageOps.flip(image)
    elif operation == "strip":
        pass
    elif operation == "optimize":
        candidates = []
        formats = ["png", "webp"] if _has_transparency(image) else ["png", "jpeg", "webp"]
        for candidate in formats:
            encoded = _encode(image, candidate, quality)
            candidates.append((len(encoded[0]), candidate, encoded))
        _length, target, encoded = min(candidates, key=lambda item: item[0])
        return encoded[0], encoded[1], f"optimized-image{encoded[2]}"
    else:
        raise ToolError("That image action is unavailable.")

    encoded, mimetype, suffix = _encode(image, target, quality)
    return encoded, mimetype, f"toolbox-image{suffix}"


def inspect_image(file_storage):
    data = read_image_upload(file_storage, current_app.config["MAX_IMAGE_BYTES"])
    image = open_image(data)
    exif = image.getexif()
    metadata = {}
    for key, value in list(exif.items())[:50]:
        metadata[str(key)] = str(value)[:300]
    return {
        "format": image.format or "Unknown",
        "width": image.width,
        "height": image.height,
        "mode": image.mode,
        "frames": int(getattr(image, "n_frames", 1)),
        "animated": bool(getattr(image, "is_animated", False)),
        "transparency": _has_transparency(image),
        "file_size": len(data),
        "exif": metadata,
    }
