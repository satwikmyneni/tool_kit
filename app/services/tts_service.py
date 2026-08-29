import io

from app.utils.errors import ToolError
from app.utils.validators import require_text

LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "hi": "Hindi",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
}


class TTSProvider:
    def synthesize(self, text, lang, slow, timeout=None):
        raise NotImplementedError


class GTTSProvider(TTSProvider):
    def synthesize(self, text, lang, slow, timeout=None):
        from gtts import gTTS
        from gtts.tts import gTTSError

        buffer = io.BytesIO()
        try:
            speech = gTTS(text=text, lang=lang, slow=slow, timeout=timeout or 30)
            speech.write_to_fp(buffer)
        except gTTSError as exc:
            raise ToolError(
                "Speech generation failed. Please try again.", status_code=502
            ) from exc
        except Exception as exc:
            raise ToolError(
                "Speech generation failed. Please try again.", status_code=502
            ) from exc
        return buffer.getvalue()


_provider = GTTSProvider()


def set_provider(provider):
    global _provider
    _provider = provider


def generate_speech(text, lang="en", slow=False, max_chars=5000, timeout=30):
    payload = require_text(
        text,
        "Enter some text to convert to speech.",
        max_length=max_chars,
        too_long_message="That text is too long. Shorten it and try again.",
    )
    language = (lang or "en").lower()
    if language not in LANGUAGES:
        raise ToolError("Choose a supported language.")
    data = _provider.synthesize(payload, language, bool(slow), timeout)
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise ToolError("Speech generation failed. Please try again.", status_code=502)
    return bytes(data)
