"""Tests for the central tool registry."""

from app.registry import (
    STATUS_AVAILABLE,
    get_categories,
    get_popular_tools,
    get_related_tools,
    get_tool,
    get_tools,
    get_tools_by_category,
)


def test_registry_has_unique_slugs():
    slugs = [tool["slug"] for tool in get_tools()]
    assert len(slugs) == len(set(slugs))


def test_required_tool_fields():
    required = {"slug", "name", "category", "description", "route", "icon", "status", "keywords"}
    for tool in get_tools():
        assert required.issubset(tool.keys()), f"Tool '{tool['slug']}' missing fields"


def test_all_tools_available():
    """All eight tools must have status 'available'."""
    for tool in get_tools():
        assert tool["status"] == STATUS_AVAILABLE, f"Tool '{tool['slug']}' is not available"


def test_eight_tools_exist():
    assert len(get_tools()) == 8


def test_routes_are_unique_and_match_slugs():
    routes = [tool["route"] for tool in get_tools()]
    assert len(routes) == len(set(routes))
    for tool in get_tools():
        assert tool["route"] == f"/tools/{tool['slug']}"


def test_lookup_and_grouping():
    tool = get_tool("pdf-merger")
    assert tool["name"] == "PDF Merger"
    assert "Generators" in get_categories()
    assert "Documents" in get_categories()
    grouped = get_tools_by_category()
    assert grouped["Documents"][0]["slug"] == "pdf-merger"
    assert len(get_popular_tools()) >= 1
    assert get_tool("missing") is None


def test_related_tools():
    related = get_related_tools("qr-generator")
    slugs = [r["slug"] for r in related]
    assert "barcode-generator" in slugs


def test_categories():
    cats = get_categories()
    expected = ["Generators", "Productivity", "Documents", "Media", "Finance"]
    for cat in expected:
        assert cat in cats, f"Category '{cat}' not found"
