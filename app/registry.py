"""Canonical metadata for every public Toolbox utility.

Only working tools belong here. Search, category pages, related links, SEO, and
the sitemap all consume this registry.
"""

STATUS_AVAILABLE = "available"

CATEGORY_INFO = {
    "PDF & Documents": ("pdf-tools", "Merge, split, organize, inspect, secure, and create PDF documents."),
    "Images": ("image-tools", "Resize, compress, convert, transform, and inspect images."),
    "Text": ("text-tools", "Analyze, clean, compare, generate, and preview text locally."),
    "Developer": ("developer-tools", "Format, encode, decode, validate, and inspect developer data locally."),
    "Generators": ("generators", "Generate secure passwords, identifiers, codes, colors, and random values."),
    "Calculators": ("calculators", "Accurate everyday calculators and unit converters with clear assumptions."),
    "Productivity": ("productivity-tools", "Local timers, lists, notes, habits, and focus tools."),
    "Finance": ("finance-tools", "Private budgeting, expense, loan, savings, and bill-splitting utilities."),
    "Media": ("media-tools", "Create GIFs and speech audio or inspect audio files."),
}


def _tool(slug, name, category, description, icon, keywords, processing="client",
          group="", popular="", related=""):
    return {
        "slug": slug,
        "name": name,
        "category": category,
        "route": f"/tools/{slug}",
        "description": description,
        "icon": icon if category == "PDF & Documents" else f"tool-{slug}",
        "status": STATUS_AVAILABLE,
        "popular": popular == "yes",
        "popularity": 100 if popular == "yes" else 50,
        "processing": processing,
        "keywords": [item.strip() for item in keywords.split(",") if item.strip()],
        "related": [item.strip() for item in related.split(",") if item.strip()],
        "client_group": group or None,
        "seo_title": f"{name} — Free Online Tool | Toolbox",
        "seo_description": f"{description} Fast, account-free, and privacy-conscious.",
    }


