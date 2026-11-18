from sp5lib.color_utils import bgr_to_hex, bgr_to_rgb, hex_to_bgr, is_light_color


def test_conversions():
    assert bgr_to_rgb(0x0080FF) == (255, 128, 0)
    assert bgr_to_hex(255) == "#FF0000"
    assert bgr_to_hex(16711680) == "#0000FF"
    assert bgr_to_hex(-1) == "#FFFFFF"
    assert bgr_to_hex(None) == "#FFFFFF"
    assert hex_to_bgr("#FF8000") == 0x0080FF
    assert hex_to_bgr(bgr_to_hex(6340863)) == 6340863


def test_is_light_color():
    assert is_light_color(0xFFFFFF)
    assert not is_light_color(0)
    assert not is_light_color(0xFF0000)
