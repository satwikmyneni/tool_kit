"""Tests for Image Background Remover."""

import io
import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage

from app.services.image_service import remove_background
from app.utils.errors import ToolError


def _make_image(width=100, height=100, color="red", fmt="PNG"):
    """Create a small test image in memory."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf


def test_image_page_loads(client):
    response = client.get("/tools/background-remover")
    assert response.status_code == 200
    assert b"Background Remover" in response.data


def test_image_no_file(client):
    response = client.post(
        "/tools/background-remover/process",
        data={},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_image_invalid_file(client):
    fake = io.BytesIO(b"not an image file at all")
    response = client.post(
        "/tools/background-remover/process",
        data={"image": (fake, "bad.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_image_valid_input(client, monkeypatch):
    """The route returns a real transparent PNG without requiring a model in CI."""
    img = _make_image(50, 50)
    result = Image.new("RGBA", (50, 50), (255, 0, 0, 0))
    output = io.BytesIO()
    result.save(output, format="PNG")
    monkeypatch.setattr("app.routes.image.remove_background", lambda _upload: output.getvalue())
    response = client.post(
        "/tools/background-remover/process",
        data={"image": (img, "test.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert response.content_type == "image/png"
    result_img = Image.open(io.BytesIO(response.data))
    assert result_img.mode == "RGBA"


def test_image_service_returns_verified_transparency(app):
    source = _make_image(20, 20)
    result = Image.new("RGBA", (20, 20), (255, 0, 0, 255))
    result.putpixel((0, 0), (255, 0, 0, 0))
    output = io.BytesIO()
    result.save(output, format="PNG")
    upload = FileStorage(stream=source, filename="photo.png", content_type="image/png")

    with app.app_context():
        data = remove_background(upload, remover=lambda _input: output.getvalue())

    processed = Image.open(io.BytesIO(data))
    assert processed.mode == "RGBA"
    assert processed.getchannel("A").getextrema()[0] == 0


def test_image_service_rejects_opaque_result(app):
    source = _make_image(20, 20)
    opaque = _make_image(20, 20).getvalue()
    upload = FileStorage(stream=source, filename="photo.png", content_type="image/png")

    with app.app_context(), pytest.raises(ToolError, match="No removable background"):
        remove_background(upload, remover=lambda _input: opaque)


def test_image_rejects_wrong_extension(client):
    response = client.post(
        "/tools/background-remover/process",
        data={"image": (_make_image(), "photo.gif")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_image_edge_limit_checked_before_processing(app):
    app.config["MAX_IMAGE_EDGE"] = 40
    upload = FileStorage(
        stream=_make_image(50, 20), filename="wide.png", content_type="image/png"
    )
    with app.app_context(), pytest.raises(ToolError, match="too large"):
        remove_background(upload, remover=lambda value: value)
