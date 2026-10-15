import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fitz
from common import norm, hexcolor, path_d, load_spans, span_origin, is_checkbox

_DOCS = []  # keep documents alive while pages are used


def make_pdf():
    doc = fitz.open()
    _DOCS.append(doc)
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 100), "LABEL:", fontname="hebo", fontsize=8)
    page.insert_text((90, 100), "Value", fontname="helv", fontsize=8)
    shp = page.new_shape()
    shp.draw_rect(fitz.Rect(30, 92, 36.3, 98.3), radius=0.2)
    shp.draw_rect(fitz.Rect(31, 93, 35.3, 97.3))
    shp.finish(fill=(0, 0, 0), color=None, even_odd=True)
    shp.draw_line((20, 120), (500, 120))
    shp.finish(color=(0, 0, 0), width=0.66)
    shp.commit()
    return page


def test_norm_and_color():
    assert norm("  A   b\n") == "a b"
    assert hexcolor((1, 0, 0)) == "#ff0000"
    assert hexcolor(0x00ff00) == "#00ff00"
    assert hexcolor(None) is None


def test_spans_and_origin():
    spans = load_spans(make_pdf())
    assert {"LABEL:", "Value"} <= {s["text"].strip() for s in spans}
    v = next(s for s in spans if s["text"].strip() == "Value")
    x, y = span_origin(v)
    assert abs(x - 90) < 0.5 and abs(y - 100) < 0.5


def test_checkbox_detection_and_path():
    drs = make_pdf().get_drawings()
    assert len([d for d in drs if is_checkbox(d)]) == 1
    line = next(d for d in drs if not is_checkbox(d))
    assert path_d(line["items"]).startswith("M20.0 120.0L500.0 120.0")


def test_near_square_glyph_is_not_checkbox():
    # Chart axis glyphs (e.g. "-3") are black, curved and almost square (w-h ~0.2-0.45);
    # real checkboxes are square to within 0.02 pt.
    doc = fitz.open()
    _DOCS.append(doc)
    page = doc.new_page(width=595, height=842)
    shp = page.new_shape()
    shp.draw_bezier((49.07, 200.11), (50, 200.11), (51, 203.34), (52.11, 203.34))
    shp.draw_line((52.11, 203.34), (49.07, 203.34))
    shp.finish(fill=(0, 0, 0), color=None, closePath=True)
    shp.commit()
    d = page.get_drawings()[0]
    assert 0.1 < abs(d["rect"].width - d["rect"].height) < 0.6  # passed the old 0.6 tolerance
    assert not is_checkbox(d)
