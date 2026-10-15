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


def test_near_prefers_same_line_over_closer_diagonal():
    # A's own value is far right (+70); B's value (next row) is diagonally closer to A.
    p = page_with([(50, 100, "Tobacco:", True), (120, 100, "None", False),
                   (50, 114, "Drug/Allergies:", True), (100, 114, "None", False)])
    m = {"page": 1, "fields": [{"key": "a.tobacco", "near": "Tobacco:"}, {"key": "a.drug", "near": "Drug/Allergies:"}]}
    t = build(p, m, {"a.tobacco": "None", "a.drug": "None"})
    got = {f["k"]: (round(f["x"]), round(f["y"])) for f in t["fields"]}
    assert got == {"a.tobacco": (120, 100), "a.drug": (100, 114)}


def test_check_near_prefers_same_line_label():
    p = page_with([(50, 100, "Sex:", False), (130, 100, "M", False), (20, 108, "Q:", False), (60, 108, "M", False)],
                  boxes=[(120, 94), (50, 102)])
    m = {"page": 1, "checks": [{"key": "s", "value": "M", "label": "M", "near": "Sex:"},
                               {"key": "s2", "value": "M", "label": "M", "near": "Q:"}]}
    t = build(p, m, {})
    assert round(t["checks"][0]["x"]) == 120


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


def test_table_sizes_override_per_column():
    p = page_with([])
    m = {"page": 1,
         "tables": [{"key": "p.mon", "region": [40, 490, 300, 40], "columns": {"dateTime": 45, "bp": 80},
                     "firstBaseline": 500, "pitch": 10, "rows": 2, "size": 8.36, "sizes": {"dateTime": 6.08}}]}
    t = build(p, m, {})
    by = {f["k"]: f["s"] for f in t["fields"]}
    assert by["p.mon.0.dateTime"] == 6.08 and by["p.mon.1.dateTime"] == 6.08
    assert by["p.mon.0.bp"] == 8.36 and by["p.mon.1.bp"] == 8.36


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


def test_table_consumes_region_before_auto_field_can_claim():
    p = page_with([(60, 500, "1", False), (200, 200, "1", False)])
    m = {"page": 1,
         "fields": [{"key": "p.num"}],
         "tables": [{"key": "p.ob", "region": [40, 490, 300, 20], "columns": {"order": 60},
                     "firstBaseline": 500, "pitch": 10, "rows": 1, "size": 8}]}
    t = build(p, m, {"p.num": "1"})
    assert t["texts"] == []
    num = [f for f in t["fields"] if f["k"] == "p.num"]
    assert len(num) == 1 and abs(num[0]["y"] - 200) < 0.5


def test_explicit_near_field_claims_span_inside_table_region():
    p = page_with([(50, 100, "Anchor:", True), (60, 500, "INSIDEVAL", False)])
    m = {"page": 1,
         "fields": [{"key": "p.v", "near": "Anchor:"}],
         "tables": [{"key": "p.ob", "region": [40, 490, 300, 20], "columns": {"order": 60},
                     "firstBaseline": 500, "pitch": 10, "rows": 1, "size": 8}]}
    t = build(p, m, {"p.v": "INSIDEVAL"})
    assert [x["t"] for x in t["texts"]] == ["Anchor:"]
    keys = [f["k"] for f in t["fields"]]
    assert "p.v" in keys and "p.ob.0.order" in keys


def page_with_rules(texts, vlines):
    """A page with labels and vertical rules (x, y0, y1)."""
    p = page_with(texts)
    shp = p.new_shape()
    for (x, y0, y1) in vlines:
        shp.draw_line((x, y0), (x, y1))
    shp.finish(color=(0, 0, 0), width=0.5)
    shp.commit()
    return p


def by_key(t):
    return {f["k"]: f for f in t["fields"]}


def test_single_line_width_runs_to_next_label():
    p = page_with([(50, 100, "NAME:", True), (90, 100, "SECRETNAME", False), (250, 100, "AGE:", True)])
    t = build(p, {"page": 1, "fields": [{"key": "p.name"}]}, {"p.name": "SECRETNAME"})
    f = by_key(t)["p.name"]
    assert abs(f["w"] - (250 - f["x"] - 1)) < 0.05


def test_single_line_width_stops_at_vertical_rule_before_label():
    p = page_with_rules([(50, 100, "NAME:", True), (90, 100, "SECRETNAME", False), (250, 100, "AGE:", True)],
                        [(200, 80, 120), (150, 200, 260)])  # the second rule is off this line and is ignored
    t = build(p, {"page": 1, "fields": [{"key": "p.name"}]}, {"p.name": "SECRETNAME"})
    f = by_key(t)["p.name"]
    assert abs(f["w"] - (200 - f["x"] - 1)) < 0.05


def test_single_line_width_falls_back_to_page_edge_and_honours_override():
    p = page_with([(50, 100, "A:", True), (50, 200, "B:", True)])
    m = {"page": 1, "fields": [{"key": "p.a", "at": [70, 100], "size": 8},
                               {"key": "p.b", "at": [70, 200], "size": 8, "w": 42}]}
    t = build(p, m, {})
    assert abs(by_key(t)["p.a"]["w"] - (595 - 70 - 1)) < 0.05
    assert by_key(t)["p.b"]["w"] == 42


def test_right_aligned_width_runs_left_to_label_end():
    p = page_with([(400, 100, "HOSP #:", True), (520, 100, "12345", False)])
    t = build(p, {"page": 1, "fields": [{"key": "p.no", "align": "r"}]}, {"p.no": "12345"})
    f = by_key(t)["p.no"]
    label_end = 400 + fitz.get_text_length("HOSP #:", fontname="hebo", fontsize=8)
    assert f["al"] == "r" and abs(f["w"] - (f["x"] - label_end - 1)) < 0.05


def test_table_cells_get_column_widths():
    p = page_with_rules([], [(40, 490, 530), (100, 490, 530), (300, 490, 530)])
    m = {"page": 1,
         "tables": [{"key": "p.ob", "region": [40, 490, 260, 40], "columns": {"order": 45, "year": 105, "note": 160},
                     "firstBaseline": 500, "pitch": 10, "rows": 2, "size": 8, "widths": {"note": 30}}]}
    t = build(p, m, {})
    f = by_key(t)
    assert abs(f["p.ob.1.order"]["w"] - (100 - 45 - 1)) < 0.05  # to the column rule
    assert abs(f["p.ob.0.year"]["w"] - (160 - 105 - 1)) < 0.05  # to the next column's x
    assert f["p.ob.0.note"]["w"] == 30  # mapping override


def test_reference_value_wider_than_run_widens_slot():
    p = page_with([(50, 100, "N:", True), (70, 100, "AVERYLONGVALUE", False), (100, 100, "Z:", True)])
    t = build(p, {"page": 1, "fields": [{"key": "p.v"}]}, {"p.v": "AVERYLONGVALUE"})
    need = fitz.get_text_length("AVERYLONGVALUE", fontname="helv", fontsize=8)
    assert by_key(t)["p.v"]["w"] >= need and t["_widened"] == ["p.v"]
