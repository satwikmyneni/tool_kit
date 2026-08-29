from flask import Blueprint, current_app, render_template, request

from app import limiter
from app.services.tts_service import LANGUAGES, generate_speech
from app.utils.errors import ToolError
from app.utils.helpers import handle_tool_error, send_generated_file, tool_page_context

bp = Blueprint("tts", __name__)


@bp.route("/tools/text-to-speech")
def page():
    extra = {"languages": LANGUAGES}
    return render_template("tts/index.html", **tool_page_context("text-to-speech", extra))


@bp.route("/tools/text-to-speech/generate", methods=["POST"])
@limiter.limit(lambda: current_app.config["RATELIMIT_TTS"])
def generate():
    try:
        data = generate_speech(
            request.form.get("text"),
            lang=request.form.get("lang", "en"),
            slow=request.form.get("speed") == "slow",
            max_chars=current_app.config["MAX_TTS_CHARS"],
            timeout=current_app.config["TTS_TIMEOUT_SECONDS"],
        )
    except ToolError as error:
        return handle_tool_error(error)
    except Exception as error:
        current_app.logger.exception("TTS generation failed: %s", error)
        return handle_tool_error(ToolError("Something went wrong while generating audio. Please try again."))
    return send_generated_file(data, "toolbox-speech.mp3", "audio/mpeg")
