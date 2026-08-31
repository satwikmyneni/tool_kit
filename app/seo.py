"""Helpers for consistent search metadata and Schema.org markup."""

from urllib.parse import urlsplit


APPLICATION_CATEGORIES = {
    "Developer": "DeveloperApplication",
    "Finance": "FinanceApplication",
    "Images": "MultimediaApplication",
    "Media": "MultimediaApplication",
    "PDF & Documents": "UtilitiesApplication",
}


def absolute_url(base_url, path):
    """Return a canonical absolute URL for a site-relative path."""
    base = base_url.rstrip("/")
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{base}{normalized_path}"


def validate_public_base_url(base_url):
    """Return whether a URL is suitable for production canonical metadata."""
    parsed = urlsplit(base_url)
    return (
        parsed.scheme == "https"
        and bool(parsed.netloc)
        and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
        and parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment
    )


def build_structured_data(
    *,
    base_url,
    page_title,
    description,
    canonical_path,
    page_kind="page",
    breadcrumbs=None,
    tool=None,
    items=None,
    last_modified="",
):
    """Build one JSON-LD graph shared by all indexable HTML pages."""
    page_url = absolute_url(base_url, canonical_path)
    website_id = absolute_url(base_url, "/#website")
    page_id = f"{page_url}#webpage"
    image_url = absolute_url(base_url, "/static/social-preview.jpg")

    website = {
        "@type": "WebSite",
        "@id": website_id,
        "url": absolute_url(base_url, "/"),
        "name": "Toolbox",
        "alternateName": "Toolbox Online Tools",
        "description": "Free online tools for PDFs, images, text, code, calculations, productivity, finance, and media.",
        "inLanguage": "en",
        "creator": {"@type": "Person", "name": "Satwik Myneni"},
    }
    page_types = {
        "about": "AboutPage",
        "collection": "CollectionPage",
    }
    page = {
        "@type": page_types.get(page_kind, "WebPage"),
        "@id": page_id,
        "url": page_url,
        "name": page_title,
        "description": description,
        "isPartOf": {"@id": website_id},
        "inLanguage": "en",
        "image": image_url,
    }
    if last_modified:
        page["dateModified"] = last_modified

    graph = [website, page]

    if breadcrumbs:
        breadcrumb_id = f"{page_url}#breadcrumb"
        breadcrumb_items = []
        for position, breadcrumb in enumerate(breadcrumbs, start=1):
            breadcrumb_items.append(
                {
                    "@type": "ListItem",
                    "position": position,
                    "name": breadcrumb["name"],
                    "item": absolute_url(base_url, breadcrumb["path"]),
                }
            )
        graph.append(
            {
                "@type": "BreadcrumbList",
                "@id": breadcrumb_id,
                "itemListElement": breadcrumb_items,
            }
        )
        page["breadcrumb"] = {"@id": breadcrumb_id}

    if tool:
        application_id = f"{page_url}#application"
        application = {
            "@type": "WebApplication",
            "@id": application_id,
            "name": tool["name"],
            "url": page_url,
            "description": tool["description"],
            "applicationCategory": APPLICATION_CATEGORIES.get(
                tool["category"], "UtilitiesApplication"
            ),
            "applicationSubCategory": tool["category"],
            "operatingSystem": "Any",
            "browserRequirements": "Requires a modern web browser with JavaScript enabled.",
            "isAccessibleForFree": True,
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
            },
            "keywords": ", ".join(tool.get("keywords", [])),
            "image": image_url,
            "mainEntityOfPage": {"@id": page_id},
        }
        graph.append(application)
        page["mainEntity"] = {"@id": application_id}

    if items:
        item_list_id = f"{page_url}#item-list"
        item_list = {
            "@type": "ItemList",
            "@id": item_list_id,
            "name": page_title,
            "numberOfItems": len(items),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": position,
                    "name": item["name"],
                    "url": absolute_url(base_url, item["route"]),
                }
                for position, item in enumerate(items, start=1)
            ],
        }
        graph.append(item_list)
        page["mainEntity"] = {"@id": item_list_id}

    return {"@context": "https://schema.org", "@graph": graph}
