"""Tests for Text to Speech."""

import pytest

from app.services import tts_service
from app.utils.errors import ToolError


def test_tts_page_loads(client):
    response = client.get("/tools/text-to-speech")
    assert response.status_code == 200
    assert b"Text to Speech" in response.data
    assert b"gTTS" in response.data or b"Google" in response.data


def test_tts_empty_input(client):
    response = client.post(
        "/tools/text-to-speech/generate",
        data={"text": "", "lang": "en"},
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_tts_excessive_input(client):
    response = client.post(
        "/tools/text-to-speech/generate",
        data={"text": "x" * 6000, "lang": "en"},
    )
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data


def test_tts_valid_input_is_deterministic(client, monkeypatch):
    class Provider:
        def synthesize(self, text, lang, slow, timeout):
            assert (text, lang, slow, timeout) == ("Hello world", "en", False, 30)
            return b"ID3" + (b"audio" * 30)

    monkeypatch.setattr(tts_service, "_provider", Provider())
    response = client.post(
        "/tools/text-to-speech/generate",
        data={"text": "Hello world", "lang": "en"},
    )
    assert response.status_code == 200
    assert response.content_type == "audio/mpeg"
    assert "toolbox-speech.mp3" in response.headers["Content-Disposition"]


def test_tts_provider_failure_is_safe(client, monkeypatch):
    class Provider:
        def synthesize(self, _text, _lang, _slow, _timeout):
            raise ToolError("Speech generation failed. Please try again.", status_code=502)

    monkeypatch.setattr(tts_service, "_provider", Provider())
    response = client.post(
        "/tools/text-to-speech/generate",
        data={"text": "Hello", "lang": "en"},
    )
    assert response.status_code == 502
    assert response.get_json() == {"error": "Speech generation failed. Please try again."}


def test_tts_rejects_unsupported_language(client):
    response = client.post(
        "/tools/text-to-speech/generate",
        data={"text": "Hello", "lang": "xx"},
    )
    assert response.status_code == 400
