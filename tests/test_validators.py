"""Tests for input validators."""

import pytest

from app.utils.errors import ToolError
from app.utils.validators import is_non_empty_text, parse_hex_color, parse_int, require_text


# ---- is_non_empty_text ----

def test_non_empty_text_valid():
    assert is_non_empty_text("hello")
    assert is_non_empty_text("  url  ")


def test_non_empty_text_invalid():
    assert not is_non_empty_text("")
    assert not is_non_empty_text("   ")
    assert not is_non_empty_text(None)
    assert not is_non_empty_text(123)
    assert not is_non_empty_text("x" * 4097)


# ---- require_text ----

def test_require_text_valid():
    assert require_text("hello", "err") == "hello"
    assert require_text("  world  ", "err") == "world"


def test_require_text_empty():
    with pytest.raises(ToolError):
        require_text("", "empty")
    with pytest.raises(ToolError):
        require_text(None, "empty")


def test_require_text_too_long():
    with pytest.raises(ToolError):
        require_text("x" * 10, "empty", max_length=5, too_long_message="too long")


# ---- parse_int ----

def test_parse_int_valid():
    assert parse_int("10", 5, 1, 20, "err") == 10
    assert parse_int(None, 5, 1, 20, "err") == 5
    assert parse_int("", 5, 1, 20, "err") == 5


def test_parse_int_out_of_range():
    with pytest.raises(ToolError):
        parse_int("25", 5, 1, 20, "err")


def test_parse_int_not_a_number():
    with pytest.raises(ToolError):
        parse_int("abc", 5, 1, 20, "err")


# ---- parse_hex_color ----

def test_parse_hex_color_valid():
    assert parse_hex_color("#ff0000", "#000000", "err") == "#ff0000"
    assert parse_hex_color(None, "#000000", "err") == "#000000"


def test_parse_hex_color_invalid():
    with pytest.raises(ToolError):
        parse_hex_color("red", "#000000", "err")
    with pytest.raises(ToolError):
        parse_hex_color("#xyz", "#000000", "err")
