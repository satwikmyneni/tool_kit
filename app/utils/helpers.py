import io

from flask import jsonify, send_file

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


def tool_page_context(slug, extra=None):
    from app.registry import CATEGORY_INFO, get_related_tools, get_tool

    tool = get_tool(slug)
    context = {
        "tool": tool,
        "related_tools": get_related_tools(slug),
        "page_title": tool["seo_title"],
        "meta_description": tool["seo_description"],
        "canonical_path": f"/tools/{tool['slug']}",
        "category_info": {
            "name": tool["category"],
            "slug": CATEGORY_INFO[tool["category"]][0],
        },
    }
    if extra:
        context.update(extra)
    return context
