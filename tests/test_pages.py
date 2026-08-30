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


def test_homepage_reference_layout_order_and_navigation(client):
    response = client.get("/")
    html = response.get_data(as_text=True)
    assert 'class="home-page"' in html
    assert 'class="home-category-launcher"' in html
    assert html.index("home-category-launcher") < html.index("home-hero")
    assert "Browse by category" not in html
    assert html.count("home-category-item") == 9
    assert 'placeholder="Search tools..."' in html
    assert 'href="#favorites"' in html
    assert 'href="#recently-used"' in html
    assert '<span>tools</span>' in html


def test_tools_directory_ok(client):
    response = client.get("/tools")
    assert response.status_code == 200
    assert b"All tools" in response.data


def test_about_page_ok(client):
    response = client.get("/about")
    assert response.status_code == 200
    assert b"How we handle data" in response.data


def test_tool_pages_load(client):
    """Every discoverable tool page must return 200."""
    from app.registry import get_tools

    for tool in get_tools():
        response = client.get(tool["route"])
        assert response.status_code == 200, f"{tool['route']} returned {response.status_code}"


def test_all_category_pages_load(client):
    for path in ["pdf-tools", "image-tools", "text-tools", "developer-tools", "generators", "calculators", "productivity-tools", "finance-tools", "media-tools"]:
        response = client.get(f"/{path}")
        assert response.status_code == 200
        assert b"Tool category" in response.data


def test_pdf_directory_uses_unique_tool_icons_without_card_arrows(client):
    from app.registry import get_tools_by_category

    pdf_tools = get_tools_by_category()["PDF & Documents"]
    icons = [tool["icon"] for tool in pdf_tools]
    html = client.get("/pdf-tools").get_data(as_text=True)

    assert len(icons) == len(set(icons))
    assert "pdf" not in icons
    assert "tool-card-arrow" not in html
    for tool in pdf_tools:
        icon_path = f"/static/icons/{tool['icon']}.svg"
        assert icon_path in html
        assert client.get(icon_path).status_code == 200


def test_tool_cards_never_render_decorative_arrows(client):
    for path in ["/", "/tools", "/pdf-tools", "/image-tools", "/text-tools", "/developer-tools", "/generators", "/calculators", "/productivity-tools", "/finance-tools", "/media-tools"]:
        html = client.get(path).get_data(as_text=True)
        assert "tool-card-arrow" not in html, f"Decorative card arrow rendered on {path}"


def test_every_tool_uses_a_unique_available_icon(client):
    from app.registry import get_tools

    tools = get_tools()
    icons = [tool["icon"] for tool in tools]
    html = client.get("/tools").get_data(as_text=True)

    assert len(tools) == 95
    assert len(icons) == len(set(icons))
    for tool in tools:
        icon_path = f"/static/icons/{tool['icon']}.svg"
        assert icon_path in html
        assert client.get(icon_path).status_code == 200


def test_pwa_manifest_and_service_worker_are_public_asset_only(client):
    manifest = client.get("/static/site.webmanifest")
    worker = client.get("/service-worker.js")
    assert manifest.status_code == 200
    assert b'"display": "standalone"' in manifest.data
    assert worker.status_code == 200
    assert b'url.pathname.startsWith("/static/")' in worker.data
    assert b"uploaded" not in worker.data.lower()


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