# slug|name|category|description|icon|keywords|processing|client group|popular|related
_DATA = """
pdf-merger|PDF Merger|PDF & Documents|Combine multiple PDF files in the order you choose.|pdf-merge|pdf,merge,combine,document|server||yes|pdf-splitter,pdf-compressor,images-to-pdf
pdf-splitter|PDF Splitter|PDF & Documents|Extract selected pages, page ranges, or every page into a ZIP.|pdf-split|pdf,split,extract,pages,zip|server||yes|pdf-merger,extract-pdf-pages,pdf-compressor
pdf-compressor|PDF Compressor|PDF & Documents|Apply honest lossless PDF stream and object compression.|pdf-compress|pdf,compress,optimize,reduce,size|server||yes|pdf-merger,pdf-splitter,pdf-inspector
images-to-pdf|Images to PDF|PDF & Documents|Turn ordered PNG, JPEG, or WEBP images into one PDF.|images-pdf|image,jpg,jpeg,png,webp,pdf|server||yes|pdf-merger,image-resizer,image-compressor
rotate-pdf|Rotate PDF|PDF & Documents|Rotate all pages or a selected page range in a PDF.|pdf-rotate|pdf,rotate,pages,orientation|server|||reorder-pdf-pages,delete-pdf-pages
delete-pdf-pages|Delete PDF Pages|PDF & Documents|Remove selected pages and download the remaining PDF.|pdf-delete|pdf,delete,remove,pages|server|||extract-pdf-pages,reorder-pdf-pages
extract-pdf-pages|Extract PDF Pages|PDF & Documents|Create a new PDF from selected pages in their original order.|pdf-extract|pdf,extract,page,selection|server|||pdf-splitter,delete-pdf-pages
reorder-pdf-pages|Reorder PDF Pages|PDF & Documents|Create a PDF using a custom page order, including duplicates.|pdf-reorder|pdf,reorder,organize,pages|server|||rotate-pdf,extract-pdf-pages
pdf-metadata|PDF Metadata Editor|PDF & Documents|View document information and download a copy with updated metadata.|pdf-metadata|pdf,metadata,title,author,editor|server|||pdf-inspector,pdf-compressor
protect-pdf|Protect PDF|PDF & Documents|Encrypt a PDF with a password required for opening it.|pdf-lock|pdf,password,encrypt,protect|server|||unlock-pdf,pdf-inspector
unlock-pdf|Unlock PDF|PDF & Documents|Remove encryption from a PDF when you provide its correct password.|pdf-unlock|pdf,password,decrypt,unlock|server|||protect-pdf,pdf-inspector
pdf-inspector|PDF Inspector & Validator|PDF & Documents|Validate a PDF and inspect pages, encryption, metadata, and file size.|pdf-inspect|pdf,inspect,validate,information,repair|server|||pdf-metadata,pdf-compressor
pdf-to-jpg|PDF to JPG|PDF & Documents|Render selected PDF pages as high-quality JPG images.|pdf-jpg|pdf,jpg,jpeg,image,convert,export|server||yes|pdf-to-png,pdf-to-powerpoint,image-compressor
pdf-to-png|PDF to PNG|PDF & Documents|Render selected PDF pages as lossless PNG images.|pdf-png|pdf,png,image,convert,export|server|||pdf-to-jpg,pdf-to-powerpoint,image-compressor
pdf-to-word|PDF to Word|PDF & Documents|Extract PDF text and supported images into a practical DOCX document.|pdf-word|pdf,word,docx,convert,text,document|server||yes|word-to-pdf,pdf-to-excel,pdf-to-powerpoint
pdf-to-excel|PDF to Excel|PDF & Documents|Detect structured PDF tables and export them into an XLSX workbook.|pdf-excel|pdf,excel,xlsx,table,convert,spreadsheet|server|||excel-to-pdf,pdf-to-word,pdf-to-powerpoint
pdf-to-powerpoint|PDF to PowerPoint|PDF & Documents|Place each PDF page faithfully onto a PowerPoint slide.|pdf-powerpoint|pdf,powerpoint,pptx,slides,convert,presentation|server|||powerpoint-to-pdf,pdf-to-word,pdf-to-png
word-to-pdf|Word to PDF|PDF & Documents|Convert DOC or DOCX documents to PDF with the server's LibreOffice engine.|word-pdf|word,doc,docx,pdf,convert,libreoffice|server|||pdf-to-word,excel-to-pdf,powerpoint-to-pdf
excel-to-pdf|Excel to PDF|PDF & Documents|Convert XLS or XLSX spreadsheets to PDF with the server's LibreOffice engine.|excel-pdf|excel,xls,xlsx,pdf,convert,libreoffice|server|||pdf-to-excel,word-to-pdf,powerpoint-to-pdf
powerpoint-to-pdf|PowerPoint to PDF|PDF & Documents|Convert PPT or PPTX presentations to PDF with the server's LibreOffice engine.|powerpoint-pdf|powerpoint,ppt,pptx,pdf,convert,libreoffice|server|||pdf-to-powerpoint,word-to-pdf,excel-to-pdf
jpg-to-pdf|JPG to PDF|PDF & Documents|Combine ordered JPG images into a configurable PDF document.|jpg-pdf|jpg,jpeg,image,pdf,convert,combine|server|||png-to-pdf,images-to-pdf,pdf-to-jpg
png-to-pdf|PNG to PDF|PDF & Documents|Combine ordered PNG images into a configurable PDF document.|png-pdf|png,image,pdf,convert,combine|server|||jpg-to-pdf,images-to-pdf,pdf-to-png
background-remover|Image Background Remover|Images|Remove an image background and export a transparent PNG.|image|image,background,remove,transparent,png|server||yes|image-resizer,image-compressor,image-converter
image-compressor|Image Compressor|Images|Compress a PNG, JPEG, or WEBP with explicit quality controls.|image|image,compress,quality,size,webp|server||yes|image-resizer,image-converter,background-remover
image-resizer|Image Resizer|Images|Resize an image with aspect-ratio and no-upscale controls.|image|image,resize,dimensions,width,height|server||yes|image-compressor,image-converter,images-to-pdf
image-converter|Image Converter|Images|Convert PNG, JPEG, and WEBP images while handling transparency safely.|image|image,convert,png,jpg,webp|server|||image-compressor,image-resizer
image-cropper|Image Cropper|Images|Crop an image using precise pixel coordinates and dimensions.|image|image,crop,trim,dimensions|server|||image-resizer,image-rotator
image-rotator|Image Rotator|Images|Rotate an image clockwise or counterclockwise without clipping.|image|image,rotate,orientation|server|||image-flipper,image-cropper
image-flipper|Image Flipper|Images|Flip an image horizontally or vertically.|image|image,flip,mirror,horizontal,vertical|server|||image-rotator,image-cropper
image-metadata|Image Metadata Tool|Images|Inspect image properties or download a metadata-stripped copy.|image|image,metadata,exif,strip,privacy|server|||image-format-optimizer,image-converter
image-format-optimizer|Image Format Optimizer|Images|Compare encoded formats and download the smallest suitable result.|image|image,optimize,format,smallest,compression|server|||image-compressor,image-converter
image-color-picker|Image Color Picker|Images|Pick pixel colors from an image entirely in your browser.|image|image,color,picker,hex,rgb|client|image||
text-analyzer|Text Analyzer|Text|Count words, characters, sentences, paragraphs, and reading time locally.|keyboard|word,character,counter,reading,analyze|client|text|yes|case-converter,text-cleaner,text-diff
case-converter|Case Converter|Text|Convert text to upper, lower, title, or sentence case locally.|keyboard|uppercase,lowercase,title,sentence,case|client|text||text-analyzer,text-cleaner
text-cleaner|Text Cleaner|Text|Trim, deduplicate, sort, reverse, find, replace, and normalize text.|keyboard|clean,duplicate,sort,reverse,spaces,replace|client|text||text-analyzer,case-converter
text-diff|Text Diff Checker|Text|Compare two texts line by line without uploading either one.|keyboard|text,diff,compare,lines|client|text||text-cleaner,text-analyzer
lorem-ipsum-generator|Lorem Ipsum Generator|Text|Generate configurable placeholder paragraphs locally.|keyboard|lorem,ipsum,dummy,paragraph,generator|client|text||text-analyzer,markdown-previewer
markdown-previewer|Markdown Previewer|Text|Preview common Markdown safely in your browser.|keyboard|markdown,preview,html,text|client|text||text-cleaner,text-analyzer
json-toolkit|JSON Toolkit|Developer|Format, minify, and validate JSON locally with useful errors.|barcode|json,format,validate,minify,developer|client|developer|yes|base64-toolkit,jwt-decoder
base64-toolkit|Base64 Encoder & Decoder|Developer|Encode or decode Unicode text as Base64 locally.|barcode|base64,encode,decode,unicode|client|developer||url-toolkit,hash-generator
url-toolkit|URL Encoder & Decoder|Developer|Encode or decode URL components in your browser.|barcode|url,uri,encode,decode|client|developer||query-string-parser,html-entity-toolkit
hash-generator|Hash Generator|Developer|Create SHA-256, SHA-384, or SHA-512 hashes with Web Crypto.|barcode|hash,sha256,sha384,sha512,crypto|client|developer||base64-toolkit,uuid-generator
timestamp-converter|Timestamp Converter|Developer|Convert Unix timestamps and local dates in both directions.|barcode|timestamp,unix,epoch,date,time|client|developer||json-toolkit,uuid-generator
regex-tester|Regex Tester|Developer|Test JavaScript regular expressions with flags and match details locally.|barcode|regex,regular expression,match,javascript|client|developer||text-diff,code-formatter
code-formatter|HTML, CSS & JavaScript Formatter|Developer|Apply lightweight indentation to HTML, CSS, or JavaScript source locally.|barcode|html,css,javascript,format,beautify|client|developer||json-toolkit,html-entity-toolkit
color-converter|Color Converter|Developer|Convert HEX, RGB, and HSL colors and preview the result.|image|color,hex,rgb,hsl,convert|client|developer||color-palette-generator,gradient-generator
jwt-decoder|JWT Decoder|Developer|Decode JWT headers and payloads locally without claiming signature validity.|barcode|jwt,json web token,decode,header,payload|client|developer||base64-toolkit,json-toolkit
query-string-parser|Query String Parser|Developer|Parse or build URL query strings locally.|barcode|query,url,parameters,parse|client|developer||url-toolkit,json-toolkit
html-entity-toolkit|HTML Entity Encoder & Decoder|Developer|Encode or decode HTML entities without sending content anywhere.|barcode|html,entity,encode,decode,escape|client|developer||code-formatter,url-toolkit
qr-generator|QR Code Generator|Generators|Create configurable PNG QR codes from text or URLs.|qr|qr,code,url,link,scan|server||yes|barcode-generator,password-generator
barcode-generator|Barcode Generator|Generators|Generate Code 128 PNG barcodes from text.|barcode|barcode,code 128,label,sku|server|||qr-generator,uuid-generator
password-generator|Password Generator|Generators|Generate strong passwords locally with cryptographically secure randomness.|keyboard|password,secure,random,crypto|client|generator|yes|random-string-generator,username-generator
username-generator|Username Generator|Generators|Generate memorable username ideas locally with secure randomness.|keyboard|username,name,handle,random|client|generator||password-generator,uuid-generator
uuid-generator|UUID Generator|Generators|Generate one or many standards-compliant UUID v4 values locally.|barcode|uuid,guid,v4,identifier|client|generator||random-string-generator,hash-generator
random-number-generator|Random Number Generator|Generators|Generate unbiased integers within a chosen inclusive range.|keyboard|random,number,integer,range,crypto|client|generator||random-string-generator,decision-maker
random-string-generator|Random String Generator|Generators|Generate random strings from configurable character sets securely.|keyboard|random,string,token,characters,crypto|client|generator||password-generator,uuid-generator
color-palette-generator|Color Palette Generator|Generators|Generate harmonious HSL color palettes locally.|image|color,palette,design,hex,hsl|client|generator||gradient-generator,color-converter
gradient-generator|Gradient Generator|Generators|Build, preview, and copy CSS linear gradients.|image|gradient,css,color,linear|client|generator||color-palette-generator,color-converter
favicon-generator|Favicon Generator|Generators|Create and download a square PNG favicon from text and colors.|image|favicon,icon,png,website|client|generator||color-palette-generator,image-resizer
typing-test|Typing Speed Test|Productivity|Measure typing speed and accuracy in a timed local test.|keyboard|typing,wpm,keyboard,speed,accuracy|client||yes|pomodoro-timer,text-analyzer
pomodoro-timer|Pomodoro Timer|Productivity|Run configurable focus and break sessions in your browser.|keyboard|pomodoro,focus,break,timer|client|productivity||countdown-timer,to-do-list
stopwatch|Stopwatch|Productivity|Start, pause, lap, and reset a precise browser stopwatch.|keyboard|stopwatch,timer,lap,time|client|productivity||countdown-timer,pomodoro-timer
countdown-timer|Countdown Timer|Productivity|Run a configurable countdown with a visible completion alert.|keyboard|countdown,timer,alarm,minutes|client|productivity||stopwatch,pomodoro-timer
to-do-list|To-Do List|Productivity|Keep a persistent browser-local task list with completion states.|keyboard|todo,task,list,local storage|client|productivity||notes,habit-counter
notes|Notes|Productivity|Write autosaved private notes stored only in this browser.|keyboard|notes,notepad,autosave,local|client|productivity||to-do-list,text-cleaner
habit-counter|Habit Counter|Productivity|Track repeat counts for habits locally without an account.|keyboard|habit,counter,tracker,local|client|productivity||to-do-list,pomodoro-timer
random-picker|Random Picker|Productivity|Pick one item fairly from a line-separated list.|keyboard|random,picker,choice,list|client|productivity||decision-maker,random-number-generator
decision-maker|Decision Maker|Productivity|Make a fair yes/no choice or pick among your options.|keyboard|decision,yes no,choice,random|client|productivity||random-picker,random-number-generator
expense-tracker|Expense Tracker|Finance|Track income, expenses, and monthly balances locally.|wallet|expense,money,budget,finance,income,csv|client||yes|budget-planner,split-bill-calculator
budget-planner|Budget Planner|Finance|Plan category budgets and compare them with monthly income locally.|wallet|budget,income,category,plan|client|finance||expense-tracker,savings-goal-calculator
savings-goal-calculator|Savings Goal Calculator|Finance|Estimate monthly savings and time needed to reach a goal.|wallet|savings,goal,monthly,target|client|finance||budget-planner,compound-interest-calculator
emi-calculator|EMI / Loan Calculator|Finance|Estimate fixed monthly loan payments and total interest.|wallet|emi,loan,payment,interest|client|finance||loan-calculator,budget-planner
split-bill-calculator|Split Bill Calculator|Finance|Split a bill, tax, and tip evenly across a group.|wallet|split,bill,tip,people|client|finance||tip-calculator,expense-tracker
currency-calculator|Currency Calculator|Finance|Convert currencies using a rate you provide, with no stale rate claims.|wallet|currency,exchange,rate,convert|client|finance||unit-converter,budget-planner
gif-maker|GIF Maker|Media|Turn an ordered image sequence into an animated GIF.|gif|gif,animation,image,frames|server|||image-resizer,image-compressor
text-to-speech|Text to Speech|Media|Convert text into MP3 speech through the external gTTS service.|speech|tts,speech,audio,voice|external|||audio-format-information,text-analyzer
audio-format-information|Audio Format Information|Media|Inspect browser-reported audio type, size, and duration locally.|speech|audio,format,duration,metadata,mime|client|media||text-to-speech,gif-maker
"""


