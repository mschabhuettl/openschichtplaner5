"""Colours in SP5 are Windows COLORREF integers: ``0x00BBGGRR``."""


def bgr_to_rgb(bgr: int) -> tuple[int, int, int]:
    """Split a colour value into (red, green, blue)."""
    return (bgr & 0xFF, (bgr >> 8) & 0xFF, (bgr >> 16) & 0xFF)


def bgr_to_hex(bgr: int) -> str:
    """Convert a colour value to ``#RRGGBB``; white for anything that is no
    colour value."""
    if not isinstance(bgr, int) or bgr < 0:
        return "#FFFFFF"
    return "#{:02X}{:02X}{:02X}".format(*bgr_to_rgb(bgr))


def hex_to_bgr(value: str) -> int:
    """Convert ``#RRGGBB`` to a colour value."""
    rgb = int(value.lstrip("#"), 16)
    return ((rgb & 0xFF) << 16) | (rgb & 0xFF00) | (rgb >> 16)


def is_light_color(bgr: int) -> bool:
    """Whether dark text is readable on this colour."""
    r, g, b = bgr_to_rgb(bgr)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
