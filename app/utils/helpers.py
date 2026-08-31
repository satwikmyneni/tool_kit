import io

from flask import current_app, jsonify, send_file

from app.seo import build_structured_data
from app.utils.errors import ToolError


def json_error(message, status_code=400):
    return jsonify({"error": message}), status_code


def handle_tool_error(error):
    if isinstance(error, ToolError):
        return json_error(error.message, error.status_code)
    return json_error(
        "Something went wrong. Please try again.",
        500,
    )


def send_generated_file(data, filename, mimetype):
    response = send_file(
        io.BytesIO(data),
        mimetype=mimetype,
        as_attachment=True,
        download_name=filename,
        max_age=0,
    )
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


def seo_page_context(
    page_title,
    meta_description,
    canonical_path,
    *,
    page_kind="page",
    breadcrumbs=None,
    tool=None,
    items=None,
):
    """Return metadata and structured data for a public HTML page."""
    breadcrumbs = breadcrumbs or []
    items = items or []
    return {
        "page_title": page_title,
        "meta_description": meta_description,
        "canonical_path": canonical_path,
        "structured_data": build_structured_data(
            base_url=current_app.config["BASE_URL"],
            page_title=page_title,
            description=meta_description,
            canonical_path=canonical_path,
            page_kind=page_kind,
            breadcrumbs=breadcrumbs,
            tool=tool,
            items=items,
            last_modified=current_app.config.get("SEO_LASTMOD", ""),
        ),
    }


def tool_page_context(slug, extra=None):
    from app.registry import CATEGORY_DETAILS, CATEGORY_INFO, get_related_tools, get_tool

    tool = get_tool(slug)
    breadcrumbs = [
        {"name": "Home", "path": "/"},
        {"name": tool["category"], "path": f"/{CATEGORY_INFO[tool['category']][0]}"},
        {"name": tool["name"], "path": tool["route"]},
    ]
    context = {
        "tool": tool,
        "related_tools": get_related_tools(slug),
        "category_info": {
            "name": tool["category"],
            "slug": CATEGORY_INFO[tool["category"]][0],
            **CATEGORY_DETAILS[tool["category"]],
        },
        **seo_page_context(
            tool["seo_title"],
            tool["seo_description"],
            tool["route"],
            breadcrumbs=breadcrumbs,
            tool=tool,
        ),
    }
    if extra:
        context.update(extra)
    return context
