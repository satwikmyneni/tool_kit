# Toolbox

Toolbox is a production-oriented Flask utility platform built around one idea: **simple tools for everyday tasks**. It provides 85 focused, account-free pages covering 113 roadmap capabilities. Private text, calculations, generated secrets, notes, and finance data stay in the browser; bounded file operations use temporary request processing on the Flask server.

## Features

All cards in the central registry have `status = available` and link to working tools. Related functions are deliberately consolidated when a toolkit is clearer than duplicate pages.

### PDF & documents

- PDF merge; selected/range/every-page split with ZIP output; honest lossless stream/object compression
- image-to-PDF for ordered PNG, JPEG, and WEBP inputs with A4, Letter, auto size, orientation, margins, contain, and cover options
- rotate, delete, extract, and reorder pages using one-based ranges
- metadata inspection and editing
- AES-256 password protection and legitimate unlock with the correct password
- PDF structure, page count, encryption, metadata, and file-size validation/inspection

### Images and media

- ML background removal with lazy-loaded `rembg`
- image compression, resize, format conversion, crop, rotate, flip, metadata inspection/stripping, and smallest-format optimization
- browser-local image pixel color picker
- ordered image-sequence GIF creation
- gTTS speech generation with explicit external-provider disclosure
- browser-local audio type, size, and duration inspection

### Text and developer tools

- word, character, sentence, paragraph, and reading-time analysis
- upper, lower, title, and sentence case conversion
- trimming, line deduplication/sorting/reversal, empty-line and extra-space removal, find/replace, text reversal, and line diff
- Lorem Ipsum generation and safe lightweight Markdown preview
- JSON format/minify/validate with error location, Unicode Base64, URL encoding, and HTML entities
- SHA-256/384/512 hashing, Unix timestamp conversion, regex testing, query-string parsing/building
- safe local JWT payload/header decoding with no signature-validity claim
- HEX/RGB/HSL conversion and lightweight HTML/CSS/JavaScript structural formatting

### Generators

- QR and Code 128 barcode images
- cryptographically secure password, username, UUID v4, integer, and random-string generation
- HSL palettes, CSS gradients, Lorem Ipsum, and downloadable PNG favicons

Password and random-value tools use `crypto.getRandomValues()` or `crypto.randomUUID()`; generated secrets are never submitted to Flask.

### Calculators and converters

- percentage, percentage-of, percentage-change, discount, tip, age, calendar-date difference, and time duration
- general unit conversion plus dedicated length, weight, temperature, decimal/binary storage, and speed converters
- fixed-rate loan, compound interest with monthly contributions, simple interest, GST/tax add/extract, profit margin/markup, and metric fuel-cost estimates

Formulas and assumptions are shown with results. Financial output is general information, not advice or a guarantee.

### Productivity and finance

- typing speed test, Pomodoro timer, stopwatch with laps, countdown timer
- persistent browser-local to-do list, autosaved notes, habit counters, random picker, and decision maker
- local expense tracker with edit/delete/filter/month/category totals and CSV import/export
- local budget planner, savings-goal estimate, EMI estimate, bill/tax/tip split, and manual-rate currency conversion

### Platform experience

- canonical registry metadata for names, slugs, categories, routes, search keywords, popularity, status, processing model, SEO titles/descriptions, and related tools
- nine category landing pages, global instant search, `Ctrl/Cmd + K`, favorites, recently used tools, and related workflows
- responsive layouts, semantic forms, keyboard focus, live status/error regions, and remembered light/dark theme
- canonical and Open Graph metadata, JSON-LD, sitemap, robots file, and useful category/tool descriptions
- lightweight PWA manifest and a service worker that caches public static assets only
- disabled-by-default ad slots and a provider-neutral, data-minimal analytics event abstraction
- polished 400, 404, 413, 429, and 500 handling

## Architecture

```text
app.py                         localhost development entry point
config.py                      environment-backed limits and deployment settings
app/__init__.py                Flask factory, extensions, errors, headers, logging
app/registry.py                canonical metadata for all 85 public tool pages
app/routes/                    thin page and processing endpoints
app/services/                  bounded PDF, image, code, GIF, TTS, and file logic
app/templates/                 Jinja pages and shared accessible components
app/static/css/                responsive design system and theme variables
app/static/js/                 small page/category modules and testable utility cores
tests/                         route, service, security, edge, and Node-based JS tests
instance/tmp/                  private generated workspaces; never publicly served
```

The Flask application factory and blueprints are preserved. Backend routes validate input and delegate processing to services. Browser tool pages use one generic Jinja shell plus separate text, developer, generator, calculator, productivity, finance, media, and image modules.

## Requirements and setup

