import re

_HEX_COLOR = re.compile(r"^#([0-9a-fA-F]{6})$")


def is_non_empty_text(value, max_length=4096):
    if value is None:
        return False
    if not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped:
        return False
    if len(stripped) > max_length:
        return False
    return True


def require_text(value, empty_message, max_length=4096, too_long_message=None):
    from app.utils.errors import ToolError

    if not isinstance(value, str) or not value.strip():
        raise ToolError(empty_message)
    stripped = value.strip()
    if len(stripped) > max_length:
        raise ToolError(too_long_message or "That input is too long.")
    return stripped


def parse_int(value, default, minimum, maximum, message):
    from app.utils.errors import ToolError

    if value is None or value == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ToolError(message) from exc
    if number < minimum or number > maximum:
        raise ToolError(message)
    return number


def parse_hex_color(value, default, message):
    from app.utils.errors import ToolError

    if value is None or value == "":
        return default
    if not isinstance(value, str) or not _HEX_COLOR.match(value.strip()):
        raise ToolError(message)
    return value.strip()
