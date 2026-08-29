from flask import Blueprint, render_template

from app.utils.helpers import tool_page_context

bp = Blueprint("typing_test", __name__)


@bp.route("/tools/typing-test")
def page():
    return render_template("typing/index.html", **tool_page_context("typing-test"))
