import io

import qrcode
from qrcode.exceptions import DataOverflowError
from qrcode.constants import (
    ERROR_CORRECT_H,
    ERROR_CORRECT_L,
    ERROR_CORRECT_M,
    ERROR_CORRECT_Q,
)

from app.utils.errors import ToolError
from app.utils.validators import parse_hex_color, parse_int, require_text

_ERROR_LEVELS = {
    "L": ERROR_CORRECT_L,
    "M": ERROR_CORRECT_M,
    "Q": ERROR_CORRECT_Q,
    "H": ERROR_CORRECT_H,
}


def generate_qr(
    text,
    box_size=10,
    border=4,
    error_correction="M",
    fill_color="#000000",
    back_color="#ffffff",
    max_chars=2000,
):
    payload = require_text(
        text,
        "Enter text or a URL to generate a QR code.",
        max_length=max_chars,
        too_long_message="That text is too long for a QR code.",
    )
    size = parse_int(box_size, 10, 4, 20, "Choose a size between 4 and 20.")
    margin = parse_int(border, 4, 1, 10, "Choose a margin between 1 and 10.")
    level = (error_correction or "M").upper()
    if level not in _ERROR_LEVELS:
        raise ToolError("Choose a valid error correction level.")
    fill = parse_hex_color(fill_color, "#000000", "Foreground color must be a hex value like #000000.")
    back = parse_hex_color(back_color, "#ffffff", "Background color must be a hex value like #ffffff.")
    if fill.lower() == back.lower():
        raise ToolError("Foreground and background colors must be different.")

    qr = qrcode.QRCode(
        version=None,
        error_correction=_ERROR_LEVELS[level],
        box_size=size,
        border=margin,
    )
    qr.add_data(payload)
    try:
        qr.make(fit=True)
    except (DataOverflowError, ValueError) as exc:
        raise ToolError(
            "That text is too long for those QR settings. Shorten it or use lower error correction."
        ) from exc
    image = qr.make_image(fill_color=fill, back_color=back).convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
