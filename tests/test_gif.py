"""Tests for GIF Maker."""

import io
import pytest
from PIL import Image


def _make_image(width=100, height=100, color="red", fmt="PNG"):
    """Create a small test image in memory."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf


def test_gif_page_loads(client):
    response = client.get("/tools/gif-maker")
    assert response.status_code == 200
    assert b"GIF Maker" in response.data


def test_gif_create_valid(client):
    img1 = _make_image(color="red")
    img2 = _make_image(color="blue")
    response = client.post(
        "/tools/gif-maker/create",
        data={
            "files": [
                (img1, "frame1.png"),
                (img2, "frame2.png"),
            ],
            "duration": "200",
            "width": "120",
            "loop": "1",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert response.content_type == "image/gif"
    # Verify GIF header
    assert response.data[:6] in (b"GIF87a", b"GIF89a")


def test_gif_one_image_rejected(client):
    img1 = _make_image()
    response = client.post(
        "/tools/gif-maker/create",
        data={
            "files": [(img1, "frame1.png")],
            "duration": "200",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_gif_invalid_image(client):
    fake = io.BytesIO(b"not an image")
    good = _make_image()
    response = client.post(
        "/tools/gif-maker/create",
        data={
            "files": [
                (fake, "bad.png"),
                (good, "good.png"),
            ],
            "duration": "200",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_gif_output_size_and_frame_order(client):
    response = client.post(
        "/tools/gif-maker/create",
        data={
            "files": [(_make_image(color="red"), "red.png"), (_make_image(color="blue"), "blue.png")],
            "duration": "200",
            "width": "160",
            "height": "120",
            "loop": "0",
        },
        content_type="multipart/form-data",
    )
    animation = Image.open(io.BytesIO(response.data))
    assert animation.size == (160, 120)
    animation.seek(0)
    first = animation.convert("RGB").getpixel((80, 60))
    animation.seek(1)
    second = animation.convert("RGB").getpixel((80, 60))
    assert first[0] > first[2]
    assert second[2] > second[0]
    assert "loop" not in animation.info


def test_gif_frame_limit(client, app):
    app.config["MAX_GIF_FRAMES"] = 2
    response = client.post(
        "/tools/gif-maker/create",
        data={"files": [(_make_image(), f"{index}.png") for index in range(3)]},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_gif_rejects_unsafe_total_output_size(client, app):
    app.config["MAX_GIF_TOTAL_PIXELS"] = 1000
    response = client.post(
        "/tools/gif-maker/create",
        data={
            "files": [(_make_image(), "one.png"), (_make_image(), "two.png")],
            "width": "120",
            "height": "120",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
