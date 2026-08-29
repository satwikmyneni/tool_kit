import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flask_wtf.csrf import CSRFError

from config import get_config
from app.registry import CATEGORY_INFO, get_tools
from app.utils.errors import ToolError
from app.utils.security import apply_security_headers

csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address, default_limits=[])


def create_app(config_name=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(config_name))
    _validate_config(app)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    (Path(app.instance_path) / "tmp").mkdir(parents=True, exist_ok=True)

    csrf.init_app(app)
    limiter.init_app(app)
    _configure_logging(app)
    _register_blueprints(app)
    _register_context(app)
    _register_error_handlers(app)
    _register_security(app)

    return app


def _validate_config(app):
    if not app.config.get("TESTING") and not app.debug:
        secret = app.config.get("SECRET_KEY")
        if not secret or secret == "dev-only-change-me":
            raise RuntimeError(
                "Production requires SECRET_KEY to be set to a long random value."
            )


def _configure_logging(app):
    if app.config.get("TESTING"):
        return

    log_path = Path(app.instance_path) / "toolbox.log"
    handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=3)
    handler.setLevel(logging.INFO)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)


def _register_blueprints(app):
    from app.routes.barcode import bp as barcode_bp
    from app.routes.expense import bp as expense_bp
    from app.routes.gif import bp as gif_bp
    from app.routes.image import bp as image_bp
    from app.routes.main import bp as main_bp
    from app.routes.pdf import bp as pdf_bp
    from app.routes.qr import bp as qr_bp
    from app.routes.tts import bp as tts_bp
    from app.routes.typing_test import bp as typing_bp
    from app.routes.browser_tools import bp as browser_tools_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(qr_bp)
    app.register_blueprint(barcode_bp)
    app.register_blueprint(typing_bp)
    app.register_blueprint(pdf_bp)
    app.register_blueprint(image_bp)
    app.register_blueprint(gif_bp)
    app.register_blueprint(tts_bp)
    app.register_blueprint(expense_bp)
    app.register_blueprint(browser_tools_bp)


def _register_context(app):
    @app.context_processor
    def inject_globals():
        return {
            "tools": get_tools(),
            "category_info": CATEGORY_INFO,
            "base_url": app.config["BASE_URL"],
            "ads_enabled": app.config["ADS_ENABLED"],
            "analytics_provider": app.config["ANALYTICS_PROVIDER"],
            "limits": {
                "qr_chars": app.config["MAX_QR_CHARS"],
                "barcode_chars": app.config["MAX_BARCODE_CHARS"],
                "tts_chars": app.config["MAX_TTS_CHARS"],
                "pdf_files": app.config["MAX_PDF_FILES"],
                "pdf_file_bytes": app.config["MAX_PDF_FILE_BYTES"],
                "pdf_pages": app.config["MAX_PDF_PAGES"],
                "pdf_preview_pages": app.config["PDF_PREVIEW_MAX_PAGES"],
                "document_file_bytes": app.config["MAX_DOCUMENT_FILE_BYTES"],
                "image_bytes": app.config["MAX_IMAGE_BYTES"],
                "image_files": app.config["MAX_IMAGE_FILES"],
                "gif_frames": app.config["MAX_GIF_FRAMES"],
                "image_edge": app.config["MAX_IMAGE_EDGE"],
            },
        }


def _wants_json():
    return request.headers.get("X-Requested-With") == "Toolbox"


def _register_error_handlers(app):
    @app.errorhandler(CSRFError)
    def csrf_error(_error):
        message = "Your session expired. Refresh the page and try again."
        if _wants_json() or request.path.startswith("/tools/"):
            return jsonify({"error": message}), 400
        return render_template("errors/400.html", message=message), 400

    @app.errorhandler(404)
    def not_found(_error):
        if _wants_json():
            return jsonify({"error": "That page could not be found."}), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(413)
    def too_large(_error):
        message = "That upload is too large. Please use smaller files and try again."
        if _wants_json():
            return jsonify({"error": message}), 413
        return render_template("errors/413.html"), 413

    @app.errorhandler(429)
    def too_many(_error):
        message = "This tool is busy. Please wait a moment and try again."
        if _wants_json():
            return jsonify({"error": message}), 429
        return render_template("errors/429.html"), 429

    @app.errorhandler(ToolError)
    def tool_error(error):
        if _wants_json() or request.path.startswith("/tools/"):
            return jsonify({"error": error.message}), error.status_code
        return render_template("errors/500.html"), error.status_code

    @app.errorhandler(500)
    def server_error(error):
        app.logger.exception("Unhandled server error: %s", error)
        message = "Something went wrong. Please try again."
        if _wants_json():
            return jsonify({"error": message}), 500
        return render_template("errors/500.html"), 500


def _register_security(app):
    @app.after_request
    def set_headers(response):
        return apply_security_headers(response)