- Python 3.11 or newer
- `pip`
- Node.js only for optional JavaScript unit tests
- Internet access for dependency installation
- Internet access for gTTS requests
- Internet access on the first `rembg` use unless the configured model is pre-provisioned

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
python app.py
```

Open <http://127.0.0.1:5000>. Replace the example `SECRET_KEY`; never commit `.env`.

## Dependencies

- Flask, Jinja, Flask-WTF, and Flask-Limiter for the web layer, CSRF, and rate limiting
- Pillow for validated raster transforms, image-to-PDF, and GIF output
- pypdf for structural PDF processing
- cryptography for strong AES-256 PDF encryption support in pypdf
- qrcode and python-barcode for code images
- rembg with the CPU inference extra for background removal
- gTTS for external speech synthesis
- pytest for automated verification

No database, frontend framework, task queue, or FFmpeg installation is required.

## Configuration

`.env.example` is the canonical safe configuration reference.

| Variable | Purpose |
| --- | --- |
| `FLASK_ENV` | `development`, `testing`, or `production` |
| `SECRET_KEY` | Production CSRF/session-signing secret |
| `BASE_URL` | Public canonical/sitemap origin |
| `PRODUCT_TIER` | Future-ready `FREE`/`PRO` label; no current feature paywall |
| `ADS_ENABLED` | Enables empty integration slots only; default `false` |
| `ANALYTICS_PROVIDER` | Optional event integration label; empty is a no-op |
| `MAX_CONTENT_LENGTH` | Maximum total HTTP request size |
| `MAX_PDF_FILES`, `MAX_PDF_FILE_BYTES`, `MAX_PDF_PAGES` | PDF batch, byte, and page limits |
| `MAX_IMAGE_FILES`, `MAX_IMAGE_BYTES`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_EDGE` | Image batch, byte, decode, and dimension limits |
| `MAX_GIF_FRAMES`, `MAX_GIF_TOTAL_PIXELS` | GIF batch and aggregate-memory limits |
| `MAX_QR_CHARS`, `MAX_BARCODE_CHARS`, `MAX_TTS_CHARS` | Text limits |
| `TTS_TIMEOUT_SECONDS` | External gTTS timeout |
| `REMBG_MODEL` | Lazy-loaded model; default `u2netp` |
| `RATELIMIT_STORAGE_URI` | Limiter backend; process-local `memory://` by default |
| `RATELIMIT_*` | Per-operation rate limits for expensive endpoints |

Invalid integer environment values fall back to bounded defaults. Production startup fails if the development secret remains configured.

## Security and privacy

- CSRF protects state-changing routes; expensive endpoints have rate limits.
- File extension, MIME metadata, magic bytes, actual parser/decoder output, bytes, pixels, edges, pages, file counts, and aggregate GIF pixels are bounded.
- Pillow decompression-bomb checks and PDF parser errors produce user-safe responses.
- No request uses an uploaded filename as a filesystem path. Generated responses use `Cache-Control: no-store`.
- Security headers include CSP, clickjacking, MIME-sniffing, referrer, permissions, and secure production cookie controls.
- JWT decoding is local and explicitly unverified. Passwords and finance values stay in-browser.
- TTS is the one external processing path; its page and data-handling page disclose this.

The service worker only handles same-origin GET requests under `/static/`. It never caches HTML tool sessions, uploads, generated PDFs/images/audio, API responses, or browser storage.

## Background removal and TTS

`rembg` loads only when the background-removal service is called. Its first request may download `REMBG_MODEL`; offline production deployments must pre-provision the model cache. CPU inference has a cold-start and can be slow for complex images.

gTTS sends submitted text to Google's external service. Production must allow outbound HTTPS and set an appropriate timeout. Network/provider failures return a safe error; no synthetic result is substituted.

## Testing

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Tests generate and parse real PDFs, ZIPs, QR codes, barcodes, PNG/JPEG/WEBP images, transparency, GIFs, encryption, metadata, and page transformations. Node tests exercise browser-independent text, encoding, calculator, secure-generator, productivity, finance, typing, and expense logic. TTS and background-removal providers are deterministic in CI so tests do not require a network or model download.

## Deployment

Set at least:

```dotenv
FLASK_ENV=production
SECRET_KEY=a-long-random-production-secret
BASE_URL=https://tools.example.com
```

Run `app:create_app()` behind a production WSGI server and HTTPS reverse proxy; Flask's development server is not a production server. Give the process write access to `instance/` for rotating logs and private temporary workspaces. Use a supported shared Flask-Limiter backend for multiple workers, plan request/memory limits for Pillow and rembg, pre-provision the model when outbound downloads are unavailable, and allow gTTS outbound HTTPS if that tool is enabled.

## Known limitations and intentional exclusions

- PDF-to-JPG/PNG requires a real PDF renderer such as PDFium, MuPDF, or Poppler; none is silently assumed or bundled.
- PDF page-number overlays and text watermarks require a dependable PDF drawing layer. They are excluded rather than approximated with invalid content streams.
- Audio trimming is excluded because the project deliberately does not require FFmpeg or claim browser codec support it cannot guarantee.
- Lossless pypdf compression does not degrade embedded images and may produce little or no reduction for already optimized PDFs; the UI reports actual sizes.
- The code formatter is a lightweight structural formatter, not a standards-complete parser, linter, or minifier.
- Currency conversion uses a rate entered by the user and never presents bundled values as live rates.
- The PWA caches static application assets only; server-processed tools are not available offline.
- All processing is synchronous and bounded; large-job queues, authentication, cloud history, and a database are intentionally outside this release.
