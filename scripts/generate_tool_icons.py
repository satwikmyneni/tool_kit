"""Generate the semantic SVG card icons used outside PDF & Documents."""

from html import escape
from pathlib import Path


COLOR = "#0f5c4c"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "app" / "static" / "icons"

# slug|base motif|short visual mark|operation detail
SPECS = """
background-remover|photo|BG|erase
image-compressor|photo|ZIP|compress
image-resizer|photo|PX|resize
image-converter|photo|ALT|swap
image-cropper|photo|CUT|crop
image-rotator|photo|90|rotate
image-flipper|photo|FLIP|flip
image-metadata|photo|EXIF|info
image-format-optimizer|photo|OPT|check
image-color-picker|photo|HEX|target
text-analyzer|document|TXT|analyze
case-converter|document|Aa|swap
text-cleaner|document|CLR|spark
text-diff|document|DIFF|diff
lorem-ipsum-generator|document|LOR|paragraph
markdown-previewer|document|MD|eye
json-toolkit|terminal|{}|code
base64-toolkit|terminal|64|swap
url-toolkit|terminal|URL|link
hash-generator|terminal|#|hash
timestamp-converter|terminal|TS|clock
regex-tester|terminal|.*|test
code-formatter|terminal|</>|format
color-converter|terminal|RGB|palette
jwt-decoder|terminal|JWT|lock
query-string-parser|terminal|?|query
html-entity-toolkit|terminal|&;|code
qr-generator|generator|QR|grid
barcode-generator|generator|BAR|barcode
password-generator|generator|PW|lock
username-generator|generator|@|user
uuid-generator|generator|ID|key
random-number-generator|generator|#|dice
random-string-generator|generator|Aa|dice
color-palette-generator|generator|RGB|palette
gradient-generator|generator|GRD|gradient
favicon-generator|generator|ICO|spark
percentage-calculator|calculator|%|ratio
discount-calculator|calculator|SALE|tag
tip-calculator|calculator|TIP|receipt
age-calculator|calculator|AGE|calendar
date-difference-calculator|calculator|DAYS|calendar
time-duration-calculator|calculator|TIME|clock
unit-converter|calculator|UNIT|swap
length-converter|calculator|CM|ruler
weight-converter|calculator|KG|scale
temperature-converter|calculator|C|thermometer
data-storage-converter|calculator|GB|database
speed-converter|calculator|KMH|gauge
loan-calculator|calculator|LOAN|bank
compound-interest-calculator|calculator|CI|growth
simple-interest-calculator|calculator|SI|coin
tax-calculator|calculator|TAX|receipt
profit-margin-calculator|calculator|PROF|chart
fuel-cost-calculator|calculator|FUEL|fuel
typing-test|task|WPM|keyboard
pomodoro-timer|task|25|timer
stopwatch|task|SW|stopwatch
countdown-timer|task|T-|hourglass
to-do-list|task|TODO|checks
notes|task|NOTE|note
habit-counter|task|HAB|repeat
random-picker|task|PICK|cursor
decision-maker|task|Y/N|decision
expense-tracker|money|EXP|minus
budget-planner|money|BUD|chart
savings-goal-calculator|money|SAVE|target
emi-calculator|money|EMI|calendar
split-bill-calculator|money|SPLIT|split
currency-calculator|money|FX|swap
gif-maker|media|GIF|frames
text-to-speech|media|TTS|sound
audio-format-information|media|WAV|wave
""".strip()


BASES = {
    "photo": '<rect x="3" y="5" width="24" height="20" rx="2"/><circle cx="8" cy="10" r="1.4"/><path d="m4.5 22 5.5-5 3.5 3 4-4 3.5 3"/>',
    "document": '<path d="M6 3.5h13l5 5v20H6zM19 3.5v5h5"/><path d="M9 23h7M9 26h5"/>',
    "terminal": '<rect x="2.5" y="5" width="27" height="22" rx="2.5"/><path d="M2.5 10h27M6 7.5h.01M9 7.5h.01"/>',
    "generator": '<rect x="5" y="5" width="22" height="22" rx="5"/><path d="m4 8-1.2-1.2M28 24l1.2 1.2M24 4l1.2-1.2"/>',
    "calculator": '<rect x="6" y="2.5" width="20" height="27" rx="2.5"/><rect x="9" y="6" width="14" height="5" rx="1"/><path d="M10 25h3M16 25h2M21 25h1"/>',
    "task": '<path d="M8 5h16v23H8z"/><path d="M12 5V3h8v4h-8zM11 23h8M11 26h6"/>',
    "money": '<path d="M3 8h23a3 3 0 0 1 3 3v14H6a3 3 0 0 1-3-3z"/><path d="M3 12h26M23 17h6v5h-6a2.5 2.5 0 0 1 0-5z"/>',
    "media": '<rect x="3" y="5" width="26" height="22" rx="3"/><path d="M3 10h26M7 7.5h.01M10 7.5h.01"/>',
}


