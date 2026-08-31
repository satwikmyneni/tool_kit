"""Regression tests for crawlability and search metadata."""

import html as html_module
import json
import re
from xml.etree import ElementTree

from app.registry import CATEGORY_INFO, get_active_tool_urls


def _match(pattern, source):
    match = re.search(pattern, source, flags=re.IGNORECASE | re.DOTALL)
    assert match, f"Missing HTML pattern: {pattern}"
    return html_module.unescape(match.group(1).strip())


def _json_ld(source):
    payload = _match(
        r'<script\s+type="application/ld\+json">(.*?)</script>',
        source,
    )
    return json.loads(payload)


def _public_paths():
    category_paths = [f"/{slug}" for slug, _description in CATEGORY_INFO.values()]
    return ["/", "/tools", "/about", *category_paths, *get_active_tool_urls()]


def test_every_public_page_has_complete_unique_search_metadata(client):
    titles = set()
    descriptions = set()
    canonicals = set()

    for path in _public_paths():
        response = client.get(path)
        assert response.status_code == 200, path
        source = response.get_data(as_text=True)
        title = _match(r"<title>(.*?)</title>", source)
        description = _match(
            r'<meta\s+name="description"\s+content="([^"]+)"', source
        )
        robots = _match(r'<meta\s+name="robots"\s+content="([^"]+)"', source)
        canonical = _match(r'<link\s+rel="canonical"\s+href="([^"]+)"', source)

        assert 20 <= len(title) <= 75, (path, title)
        assert 75 <= len(description) <= 180, (path, description)
        assert robots.startswith("index,follow"), path
        assert canonical == f"http://localhost{path}", path
        assert len(re.findall(r"<h1(?:\s|>)", source, flags=re.IGNORECASE)) == 1, path
        assert 'name="twitter:card" content="summary_large_image"' in source
        assert 'property="og:image:width" content="1200"' in source

        assert title not in titles, (path, title)
        assert description not in descriptions, (path, description)
        assert canonical not in canonicals, (path, canonical)
        titles.add(title)
        descriptions.add(description)
        canonicals.add(canonical)


def test_structured_data_describes_site_hierarchy_and_tools(client):
    homepage_schema = _json_ld(client.get("/").get_data(as_text=True))
    assert homepage_schema["@context"] == "https://schema.org"
    assert {node["@type"] for node in homepage_schema["@graph"]} == {
        "WebSite",
        "WebPage",
    }

    category_schema = _json_ld(client.get("/image-tools").get_data(as_text=True))
    category_types = {node["@type"] for node in category_schema["@graph"]}
    assert {"WebSite", "CollectionPage", "BreadcrumbList", "ItemList"} <= category_types

    tool_schema = _json_ld(
        client.get("/tools/percentage-calculator").get_data(as_text=True)
    )
    tool_types = {node["@type"] for node in tool_schema["@graph"]}
    assert {"WebSite", "WebPage", "BreadcrumbList", "WebApplication"} <= tool_types
    application = next(
        node for node in tool_schema["@graph"] if node["@type"] == "WebApplication"
    )
    assert application["isAccessibleForFree"] is True
    assert application["offers"]["price"] == "0"
    assert application["offers"]["priceCurrency"] == "USD"


def test_sitemap_contains_exactly_the_canonical_public_pages(client):
    response = client.get("/sitemap.xml")
    root = ElementTree.fromstring(response.data)
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locations = {item.text for item in root.findall("s:url/s:loc", namespace)}
    expected = {f"http://localhost{path}" for path in _public_paths()}
    assert locations == expected
    assert "changefreq" not in response.get_data(as_text=True)
    assert "priority" not in response.get_data(as_text=True)


def test_error_and_api_responses_are_not_indexable(client):
    missing = client.get("/definitely-not-a-page")
    source = missing.get_data(as_text=True)
    assert missing.status_code == 404
    assert missing.headers["X-Robots-Tag"] == "noindex, nofollow"
    assert 'name="robots" content="noindex,nofollow"' in source

    api = client.post("/api/pdf/preview")
    assert api.headers["X-Robots-Tag"] == "noindex, nofollow"


def test_social_preview_is_small_and_public(client):
    response = client.get("/static/social-preview.jpg")
    assert response.status_code == 200
    assert response.mimetype == "image/jpeg"
    assert len(response.data) < 150_000


def test_indexing_can_be_disabled_for_preview_deployments(app):
    app.config["SEO_INDEXING_ENABLED"] = False
    preview_client = app.test_client()
    source = preview_client.get("/").get_data(as_text=True)
    robots = preview_client.get("/robots.txt").get_data(as_text=True)
    assert 'name="robots" content="noindex,nofollow"' in source
    assert "Disallow: /" in robots
    assert "Sitemap:" not in robots
