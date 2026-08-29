"""Tests for page routes and rendering."""

import re

import pytest

from app import create_app
from config import ProductionConfig


def test_homepage_ok(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Simple tools for everyday tasks." in response.data
    assert b"QR Code Generator" in response.data
    assert b"Private by default" in response.data


def test_tools_directory_ok(client):
    response = client.get("/tools")
    assert response.status_code == 200
    assert b"All tools" in response.data


def test_about_page_ok(client):
    response = client.get("/about")
    assert response.status_code == 200
    assert b"How we handle data" in response.data


def test_tool_pages_load(client):
    """All eight tool pages must return 200."""
    slugs = [
        "qr-generator",
        "barcode-generator",
        "typing-test",
        "pdf-merger",
        "background-remover",
        "gif-maker",
        "text-to-speech",
        "expense-tracker",
    ]
    for slug in slugs:
        response = client.get(f"/tools/{slug}")
        assert response.status_code == 200, f"/tools/{slug} returned {response.status_code}"


def test_robots_and_sitemap(client):
    robots = client.get("/robots.txt")
    sitemap = client.get("/sitemap.xml")
    assert robots.status_code == 200
    assert b"Sitemap:" in robots.data
    assert sitemap.status_code == 200
    assert b"http://localhost/" in sitemap.data
    assert b"/tools" in sitemap.data
    # All tools are available, so slugs should appear in sitemap
    assert b"qr-generator" in sitemap.data


def test_security_headers(client):
    response = client.get("/")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in response.headers


def test_homepage_seo_tags(client):
    response = client.get("/")
    html = response.get_data(as_text=True)
    assert 'rel="canonical"' in html
    assert 'property="og:title"' in html
    assert "<h1>" in html


def test_404_page(client):
    response = client.get("/nonexistent")
    assert response.status_code == 404


def test_csrf_is_required_and_ajax_errors_are_json(app):
    app.config["WTF_CSRF_ENABLED"] = True
    client = app.test_client()
    rejected = client.post(
        "/tools/qr-generator/generate",
        data={"text": "hello"},
        headers={"X-Requested-With": "Toolbox"},
    )
    assert rejected.status_code == 400
    assert "refresh" in rejected.get_json()["error"].lower()

    page = client.get("/tools/qr-generator")
    token = re.search(r'<meta name="csrf-token" content="([^"]+)">', page.get_data(as_text=True)).group(1)
    generated = client.post(
        "/tools/qr-generator/generate",
        data={"text": "hello"},
        headers={"X-CSRFToken": token, "X-Requested-With": "Toolbox"},
    )
    assert generated.status_code == 200


def test_production_config_disables_debug_and_secures_cookies(monkeypatch):
    monkeypatch.setattr(ProductionConfig, "SECRET_KEY", "production-test-secret")
    production = create_app("production")
    assert production.debug is False
    assert production.config["SESSION_COOKIE_SECURE"] is True


def test_production_rejects_development_secret(monkeypatch):
    monkeypatch.setattr(ProductionConfig, "SECRET_KEY", "dev-only-change-me")
    with pytest.raises(RuntimeError, match="Production requires SECRET_KEY"):
        create_app("production")
