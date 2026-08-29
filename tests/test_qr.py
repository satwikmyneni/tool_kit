"""Tests for QR Code Generator."""

import io
import pytest


def test_qr_page_loads(client):
    response = client.get("/tools/qr-generator")
    assert response.status_code == 200
    assert b"QR Code Generator" in response.data


def test_qr_generate_valid(client):
    response = client.post(
        "/tools/qr-generator/generate",
        data={"text": "https://example.com", "size": "10", "margin": "4", "error_correction": "M"},
    )
    assert response.status_code == 200
    assert response.content_type == "image/png"
    # Verify it's a valid PNG
    assert response.data[:8] == b"\x89PNG\r\n\x1a\n"


def test_qr_generate_empty_input(client):
    response = client.post(
        "/tools/qr-generator/generate",
        data={"text": ""},
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_qr_generate_oversized_input(client):
    response = client.post(
        "/tools/qr-generator/generate",
        data={"text": "x" * 3000},
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_qr_error_correction_levels(client):
    for level in ["L", "M", "Q", "H"]:
        response = client.post(
            "/tools/qr-generator/generate",
            data={"text": "test", "error_correction": level},
        )
        assert response.status_code == 200


@pytest.mark.parametrize(
    "field,value",
    [("size", "2"), ("margin", "99"), ("error_correction", "invalid")],
)
def test_qr_rejects_invalid_settings(client, field, value):
    response = client.post(
        "/tools/qr-generator/generate",
        data={"text": "test", field: value},
    )
    assert response.status_code == 400


def test_qr_download_headers(client):
    response = client.post("/tools/qr-generator/generate", data={"text": "download"})
    assert "toolbox-qr-code.png" in response.headers["Content-Disposition"]
    assert response.headers["Cache-Control"].startswith("no-store")


def test_qr_reports_capacity_overflow_cleanly(client):
    response = client.post(
        "/tools/qr-generator/generate",
        data={"text": "x" * 2000, "error_correction": "H"},
    )
    assert response.status_code == 400
    assert "too long" in response.get_json()["error"].lower()