DETAILS = {
    "erase": '<path d="m20 24 4.5-4.5 3 3-3.5 3.5h-3zM24.5 19.5l3 3"/>',
    "compress": '<path d="m20 19 3 3M20 22h3v-3M28 19l-3 3M25 19v3h3"/>',
    "resize": '<path d="m20 25 7-7M21 18h6v6M10 8 4 14M4 8v6h6"/>',
    "swap": '<path d="M19 20h8l-2-2M27 24h-8l2 2"/>',
    "crop": '<path d="M20 17v8h8M23 14v8h8"/>',
    "rotate": '<path d="M20 24a5 5 0 1 0 1-6M21 15v4h4"/>',
    "flip": '<path d="M23 16v11M20 19l-3 3 3 3M26 19l3 3-3 3"/>',
    "info": '<circle cx="24" cy="22" r="5"/><path d="M24 21v4M24 18.5h.01"/>',
    "check": '<circle cx="24" cy="22" r="5"/><path d="m21.5 22 1.6 1.7 3.3-3.7"/>',
    "target": '<circle cx="24" cy="22" r="5"/><circle cx="24" cy="22" r="2"/><path d="M24 15v3M24 26v3M17 22h3M28 22h3"/>',
    "analyze": '<path d="M19 25v-4M22 25v-7M25 25v-10M18 14h8"/>',
    "spark": '<path d="m23 17 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>',
    "diff": '<path d="M20 18h7M23.5 14.5v7M20 25h7"/>',
    "paragraph": '<path d="M10 13h9M10 16h9M10 19h6"/>',
    "eye": '<path d="M18 22s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z"/><circle cx="24" cy="22" r="1.5"/>',
    "code": '<path d="m20 19-3 3 3 3M27 19l3 3-3 3"/>',
    "link": '<path d="M20 23h-1.5a3 3 0 0 1 0-6H22M26 17h1.5a3 3 0 0 1 0 6H24M20 20h6"/>',
    "hash": '<path d="M20 17l-2 10M26 17l-2 10M16.5 21h11M15.5 24h11"/>',
    "clock": '<circle cx="24" cy="21" r="5.5"/><path d="M24 17.5V21l2.5 1.5"/>',
    "test": '<path d="M18 24h3l1.5-6 3 9 1.5-3h3"/>',
    "format": '<path d="M18 18h11M21 21h8M18 24h11M21 27h8"/>',
    "palette": '<circle cx="20" cy="22" r="2"/><circle cx="25" cy="18" r="2"/><circle cx="28" cy="23" r="2"/>',
    "lock": '<rect x="19" y="20" width="10" height="7" rx="1.5"/><path d="M21 20v-2a3 3 0 0 1 6 0v2M24 23v2"/>',
    "query": '<path d="M18 18h10M18 22h7M18 26h9"/><circle cx="28" cy="18" r="1"/>',
    "grid": '<path d="M19 17h4v4h-4zM25 17h4v4h-4zM19 23h4v4h-4zM26 24h2v2h-2z"/>',
    "barcode": '<path d="M18 17v10M20.5 17v10M24 17v10M28 17v10M30 17v10"/>',
    "user": '<circle cx="24" cy="19" r="2.5"/><path d="M19 27a5 5 0 0 1 10 0"/>',
    "key": '<circle cx="21" cy="22" r="3"/><path d="m24 22 6-6M27 19l2 2"/>',
    "dice": '<rect x="19" y="17" width="10" height="10" rx="2"/><path d="M22 20h.01M26 24h.01M26 20h.01M22 24h.01"/>',
    "gradient": '<rect x="18" y="17" width="11" height="10" rx="1"/><path d="M19 26 28 18M22 27l7-7"/>',
    "ratio": '<circle cx="20" cy="19" r="2"/><circle cx="27" cy="25" r="2"/><path d="m19 27 9-10"/>',
    "tag": '<path d="m18 18 5-3h6v6l-7 7-5-5z"/><circle cx="26" cy="18" r="1"/>',
    "receipt": '<path d="M18 16h11v12l-2-1-2 1-2-1-2 1-3-1zM21 20h5M21 23h5"/>',
    "calendar": '<rect x="18" y="17" width="11" height="10" rx="1"/><path d="M18 20h11M21 15v4M26 15v4"/>',
    "ruler": '<path d="m18 25 8-8 4 4-8 8zM23 20l2 2M26 18l2 2"/>',
    "scale": '<path d="M19 27h10l-1-10h-8zM22 21a2 2 0 0 1 4 0"/>',
    "thermometer": '<path d="M24 17v6a3 3 0 1 0 4 0v-6a2 2 0 0 0-4 0zM26 20v5"/>',
    "database": '<ellipse cx="24" cy="18" rx="5" ry="2.5"/><path d="M19 18v7c0 3 10 3 10 0v-7M19 22c0 3 10 3 10 0"/>',
    "gauge": '<path d="M18 26a7 7 0 0 1 12 0M24 23l4-4"/><path d="M20 23h.01M24 20h.01M28 23h.01"/>',
    "bank": '<path d="m18 20 6-4 6 4M19 21h10M20 21v5M24 21v5M28 21v5M18 27h12"/>',
    "growth": '<path d="M18 27v-4h3v4M23 27v-7h3v7M28 27v-10h3M18 19l4-3 3 2 5-5"/>',
    "coin": '<circle cx="24" cy="22" r="5"/><path d="M24 18.5v7M26 20h-3a1 1 0 0 0 0 2h2a1 1 0 0 1 0 2h-3"/>',
    "chart": '<path d="M18 27v-4h3v4M23 27v-8h3v8M28 27v-11h3"/>',
    "fuel": '<path d="M19 27V16h7v11M18 27h9M21 19h3M26 18h2l2 3v5a1.5 1.5 0 0 1-3 0v-3"/>',
    "keyboard": '<rect x="17" y="18" width="14" height="9" rx="1.5"/><path d="M20 21h.01M23 21h.01M26 21h.01M29 21h.01M20 24h8"/>',
    "timer": '<circle cx="24" cy="22" r="5"/><path d="M24 17v5l3 1M22 15h4"/>',
    "stopwatch": '<circle cx="24" cy="22" r="5.5"/><path d="M24 16.5V14M22 14h4M28 18l2-2M24 22l2-2"/>',
    "hourglass": '<path d="M20 16h8M20 28h8M21 16c0 4 6 4 6 8 0 2-2 3-3 4-1-1-3-2-3-4 0-4 6-4 6-8"/>',
    "checks": '<path d="m18 19 1.5 1.5L22 18M24 19h6M18 24l1.5 1.5L22 23M24 24h6"/>',
    "note": '<path d="M19 16h10v9l-3 3h-7zM26 28v-3h3M21 20h6M21 23h5"/>',
    "repeat": '<path d="M19 20a5 5 0 0 1 9-1l2 2M30 17v4h-4M29 24a5 5 0 0 1-9 1l-2-2M18 27v-4h4"/>',
    "cursor": '<path d="m19 16 4 12 2-5 5-2z"/>',
    "decision": '<path d="M18 18h4l2 3 2-3h4M24 21v6M21 25l3 2 3-2"/>',
    "minus": '<circle cx="24" cy="22" r="5"/><path d="M21 22h6"/>',
    "split": '<path d="M18 19h5l2 3 2-3h4M25 22v5M21 25l4 2 4-2"/>',
    "frames": '<rect x="17" y="16" width="9" height="8" rx="1"/><rect x="21" y="20" width="9" height="8" rx="1"/>',
    "sound": '<path d="M18 20h3l4-3v10l-4-3h-3zM27 20a4 4 0 0 1 0 4M29 18a7 7 0 0 1 0 6"/>',
    "wave": '<path d="M17 22h2l1-4 2 8 2-11 2 8 1-3 2 2h2"/>',
}


def mark_svg(mark: str) -> str:
    font_size = 6.3 if len(mark) <= 2 else 5.1 if len(mark) == 3 else 4.2
    return (
        f'<text x="14" y="18.5" text-anchor="middle" fill="{COLOR}" stroke="none" '
        f'font-family="Arial,sans-serif" font-size="{font_size}" font-weight="700">'
        f'{escape(mark)}</text>'
    )


def render_svg(base: str, mark: str, detail: str) -> str:
    body = BASES[base] + mark_svg(mark) + DETAILS[detail]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" '
        f'stroke="{COLOR}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">\n'
        f'  {body}\n</svg>\n'
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = 0
    seen = set()
    for line in SPECS.splitlines():
        slug, base, mark, detail = line.split("|", 3)
        if slug in seen:
            raise ValueError(f"Duplicate icon specification: {slug}")
        seen.add(slug)
        (OUTPUT_DIR / f"tool-{slug}.svg").write_text(
            render_svg(base, mark, detail), encoding="utf-8", newline="\n"
        )
        generated += 1
    print(f"Generated {generated} tool icons in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
