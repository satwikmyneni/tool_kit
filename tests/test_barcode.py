"""Tests for Barcode Generator."""

import pytest


def test_barcode_page_loads(client):
    response = client.get("/tools/barcode-generator")
    assert response.status_code == 200
    assert b"Barcode Generator" in response.data


def test_barcode_generate_valid(client):
    response = client.post(
        "/tools/barcode-generator/generate",
        data={"text": "HELLO123"},
    )
    assert response.status_code == 200
    assert response.content_type == "image/png"


def test_barcode_generate_empty_input(client):
    response = client.post(
        "/tools/barcode-generator/generate",
        data={"text": ""},
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_barcode_generate_oversized_input(client):
    response = client.post(
        "/tools/barcode-generator/generate",
        data={"text": "x" * 100},
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_barcode_rejects_unsupported_characters(client):
    response = client.post(
        "/tools/barcode-generator/generate",
        data={"text": "emoji-😀"},
    )
    assert response.status_code == 400