_CALCULATOR_DATA = """
percentage-calculator|Percentage Calculator|Calculate percentages, percentage changes, and proportions.|percentage,percent,change|yes
discount-calculator|Discount Calculator|Calculate a sale price and savings from a percentage discount.|discount,sale,savings|
tip-calculator|Tip Calculator|Calculate a tip and total, including an optional group split.|tip,gratuity,split|
age-calculator|Age Calculator|Calculate age in completed years, months, and days.|age,birthday,date|
date-difference-calculator|Date Difference Calculator|Find the exact duration between two calendar dates.|date,difference,days|
time-duration-calculator|Time Duration Calculator|Find elapsed hours and minutes between two times.|time,duration,hours,minutes|
unit-converter|Unit Converter|Convert common length, weight, temperature, data, and speed units.|unit,convert,measurement|yes
length-converter|Length Converter|Convert metric, imperial, and nautical length units.|length,meter,feet,mile|
weight-converter|Weight Converter|Convert kilograms, grams, pounds, and ounces.|weight,mass,kg,pound|
temperature-converter|Temperature Converter|Convert Celsius, Fahrenheit, and Kelvin accurately.|temperature,celsius,fahrenheit,kelvin|
data-storage-converter|Data Storage Converter|Convert decimal and binary data storage units.|data,storage,bytes,megabyte|
speed-converter|Speed Converter|Convert common metric, imperial, and nautical speed units.|speed,mph,kph,knot|
loan-calculator|Loan Calculator|Estimate monthly payment, total payment, and loan interest.|loan,payment,interest|yes
compound-interest-calculator|Compound Interest Calculator|Calculate growth with configurable compounding and contributions.|compound,interest,investment|
simple-interest-calculator|Simple Interest Calculator|Calculate simple interest and final amount.|simple,interest,principal|
tax-calculator|GST / Tax Calculator|Add or extract a configurable percentage of tax.|gst,tax,vat,inclusive|
profit-margin-calculator|Profit Margin Calculator|Calculate profit, margin, and markup from cost and revenue.|profit,margin,markup|
fuel-cost-calculator|Fuel Cost Calculator|Estimate trip fuel use, total cost, and cost per traveler.|fuel,trip,mileage,cost|
"""


