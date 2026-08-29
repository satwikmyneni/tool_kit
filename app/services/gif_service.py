import io

from flask import current_app
from PIL import Image

from app.services.file_service import open_image, read_image_upload
from app.utils.errors import ToolError
from app.utils.validators import parse_int


def create_gif(file_storages, duration_ms=400, loop=True, width=480, height=320):
    files = [item for item in file_storages if item and getattr(item, "filename", None)]
    if len(files) < 2:
        raise ToolError("Add at least two images to create a GIF.")
    max_frames = current_app.config["MAX_GIF_FRAMES"]
    if len(files) > max_frames:
        raise ToolError(f"You can use up to {max_frames} images in one GIF.")

    duration = parse_int(duration_ms, 400, 50, 2000, "Frame duration must be between 50 and 2000 milliseconds.")
    max_edge = current_app.config["MAX_IMAGE_EDGE"]
    output_width = parse_int(width, 480, 120, max_edge, f"Choose a width between 120 and {max_edge} pixels.")
    output_height = parse_int(height, 320, 120, max_edge, f"Choose a height between 120 and {max_edge} pixels.")
    output_pixels = output_width * output_height * len(files)
    if output_pixels > current_app.config["MAX_GIF_TOTAL_PIXELS"]:
        raise ToolError("Those output dimensions are too large for this number of frames.")

    paletted = []
    max_bytes = current_app.config["MAX_IMAGE_BYTES"]
    for upload in files:
        data = read_image_upload(upload, max_bytes)
        image = open_image(data).convert("RGBA")
        fitted = _fit_frame(image, (output_width, output_height))
        paletted.append(_to_gif_frame(_letterbox(fitted, (output_width, output_height))))

    output = io.BytesIO()
    options = {
        "format": "GIF",
        "save_all": True,
        "append_images": paletted[1:],
        "duration": duration,
        "disposal": 2,
        "optimize": False,
    }
    if loop:
        options["loop"] = 0
    paletted[0].save(output, **options)
    return output.getvalue()


def _fit_frame(image, size):
    frame = image.copy()
    frame.thumbnail(size, Image.Resampling.LANCZOS)
    return frame


def _letterbox(image, size):
    canvas = Image.new("RGBA", size, (255, 255, 255, 0))
    x = (size[0] - image.width) // 2
    y = (size[1] - image.height) // 2
    canvas.paste(image, (x, y), image)
    return canvas


def _to_gif_frame(image):
    alpha = image.getchannel("A")
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    composed = Image.alpha_composite(background, image)
    paletted = composed.convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    mask = alpha.point(lambda value: 255 if value < 16 else 0)
    paletted.paste(255, mask)
    paletted.info["transparency"] = 255
    return paletted
