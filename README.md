# Toolbox

Toolbox is a responsive Flask website with eight focused, account-free utilities. It uses server-side Flask/Jinja pages, a shared CSS design system, and small vanilla JavaScript modules. Tool metadata lives in one registry and drives the homepage, directory, related-tool cards, and sitemap.

## Tools

- **QR Code Generator** — creates configurable PNG QR codes with `qrcode`.
- **Barcode Generator** — creates Code 128 PNG barcodes with `python-barcode`.
- **Typing Speed Test** — measures WPM, accuracy, characters, and errors entirely in the browser.
- **PDF Merger** — validates and combines PDFs in the selected order with `pypdf`.
- **Image Background Remover** — creates a transparent PNG with a lazy-loaded `rembg` CPU model.
- **GIF Maker** — validates, orders, normalizes, and encodes image frames with Pillow.
- **Text to Speech** — creates playable MP3 audio through the external gTTS service.
- **Expense Tracker** — stores, filters, edits, charts, imports, and exports transactions in browser `localStorage`.

The site also includes instant registry-based search, category browsing, related tools, responsive layouts, accessible loading/error states, security headers, CSRF protection, rate limits, `/robots.txt`, and `/sitemap.xml`.

## Requirements

- Python 3.11 or newer
- `pip`
- Internet access during dependency installation
- Internet access on the first background-remover run unless the configured model is already cached
- Internet access whenever Text to Speech is used
- Node.js is optional and is used only for the browser-independent JavaScript tests

## Setup

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

Change `SECRET_KEY` in `.env` to a long random value. Never commit `.env`.

## Run locally

```bash
python app.py
```

Open <http://127.0.0.1:5000>. The development entry point binds only to localhost.

## Architecture

```text
app.py                  application entry point
config.py               environment-specific settings and processing limits
app/__init__.py         application factory, extensions, errors, logging, headers
app/registry.py         canonical metadata for all eight tools
app/routes/             thin page and generation endpoints
app/services/           testable generation, upload, and validation logic
app/templates/          Jinja pages and shared partials
app/static/css/         shared responsive design system
app/static/js/          tool UI modules and browser-independent logic
tests/                  Flask, service, registry, security, and JavaScript tests
instance/tmp/           private temporary-workspace root; never publicly served
```

Generated downloads are returned from memory. Input is not written to a public upload directory, user filenames are never used as server paths, and the temporary-workspace helper removes its generated directory on exit.

## Configuration

`.env.example` documents every supported setting. The principal variables are:

| Variable | Purpose |
| --- | --- |
| `FLASK_ENV` | `development`, `testing`, or `production` |
| `SECRET_KEY` | Required long random secret for production CSRF/session signing |
| `BASE_URL` | Public origin used for canonical and sitemap URLs |
| `MAX_CONTENT_LENGTH` | Maximum total HTTP request size in bytes |
| `MAX_PDF_FILES`, `MAX_PDF_FILE_BYTES` | PDF count and per-file limits |
| `MAX_IMAGE_BYTES`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_EDGE` | Image upload and decode limits |
| `MAX_GIF_FRAMES`, `MAX_GIF_TOTAL_PIXELS` | GIF frame and aggregate output-memory limits |
| `MAX_QR_CHARS`, `MAX_BARCODE_CHARS`, `MAX_TTS_CHARS` | Text limits |
| `TTS_TIMEOUT_SECONDS` | External gTTS connect/read timeout |
| `REMBG_MODEL` | Lazy-loaded rembg model; defaults to the lightweight `u2netp` |
| `RATELIMIT_STORAGE_URI` | Limiter backend; defaults to process-local memory |
| `RATELIMIT_*` | Per-tool limits for expensive generation endpoints |

Invalid integer environment values fall back to safe defaults. Production startup fails fast if `SECRET_KEY` is missing or still uses the development default.

## Background remover

The CPU inference runtime is installed by the `rembg[cpu]` requirement. The model is not loaded at application startup. On the first removal request, rembg may download the model selected by `REMBG_MODEL`; production deployments without outbound access must pre-provision that model in rembg's cache. The first request has a cold-start cost, and CPU processing can be slow for large images.

If import, model download, or initialization fails, the endpoint logs technical details and returns a safe 503 response. It never substitutes a fake result. Successful output is decoded again and must contain real transparency before it is returned.

## Text to Speech and data handling

Typing-test keystrokes stay in the page. Expense transactions stay in that browser's `localStorage` and are never posted to Flask.

QR text, barcode text, PDFs, and images used for GIF/background processing are submitted to the Toolbox server for the duration of the request. Generated responses use `Cache-Control: no-store`; inputs and outputs are not published as permanent URLs.

Text to Speech is different: gTTS sends submitted text to Google's external text-to-speech service. Do not use it for confidential content. Toolbox returns a failure when the provider or network is unavailable and does not claim local processing.

See the in-app **About & data** page for the user-facing summary.

## Security

- Flask-WTF CSRF protection on every state-changing endpoint
- Per-tool Flask-Limiter rules
- total-request, file-count, per-file, pixel, edge, and aggregate GIF limits
- filename-extension, MIME metadata, magic-byte, and actual parser/decoder checks
- encrypted/corrupt PDF rejection and decompression-bomb protection
- generated names for private temporary workspaces and cleanup on exit
- safe JSON errors with technical exceptions kept in rotating instance logs
- Content Security Policy, clickjacking, MIME-sniffing, referrer, and permissions headers
- secure, HTTP-only, SameSite cookies in production

For multiple production workers or instances, replace `memory://` with a supported shared Flask-Limiter backend and install its client dependency. Process-local limits are not coordinated across workers.

## Tests

```bash
pytest
```

The suite generates and parses real QR, barcode, PDF, image, and GIF data. TTS and background-removal service tests use deterministic providers so CI does not depend on a network or model cache. When Node.js is available, pytest also executes the typing-calculation and expense-ledger JavaScript modules; those tests are skipped otherwise.

## Deployment

Set at least:

```dotenv
FLASK_ENV=production
SECRET_KEY=a-long-random-production-secret
BASE_URL=https://tools.example.com
```

Run `app:create_app()` behind a production WSGI server and HTTPS reverse proxy; do not use Flask's development server. Give the process write access to `instance/` for rotating logs and private temporary workspaces. Plan memory and request timeouts for Pillow and rembg, allow outbound HTTPS for gTTS and initial model retrieval, and use a shared limiter backend when scaling beyond one process.

## Known limitations

- gTTS availability, voices, and latency depend on an external service and network access.
- Background removal has a model-download/cold-start cost and is CPU-intensive without acceleration.
- Processing is synchronous and bounded; Toolbox intentionally does not provide a job queue for very large workloads.
- Expense data is device/browser-local. Clearing site data removes it unless the user exported a CSV backup.
- GIF creation accepts still PNG, JPEG, and WEBP frames; it is not a video editor.
