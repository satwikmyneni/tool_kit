STATUS_AVAILABLE = "available"

TOOLS = [
    {
        "slug": "qr-generator",
        "name": "QR Code Generator",
        "category": "Generators",
        "route": "/tools/qr-generator",
        "description": "Create QR codes from text or URLs.",
        "icon": "qr",
        "status": STATUS_AVAILABLE,
        "popular": True,
        "processing": "server",
        "keywords": ["qr", "code", "url", "link", "scan"],
        "related": ["barcode-generator", "typing-test"],
    },
    {
        "slug": "barcode-generator",
        "name": "Barcode Generator",
        "category": "Generators",
        "route": "/tools/barcode-generator",
        "description": "Generate Code 128 barcodes from text.",
        "icon": "barcode",
        "status": STATUS_AVAILABLE,
        "popular": True,
        "processing": "server",
        "keywords": ["barcode", "code 128", "label", "sku"],
        "related": ["qr-generator", "pdf-merger"],
    },
    {
        "slug": "typing-test",
        "name": "Typing Speed Test",
        "category": "Productivity",
        "route": "/tools/typing-test",
        "description": "Measure your typing speed and accuracy in a timed test.",
        "icon": "keyboard",
        "status": STATUS_AVAILABLE,
        "popular": True,
        "processing": "client",
        "keywords": ["typing", "wpm", "keyboard", "speed", "accuracy"],
        "related": ["expense-tracker", "text-to-speech"],
    },
    {
        "slug": "pdf-merger",
        "name": "PDF Merger",
        "category": "Documents",
        "route": "/tools/pdf-merger",
        "description": "Combine multiple PDF files into one document.",
        "icon": "pdf",
        "status": STATUS_AVAILABLE,
        "popular": True,
        "processing": "server",
        "keywords": ["pdf", "merge", "combine", "document", "files"],
        "related": ["background-remover", "gif-maker"],
    },
    {
        "slug": "background-remover",
        "name": "Image Background Remover",
        "category": "Media",
        "route": "/tools/background-remover",
        "description": "Remove image backgrounds and export a transparent PNG.",
        "icon": "image",
        "status": STATUS_AVAILABLE,
        "popular": False,
        "processing": "server",
        "keywords": ["image", "background", "remove", "png", "photo", "transparent"],
        "related": ["gif-maker", "pdf-merger"],
    },
    {
        "slug": "gif-maker",
        "name": "GIF Maker",
        "category": "Media",
        "route": "/tools/gif-maker",
        "description": "Turn a sequence of images into an animated GIF.",
        "icon": "gif",
        "status": STATUS_AVAILABLE,
        "popular": False,
        "processing": "server",
        "keywords": ["gif", "animation", "image", "frames", "photo"],
        "related": ["background-remover", "pdf-merger"],
    },
    {
        "slug": "text-to-speech",
        "name": "Text to Speech",
        "category": "Media",
        "route": "/tools/text-to-speech",
        "description": "Convert text into spoken audio you can preview and download.",
        "icon": "speech",
        "status": STATUS_AVAILABLE,
        "popular": False,
        "processing": "external",
        "keywords": ["tts", "speech", "audio", "voice", "read aloud"],
        "related": ["typing-test", "qr-generator"],
    },
    {
        "slug": "expense-tracker",
        "name": "Expense Tracker",
        "category": "Finance",
        "route": "/tools/expense-tracker",
        "description": "Track income, expenses, and monthly balances locally.",
        "icon": "wallet",
        "status": STATUS_AVAILABLE,
        "popular": False,
        "processing": "client",
        "keywords": ["expense", "money", "budget", "finance", "income", "csv"],
        "related": ["typing-test", "pdf-merger"],
    },
]


def get_tools(status=None):
    if status is None:
        return list(TOOLS)
    return [tool for tool in TOOLS if tool["status"] == status]


def get_tool(slug):
    for tool in TOOLS:
        if tool["slug"] == slug:
            return tool
    return None


def get_popular_tools():
    return [tool for tool in TOOLS if tool.get("popular")]


def get_categories():
    categories = []
    seen = set()
    for tool in TOOLS:
        name = tool["category"]
        if name not in seen:
            seen.add(name)
            categories.append(name)
    return categories


def get_tools_by_category():
    grouped = {}
    for category in get_categories():
        grouped[category] = [tool for tool in TOOLS if tool["category"] == category]
    return grouped


def get_related_tools(slug):
    tool = get_tool(slug)
    if not tool:
        return []
    related = []
    for related_slug in tool.get("related", []):
        other = get_tool(related_slug)
        if other and other["slug"] != slug:
            related.append(other)
    return related


def get_active_tool_urls():
    return [tool["route"] for tool in TOOLS if tool["status"] == STATUS_AVAILABLE]
