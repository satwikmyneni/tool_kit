import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


def _int_env(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    WTF_CSRF_ENABLED = True
    MAX_CONTENT_LENGTH = _int_env("MAX_CONTENT_LENGTH", 50 * 1024 * 1024)
    MAX_FORM_MEMORY_SIZE = MAX_CONTENT_LENGTH
    MAX_FORM_PARTS = 60
    TEMPLATES_AUTO_RELOAD = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SEND_FILE_MAX_AGE_DEFAULT = 31536000

    RATELIMIT_ENABLED = os.environ.get("RATELIMIT_ENABLED", "true").lower() != "false"
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_QR = os.environ.get("RATELIMIT_QR", "30 per minute")
    RATELIMIT_BARCODE = os.environ.get("RATELIMIT_BARCODE", "30 per minute")
    RATELIMIT_PDF = os.environ.get("RATELIMIT_PDF", "10 per minute")
    RATELIMIT_IMAGE = os.environ.get("RATELIMIT_IMAGE", "5 per minute")
    RATELIMIT_GIF = os.environ.get("RATELIMIT_GIF", "10 per minute")
    RATELIMIT_TTS = os.environ.get("RATELIMIT_TTS", "10 per minute")

    MAX_QR_CHARS = _int_env("MAX_QR_CHARS", 2000)
    MAX_BARCODE_CHARS = _int_env("MAX_BARCODE_CHARS", 80)
    MAX_TTS_CHARS = _int_env("MAX_TTS_CHARS", 5000)
    TTS_TIMEOUT_SECONDS = _int_env("TTS_TIMEOUT_SECONDS", 30)
    MAX_PDF_FILES = _int_env("MAX_PDF_FILES", 20)
    MAX_PDF_FILE_BYTES = _int_env("MAX_PDF_FILE_BYTES", 20 * 1024 * 1024)
    MAX_IMAGE_BYTES = _int_env("MAX_IMAGE_BYTES", 10 * 1024 * 1024)
    MAX_IMAGE_PIXELS = _int_env("MAX_IMAGE_PIXELS", 20_000_000)
    MAX_GIF_FRAMES = _int_env("MAX_GIF_FRAMES", 24)
    MAX_GIF_TOTAL_PIXELS = _int_env("MAX_GIF_TOTAL_PIXELS", 24_000_000)
    MAX_IMAGE_EDGE = _int_env("MAX_IMAGE_EDGE", 2000)
    REMBG_MODEL = os.environ.get("REMBG_MODEL", "u2netp")


class DevelopmentConfig(Config):
    DEBUG = True
    TEMPLATES_AUTO_RELOAD = True
    SESSION_COOKIE_SECURE = False
    SEND_FILE_MAX_AGE_DEFAULT = 0


class TestingConfig(Config):
    TESTING = True
    DEBUG = False
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False
    SECRET_KEY = "test-secret-key"
    BASE_URL = "http://localhost"
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024
    MAX_FORM_MEMORY_SIZE = 2 * 1024 * 1024
    MAX_PDF_FILE_BYTES = 512 * 1024
    MAX_IMAGE_BYTES = 512 * 1024


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name=None):
    env = name or os.environ.get("FLASK_ENV", "development")
    return config_by_name.get(env, DevelopmentConfig)
