import io

from barcode import Code128
from barcode.errors import BarcodeError, IllegalCharacterError
from barcode.writer import ImageWriter

from app.utils.errors import ToolError
from app.utils.validators import require_text


def generate_barcode(text, max_chars=80):
    payload = require_text(
        text,
        "Enter a value to generate a barcode.",
        max_length=max_chars,
        too_long_message="That value is too long for Code 128.",
    )
    buffer = io.BytesIO()
    try:
        barcode = Code128(payload, writer=ImageWriter())
        barcode.write(
            buffer,
            options={
                "module_width": 0.4,
                "module_height": 18,
                "quiet_zone": 6.5,
                "font_size": 10,
                "text_distance": 4,
                "write_text": True,
            },
        )
    except (IllegalCharacterError, BarcodeError, ValueError) as exc:
        raise ToolError("That value contains characters that Code 128 cannot encode.") from exc
    return buffer.getvalue()
