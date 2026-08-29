import io

import pytest
from PIL import Image


def make_image(mode="RGB", size=(80, 60), color="red", fmt="PNG"):
    output = io.BytesIO()
    Image.new(mode, size, color).save(output, format=fmt)
    output.seek(0)
    return output


def process(client, slug, fields=None, image=None):
    data = {"image": (image or make_image(), "source.png")}
    data.update(fields or {})
    return client.post(f"/tools/{slug}/process", data=data, content_type="multipart/form-data")


@pytest.mark.parametrize("target,expected", [("png", "PNG"), ("jpeg", "JPEG"), ("webp", "WEBP")])
def test_image_converter_outputs_real_formats(client, target, expected):
    response = process(client, "image-converter", {"format": target, "quality": "80"})
    assert response.status_code == 200
    assert Image.open(io.BytesIO(response.data)).format == expected


def test_image_compress_resize_crop_rotate_and_flip(client):
    compressed = process(client, "image-compressor", {"format": "webp", "quality": "60"})
    assert compressed.status_code == 200

    resized = process(client, "image-resizer", {"format": "png", "quality": "90", "width": "20", "height": "20", "keep_aspect": "true", "allow_upscale": "false"})
    assert Image.open(io.BytesIO(resized.data)).size == (20, 15)

    cropped = process(client, "image-cropper", {"format": "png", "x": "10", "y": "5", "width": "30", "height": "20"})
    assert Image.open(io.BytesIO(cropped.data)).size == (30, 20)

    rotated = process(client, "image-rotator", {"format": "png", "degrees": "90"})
    assert Image.open(io.BytesIO(rotated.data)).size == (60, 80)

    source = make_image(size=(2, 1))
    image = Image.open(source)
    image.putpixel((0, 0), (255, 0, 0)); image.putpixel((1, 0), (0, 0, 255))
    prepared = io.BytesIO(); image.save(prepared, format="PNG"); prepared.seek(0)
    flipped = process(client, "image-flipper", {"format": "png", "direction": "horizontal"}, prepared)
    assert Image.open(io.BytesIO(flipped.data)).getpixel((0, 0))[:3] == (0, 0, 255)


def test_image_resize_does_not_upscale_by_default(client):
    response = process(client, "image-resizer", {"format": "png", "width": "500", "height": "500", "keep_aspect": "true", "allow_upscale": "false"})
    assert Image.open(io.BytesIO(response.data)).size == (80, 60)


def test_image_metadata_inspect_strip_and_optimizer(client):
    inspected = client.post(
        "/tools/image-metadata/inspect",
        data={"image": (make_image(), "source.png")},
        content_type="multipart/form-data",
    )
    assert inspected.status_code == 200
    assert inspected.get_json()["width"] == 80

    stripped = process(client, "image-metadata")
    assert stripped.status_code == 200
    assert Image.open(io.BytesIO(stripped.data)).size == (80, 60)

    optimized = process(client, "image-format-optimizer", {"quality": "75"})
    assert optimized.status_code == 200
    assert Image.open(io.BytesIO(optimized.data)).format in {"PNG", "JPEG", "WEBP"}


def test_transparent_png_stays_transparent_when_compressed_to_png(client):
    response = process(client, "image-compressor", {"format": "png", "quality": "50"}, make_image("RGBA", color=(255, 0, 0, 0)))
    output = Image.open(io.BytesIO(response.data)).convert("RGBA")
    assert output.getchannel("A").getextrema()[0] == 0


def test_crop_rejects_rectangle_outside_image(client):
    response = process(client, "image-cropper", {"format": "png", "x": "70", "y": "0", "width": "20", "height": "20"})
    assert response.status_code == 400