def _parse_rows(data):
    return [line.split("|") for line in data.strip().splitlines() if line.strip()]


TOOLS = [_tool(*row) for row in _parse_rows(_DATA)]
for slug, name, description, keywords, popular in _parse_rows(_CALCULATOR_DATA):
    TOOLS.append(_tool(slug, name, "Calculators", description, "wallet", keywords,
                       group="calculator", popular=popular,
                       related="unit-converter,percentage-calculator,loan-calculator"))


PDF_PUBLIC_ROUTES = {
    slug: f"/{slug}"
    for slug in {
        "pdf-to-jpg", "pdf-to-png", "pdf-to-word", "pdf-to-excel", "pdf-to-powerpoint",
        "word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf", "jpg-to-pdf", "png-to-pdf",
    }
}
PDF_SUBCATEGORIES = {
    "Create & Combine": {"pdf-merger", "images-to-pdf", "jpg-to-pdf", "png-to-pdf"},
    "Conversion & Export": {
        "pdf-to-jpg", "pdf-to-png", "pdf-to-word", "pdf-to-excel", "pdf-to-powerpoint",
        "word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf",
    },
    "Organize Pages": {"pdf-splitter", "rotate-pdf", "delete-pdf-pages", "extract-pdf-pages", "reorder-pdf-pages"},
    "Security & Metadata": {"protect-pdf", "unlock-pdf", "pdf-metadata"},
    "Optimization & Repair": {"pdf-compressor", "pdf-inspector"},
}
for tool in TOOLS:
    if tool["slug"] in PDF_PUBLIC_ROUTES:
        tool["route"] = PDF_PUBLIC_ROUTES[tool["slug"]]
    tool["subcategory"] = next(
        (name for name, slugs in PDF_SUBCATEGORIES.items() if tool["slug"] in slugs),
        None,
    )

