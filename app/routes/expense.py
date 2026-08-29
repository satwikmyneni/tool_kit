from flask import Blueprint, render_template

from app.utils.helpers import tool_page_context

bp = Blueprint("expense", __name__)


@bp.route("/tools/expense-tracker")
def page():
    return render_template(
        "expense/index.html",
        **tool_page_context("expense-tracker", {"container_class": "tool-wide"}),
    )
