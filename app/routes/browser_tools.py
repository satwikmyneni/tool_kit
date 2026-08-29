"""Page routes for utilities that run entirely in the browser."""

from flask import Blueprint, abort, render_template

from app.registry import get_tool
from app.utils.helpers import tool_page_context

bp = Blueprint("browser_tools", __name__)


@bp.route("/tools/<slug>")
def page(slug):
    tool = get_tool(slug)
    if not tool or not tool.get("client_group"):
        abort(404)
    return render_template(
        "client_tool.html",
        **tool_page_context(slug, {"client_group": tool["client_group"], "container_class": "tool-wide"}),
    )
