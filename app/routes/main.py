from flask import Blueprint, current_app, render_template, request, url_for

from app.registry import (
    CATEGORY_INFO,
    get_active_tool_urls,
    get_category,
    get_categories,
    get_popular_tools,
    get_tools_by_category,
)

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template(
        "index.html",
        page_title="Toolbox — Simple tools for everyday tasks",
        meta_description="Fast, focused, account-free utilities for everyday digital tasks.",
        canonical_path="/",
        popular_tools=get_popular_tools(),
        categories=get_categories(),
        tools_by_category=get_tools_by_category(),
    )


@bp.route("/tools")
def tools():
    return render_template(
        "tools.html",
        page_title="All tools — Toolbox",
        meta_description="Browse free Toolbox utilities for PDFs, images, text, development, calculations, productivity, finance, and media.",
        canonical_path="/tools",
        tools_by_category=get_tools_by_category(),
    )


@bp.route("/pdf-tools")
@bp.route("/image-tools")
@bp.route("/text-tools")
@bp.route("/developer-tools")
@bp.route("/generators")
@bp.route("/calculators")
@bp.route("/productivity-tools")
@bp.route("/finance-tools")
@bp.route("/media-tools")
def category():
    slug = request.path.strip("/")
    category = get_category(slug)
    category_tools = get_tools_by_category()[category["name"]]
    return render_template(
        "category.html",
        category=category,
        category_tools=category_tools,
        popular_tools=[tool for tool in category_tools if tool.get("popular")],
        page_title=f"{category['name']} — Free Online Tools | Toolbox",
        meta_description=category["description"],
        canonical_path=f"/{slug}",
    )


@bp.route("/about")
def about():
    return render_template(
        "about.html",
        page_title="About and data handling — Toolbox",
        meta_description="How Toolbox processes files and text, and what stays in your browser.",
        canonical_path="/about",
    )


@bp.route("/robots.txt")
def robots():
    sitemap_url = f"{current_app.config['BASE_URL']}{url_for('main.sitemap')}"
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            f"Sitemap: {sitemap_url}",
            "",
        ]
    )
    return current_app.response_class(body, mimetype="text/plain")


@bp.route("/sitemap.xml")
def sitemap():
    base = current_app.config["BASE_URL"]
    pages = [
        {"loc": f"{base}/", "changefreq": "weekly", "priority": "1.0"},
        {"loc": f"{base}/tools", "changefreq": "weekly", "priority": "0.8"},
        {"loc": f"{base}/about", "changefreq": "monthly", "priority": "0.4"},
    ]
    for category_slug, _description in CATEGORY_INFO.values():
        pages.append({"loc": f"{base}/{category_slug}", "changefreq": "weekly", "priority": "0.8"})
    for path in get_active_tool_urls():
        pages.append({"loc": f"{base}{path}", "changefreq": "monthly", "priority": "0.7"})
    xml_items = []
    for page in pages:
        xml_items.append(
            "  <url>\n"
            f"    <loc>{page['loc']}</loc>\n"
            f"    <changefreq>{page['changefreq']}</changefreq>\n"
            f"    <priority>{page['priority']}</priority>\n"
            "  </url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(xml_items)
        + "\n</urlset>\n"
    )
    return current_app.response_class(xml, mimetype="application/xml")


@bp.route("/service-worker.js")
def service_worker():
    response = current_app.send_static_file("service-worker.js")
    response.headers["Content-Type"] = "application/javascript"
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


@bp.app_context_processor
def canonical_fallback():
    path = request.path if request else "/"
    return {"canonical_path": path}
