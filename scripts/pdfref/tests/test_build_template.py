import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fitz
import pytest
from build_template import build, BuildError

_DOCS = []


def page_with(texts, boxes=()):
    doc = fitz.open()
    _DOCS.append(doc)
    page = doc.new_page(width=595, height=842)
    for (x, y, t, bold) in texts:
        page.insert_text((x, y), t, fontname="hebo" if bold else "helv", fontsize=8)
    shp = page.new_shape()
    for (x, y) in boxes:
        shp.draw_rect(fitz.Rect(x, y, x + 6.3, y + 6.3), radius=0.2)
        shp.draw_rect(fitz.Rect(x + 1, y + 1, x + 5.3, y + 5.3))
        shp.finish(fill=(0, 0, 0), color=None, even_odd=True)
    shp.draw_line((20, 300), (500, 300))
    shp.finish(color=(0, 0, 0), width=0.66)
    shp.commit()
    return page


def test_auto_field_replaces_value_and_keeps_label():
    p = page_with([(50, 100, "NAME:", True), (90, 100, "SECRETNAME", False)])
    t = build(p, {"page": 1, "fields": [{"key": "patient.lastName"}]}, {"patient.lastName": "SECRETNAME"})
    assert [x["t"] for x in t["texts"]] == ["NAME:"]
    f = t["fields"][0]
    assert f["k"] == "patient.lastName" and abs(f["x"] - 90) < 0.5 and abs(f["y"] - 100) < 0.5 and f["s"] == 8
    assert len(t["paths"]) == 1


def test_unclaimed_fixture_value_is_an_error():
    p = page_with([(50, 100, "NAME:", True), (90, 100, "SECRETNAME", False)])
    with pytest.raises(BuildError, match="unclaimed"):
        build(p, {"page": 1, "fields": []}, {"patient.lastName": "SECRETNAME"})


def test_excluded_keys_do_not_trigger_unclaimed():
    p = page_with([(40, 98, "Pills", False)], boxes=[(30, 92)])
    m = {"page": 1, "checks": [{"key": "p.c", "value": "Pills", "label": "Pills"}]}
    t = build(p, m, {"p.c": "Pills"}, exclude_keys={"p.c"})
    assert [x["t"] for x in t["texts"]] == ["Pills"]


def test_near_disambiguates():
    p = page_with([(50, 100, "STIs:", True), (80, 100, "None", False), (50, 200, "Alcohol:", True), (90, 200, "None", False)])
    m = {"page": 1, "fields": [{"key": "a.stis", "near": "STIs:"}, {"key": "a.alcohol", "near": "Alcohol:"}]}
    t = build(p, m, {"a.stis": "None", "a.alcohol": "None"})
    assert {f["k"]: round(f["y"]) for f in t["fields"]} == {"a.stis": 100, "a.alcohol": 200}


def test_check_left_of_label_and_unmapped_box_error():
    p = page_with([(40, 98, "Pills", False), (140, 98, "IUD", False)], boxes=[(30, 92), (130, 92)])
    m = {"page": 1, "checks": [{"key": "p.c", "value": "Pills", "label": "Pills"}, {"key": "p.c", "value": "IUD", "label": "IUD"}]}
    t = build(p, m, {})
    assert [(c["v"], round(c["x"])) for c in t["checks"]] == [("Pills", 30), ("IUD", 130)]
    with pytest.raises(BuildError, match="unmapped checkbox"):
        build(page_with([(40, 98, "Pills", False), (140, 98, "IUD", False)], boxes=[(30, 92), (130, 92)]),
              {"page": 1, "checks": [m["checks"][0]]}, {})


def test_box_consumes_spans_and_table_emits_cells():
    p = page_with([(50, 400, "line one", False), (50, 410, "line two", False), (60, 500, "G1", False)])
    m = {"page": 1,
         "fields": [{"key": "p.hpi", "box": [45, 390, 300, 30], "size": 8}],
         "tables": [{"key": "p.ob", "region": [40, 490, 300, 40], "columns": {"order": 60, "year": 120},
                     "firstBaseline": 500, "pitch": 10, "rows": 2, "size": 8}]}
    t = build(p, m, {})
    assert t["texts"] == []
    keys = [f["k"] for f in t["fields"]]
    assert "p.hpi" in keys and "p.ob.1.year" in keys and len(keys) == 5
    hpi = next(f for f in t["fields"] if f["k"] == "p.hpi")
    assert hpi["ml"] is True and hpi["w"] == 300


def test_split_label_value():
    p = page_with([(40, 100, "Others: placenta previa", False)])
    t = build(p, {"page": 1, "splits": [{"label": "Others:", "key": "p.other"}]}, {"p.other": "placenta previa"})
    assert [x["t"] for x in t["texts"]] == ["Others:"]
    assert t["fields"][0]["k"] == "p.other" and t["fields"][0]["x"] > 60


def test_mark_consumes_x():
    p = page_with([(50, 100, "Midposition:", False), (110, 100, "X", True)])
    t = build(p, {"page": 1, "marks": [{"key": "p.pos", "value": "Midposition", "near": "Midposition:"}]}, {})
    assert [x["t"] for x in t["texts"]] == ["Midposition:"]
    assert t["marks"][0]["v"] == "Midposition" and t["marks"][0]["b"] is True


def test_fit_width_sets_transform_and_drops_outside():
    p = page_with([(50, 100, "IN", False), (560, 100, "OUT", False)])
    t = build(p, {"page": 4, "fitWidth": {"frame": [18, 54, 318, 500], "targetRight": 578.3}}, {})
    assert [x["t"] for x in t["texts"]] == ["IN"]
    assert abs(t["transform"]["k"] - (578.3 - 18) / 300) < 1e-3
