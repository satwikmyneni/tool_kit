from xml.sax.saxutils import escape

from flask import Blueprint, current_app, render_template, request, url_for

from app.registry import (
    CATEGORY_INFO,
    PDF_SUBCATEGORIES,
    get_active_tool_urls,
    get_category,
    get_categories,
    get_popular_tools,
    get_tools,
    get_tools_by_category,
)
from app.utils.helpers import seo_page_context

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template(
        "index.html",
        popular_tools=get_popular_tools(),
        categories=get_categories(),
        tools_by_category=get_tools_by_category(),
        **seo_page_context(
            "Free Online Tools for PDF, Images, Text & More | Toolbox",
            "Use free online tools for PDFs, images, text, code, calculators, productivity, finance, and media. Fast results with no account required.",
            "/",
        ),
    )


@bp.route("/tools")
def tools():
    all_tools = get_tools()
    return render_template(
        "tools.html",
        tools_by_category=get_tools_by_category(),
        **seo_page_context(
            f"{len(all_tools)} Free Online Tools for Everyday Tasks | Toolbox",
            f"Browse {len(all_tools)} free online tools for PDFs, images, text, development, calculations, productivity, finance, and media. No account required.",
            "/tools",
            page_kind="collection",
            breadcrumbs=[
                {"name": "Home", "path": "/"},
                {"name": "All tools", "path": "/tools"},
            ],
            items=all_tools,
        ),
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
    pdf_groups = []
    if slug == "pdf-tools":
        pdf_groups = [
            {"name": name, "tools": [tool for tool in category_tools if tool.get("subcategory") == name]}
            for name in PDF_SUBCATEGORIES
        ]
    return render_template(
        "category.html",
        category=category,
        category_tools=category_tools,
        popular_tools=[tool for tool in category_tools if tool.get("popular")],
        pdf_groups=pdf_groups,
        **seo_page_context(
            category["seo_title"],
            category["seo_description"],
            f"/{slug}",
            page_kind="collection",
            breadcrumbs=[
                {"name": "Home", "path": "/"},
                {"name": category["name"], "path": f"/{slug}"},
            ],
            items=category_tools,
        ),
    )


@bp.route("/about")
def about():
    return render_template(
        "about.html",
        **seo_page_context(
            "About Toolbox & How Your Data Is Handled",
            "Learn how Toolbox handles browser-local inputs, temporary file processing, external services, saved preferences, and technical logs.",
            "/about",
            page_kind="about",
            breadcrumbs=[
                {"name": "Home", "path": "/"},
                {"name": "About", "path": "/about"},
            ],
        ),
    )


@bp.route("/robots.txt")
def robots():
    if current_app.config["SEO_INDEXING_ENABLED"]:
        sitemap_url = f"{current_app.config['BASE_URL']}{url_for('main.sitemap')}"
        lines = [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            f"Sitemap: {sitemap_url}",
            "",
        ]
    else:
        lines = ["User-agent: *", "Disallow: /", ""]
    response = current_app.response_class("\n".join(lines), mimetype="text/plain")
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response


@bp.route("/sitemap.xml")
def sitemap():
    base = current_app.config["BASE_URL"]
    pages = [f"{base}/", f"{base}/tools", f"{base}/about"]
    for category_slug, _description in CATEGORY_INFO.values():
        pages.append(f"{base}/{category_slug}")
    for path in get_active_tool_urls():
        pages.append(f"{base}{path}")
    last_modified = current_app.config.get("SEO_LASTMOD", "")
    xml_items = []
    for page_url in pages:
        fields = [f"    <loc>{escape(page_url)}</loc>"]
        if last_modified:
            fields.append(f"    <lastmod>{escape(last_modified)}</lastmod>")
        xml_items.append("  <url>\n" + "\n".join(fields) + "\n  </url>")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(xml_items)
        + "\n</urlset>\n"
    )
    response = current_app.response_class(xml, mimetype="application/xml")
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response


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