for slug, title, description in (
    ("pdf-to-word", "PDF to Word Converter — Free DOCX Export | Toolbox", "Convert a PDF to DOCX with structured text and supported image extraction. Files are processed temporarily and not retained."),
    ("pdf-to-excel", "PDF to Excel Converter — Extract Tables to XLSX | Toolbox", "Detect structured tables in a PDF and export them to a clean XLSX workbook with separate worksheets."),
    ("pdf-to-powerpoint", "PDF to PowerPoint Converter — PDF Pages to PPTX | Toolbox", "Convert PDF pages into a faithful PowerPoint presentation with one page image per slide."),
):
    tool = next(item for item in TOOLS if item["slug"] == slug)
    tool["seo_title"] = title
    tool["seo_description"] = description


def get_tools(status=None):
    items = TOOLS if status is None else [tool for tool in TOOLS if tool["status"] == status]
    return list(items)


def get_tool(slug):
    return next((tool for tool in TOOLS if tool["slug"] == slug), None)


def get_popular_tools():
    return sorted((tool for tool in TOOLS if tool["popular"]),
                  key=lambda tool: tool["popularity"], reverse=True)


def get_categories():
    return list(CATEGORY_INFO)


def get_category(slug):
    for name, (category_slug, description) in CATEGORY_INFO.items():
        if category_slug == slug:
            return {"name": name, "slug": category_slug, "description": description}
    return None


def get_tools_by_category():
    return {category: [tool for tool in TOOLS if tool["category"] == category]
            for category in get_categories()}


def get_related_tools(slug, limit=4):
    tool = get_tool(slug)
    if not tool:
        return []
    chosen = []
    for related_slug in tool["related"]:
        other = get_tool(related_slug)
        if other and other["slug"] != slug and other not in chosen:
            chosen.append(other)
    for other in TOOLS:
        if len(chosen) >= limit:
            break
        if other["category"] == tool["category"] and other["slug"] != slug and other not in chosen:
            chosen.append(other)
    return chosen[:limit]


def get_active_tool_urls():
    return [tool["route"] for tool in TOOLS if tool["status"] == STATUS_AVAILABLE]


def get_client_tools():
    return [tool for tool in TOOLS if tool.get("client_group")]
