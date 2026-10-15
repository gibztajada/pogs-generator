"""Build lib/sheets/templates/pageN.json from a reference page, its mapping and the fixture view."""
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, ref_page, norm, hexcolor, path_d, load_spans, span_origin, span_bold, is_checkbox

MAPPINGS = ROOT / "scripts" / "pdfref" / "mappings"


class BuildError(Exception):
    pass


def r2(v):
    return round(float(v), 2)


def center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def inside(pt, box):
    x, y, w, h = box
    return x <= pt[0] <= x + w and y <= pt[1] <= y + h


SAME_LINE = 3.0


def nearest_to_anchor(cands, anchor):
    """Pick the candidate belonging to the anchor: same baseline (±3 pt) first, preferring
    spans starting right of the anchor's start (nearest x); else Euclidean nearest."""
    ax, ay = span_origin(anchor)
    x0 = anchor["bbox"][0]
    same = [s for s in cands if abs(span_origin(s)[1] - ay) <= SAME_LINE]
    if same:
        return min(same, key=lambda s: (span_origin(s)[0] < x0 - 1, abs(span_origin(s)[0] - x0)))
    return min(cands, key=lambda s: math.dist((ax, ay), span_origin(s)))


def find_label(spans, label, near=None, what="label"):
    cands = [s for s in spans if not s["used"] and norm(s["text"]) == norm(label)]
    if not cands:
        raise BuildError(f"{what} '{label}' not found")
    if near:
        return nearest_to_anchor(cands, find_label(spans, near, what="anchor"))
    if len(cands) > 1:
        raise BuildError(f"{what} '{label}' is ambiguous ({len(cands)} matches); add 'near'")
    return cands[0]


def field_from_span(key, s, align=None, size=None, bold=None):
    x, y = span_origin(s)
    f = {"k": key, "x": r2(x), "y": r2(y), "s": r2(size or s["size"]), "b": span_bold(s) if bold is None else bool(bold)}
    if align == "r":
        f["x"] = r2(max(c["bbox"][2] for c in s["chars"] if c["c"].strip()))
        f["al"] = "r"
    return f


def build(page, mapping, view, exclude_keys=frozenset()):
    spans = load_spans(page)
    drawings = page.get_drawings()
    tpl = {"page": mapping["page"], "width": r2(page.rect.width), "height": r2(page.rect.height),
           "paths": [], "texts": [], "fields": [], "checks": [], "marks": [], "images": []}
    drop = mapping.get("drop", {})
    drop_fills = {c.lower() for c in drop.get("fills", [])}
    drop_regions = list(drop.get("regions", []))

    fit = mapping.get("fitWidth")
    if fit:
        x0, y0, x1, y1 = fit["frame"]
        tpl["transform"] = {"k": round((fit["targetRight"] - x0) / (x1 - x0), 5), "ox": x0, "oy": y0}
        drop_regions.append([x1 + 1, 0, 10000, 10000])
    if "chart" in mapping:
        tpl["chart"] = mapping["chart"]

    for s in spans:
        if any(inside(center(s["bbox"]), r) for r in drop_regions):
            s["used"] = True

    for sp in mapping.get("splits", []):
        lab = norm(sp["label"])
        hit = next((s for s in spans if not s["used"] and norm(s["text"]).startswith(lab) and norm(s["text"]) != lab), None)
        if not hit:
            raise BuildError(f"split '{sp['label']}' not found")
        chars = hit["chars"]
        start = next(i for i, c in enumerate(chars) if c["c"].strip())
        n = start + len(sp["label"])
        k = n
        while k < len(chars) and not chars[k]["c"].strip():
            k += 1
        if k >= len(chars):
            raise BuildError(f"split '{sp['label']}' has no value part; use a field with 'at'")
        spans.append(dict(hit, text="".join(c["c"] for c in chars[:n]), chars=chars[:n], used=False))
        hit["used"] = True
        c = chars[k]
        tpl["fields"].append({"k": sp["key"], "x": r2(c["origin"][0]), "y": r2(c["origin"][1]), "s": r2(hit["size"]), "b": span_bold(hit)})

    def place_field(f):
        key = f["key"]
        val = view.get(key, "")
        if "box" in f:
            bx = f["box"]
            got = [s for s in spans if not s["used"] and inside(center(s["bbox"]), bx)]
            for s in got:
                s["used"] = True
            size = f.get("size") or (max(s["size"] for s in got) if got else None)
            if not size:
                raise BuildError(f"box field '{key}' needs 'size'")
            tpl["fields"].append({"k": key, "x": r2(bx[0]), "y": r2(bx[1]), "w": r2(bx[2]), "h": r2(bx[3]),
                                  "s": r2(size), "b": bool(f.get("bold", False)), "ml": True})
        elif "at" in f:
            x, y = f["at"]
            if val.strip():
                for s in spans:
                    if not s["used"] and norm(s["text"]) == norm(val) and math.dist((x, y), span_origin(s)) < 3:
                        s["used"] = True
            slot = {"k": key, "x": r2(x), "y": r2(y), "s": r2(f["size"]), "b": bool(f.get("bold", False))}
            if f.get("align") == "r":
                slot["al"] = "r"
            tpl["fields"].append(slot)
        else:
            if not val.strip():
                raise BuildError(f"field '{key}' is empty in fixture; give 'at' + 'size'")
            cands = [s for s in spans if not s["used"] and norm(s["text"]) == norm(val)]
            if not cands:
                raise BuildError(f"field '{key}': value span not found (claimed by an earlier key? add 'near')")
            if "near" in f:
                cands = [nearest_to_anchor(cands, find_label(spans, f["near"], what="anchor"))]
            for s in cands:
                s["used"] = True
                tpl["fields"].append(field_from_span(key, s, f.get("align"), f.get("size"), f.get("bold")))

    def is_explicit(f):
        return "box" in f or "at" in f or "near" in f

    fields = mapping.get("fields", [])
    for f in fields:
        if is_explicit(f):
            place_field(f)

    for t in mapping.get("tables", []):
        for s in spans:
            if not s["used"] and inside(center(s["bbox"]), t["region"]):
                s["used"] = True
        for r in range(t["rows"]):
            y = t["firstBaseline"] + r * t["pitch"]
            for col, x in t["columns"].items():
                tpl["fields"].append({"k": f"{t['key']}.{r}.{col}", "x": r2(x), "y": r2(y), "s": r2(t["size"]), "b": bool(t.get("bold", False))})

    for f in fields:
        if not is_explicit(f):
            place_field(f)

    for m in mapping.get("marks", []):
        if "at" in m:
            x, y = m["at"]
            for s in spans:
                if not s["used"] and norm(s["text"]) == "x" and math.dist((x, y), span_origin(s)) < 3:
                    s["used"] = True
            tpl["marks"].append({"k": m["key"], "v": m["value"], "x": r2(x), "y": r2(y), "s": r2(m["size"]), "b": bool(m.get("bold", True))})
            continue
        a = find_label(spans, m["near"], what="anchor")
        ax, ay = span_origin(a)
        xs = [s for s in spans if not s["used"] and norm(s["text"]) == "x" and abs(span_origin(s)[1] - ay) < 4 and span_origin(s)[0] > ax]
        if not xs:
            raise BuildError(f"mark '{m['key']}={m['value']}': no X right of '{m['near']}'; give 'at' + 'size'")
        s = min(xs, key=lambda s: span_origin(s)[0])
        s["used"] = True
        x, y = span_origin(s)
        tpl["marks"].append({"k": m["key"], "v": m["value"], "x": r2(x), "y": r2(y), "s": r2(s["size"]), "b": span_bold(s)})

    boxes = [d for d in drawings if is_checkbox(d)]
    for d in boxes:
        d["used"] = any(inside(center(tuple(d["rect"])), r) for r in drop_regions)
    typical = sorted(d["rect"].width for d in boxes)[len(boxes) // 2] if boxes else 6.3
    for c in mapping.get("checks", []):
        lab = find_label(spans, c["label"], c.get("near"))
        lb = lab["bbox"]
        lcy = (lb[1] + lb[3]) / 2
        entry = {"k": c["key"]}
        if "value" in c:
            entry["v"] = c["value"]
        if c.get("synthetic"):
            entry.update({"x": r2(lb[0] - typical - 3), "y": r2(lcy - typical / 2), "w": r2(typical), "h": r2(typical), "ow": True})
            tpl["checks"].append(entry)
            continue
        side = c.get("side", "left")
        row = [d for d in boxes if not d["used"] and abs((d["rect"].y0 + d["rect"].y1) / 2 - lcy) <= max(d["rect"].height, 4)]
        if side == "left":
            row = [d for d in row if d["rect"].x1 <= lb[0] + 1]
            pick = max(row, key=lambda d: d["rect"].x1) if row else None
        else:
            row = [d for d in row if d["rect"].x0 >= lb[2] - 1]
            pick = min(row, key=lambda d: d["rect"].x0) if row else None
        if not pick:
            raise BuildError(f"no checkbox {side} of label '{c['label']}'")
        pick["used"] = True
        r = pick["rect"]
        entry.update({"x": r2(r.x0), "y": r2(r.y0), "w": r2(r.width), "h": r2(r.height)})
        tpl["checks"].append(entry)
    left = [d for d in boxes if not d["used"]]
    if left:
        raise BuildError("unmapped checkbox(es) at " + ", ".join(f"({d['rect'].x0:.1f},{d['rect'].y0:.1f})" for d in left))

    for d in drawings:
        if is_checkbox(d):
            continue
        if hexcolor(d.get("fill")) in drop_fills or hexcolor(d.get("color")) in drop_fills:
            continue
        if any(inside(center(tuple(d["rect"])), r) for r in drop_regions):
            continue
        p = {"d": path_d(d["items"])}
        if d.get("fill") is not None and d["type"] in ("f", "fs"):
            p["fill"] = hexcolor(d["fill"])
        if d.get("color") is not None and d["type"] in ("s", "fs"):
            p["stroke"] = hexcolor(d["color"])
            p["sw"] = r2(d.get("width") or 1)
        if d.get("even_odd"):
            p["evenOdd"] = True
        tpl["paths"].append(p)

    for xref, name in mapping.get("images", {}).items():
        r = page.get_image_rects(int(xref))[0]
        tpl["images"].append({"src": name, "x": r2(r.x0), "y": r2(r.y0), "w": r2(r.width), "h": r2(r.height)})

    values = {norm(v) for k, v in view.items() if k not in exclude_keys and v and len(norm(v)) >= 4}
    allowed = {norm(t) for t in mapping.get("labelTexts", [])}
    for s in spans:
        if s["used"]:
            continue
        text = s["text"].strip()
        x, y = span_origin(s)
        if norm(text) in values and norm(text) not in allowed:
            raise BuildError(f"unclaimed fixture value at ({x:.1f},{y:.1f}): map it, or add to labelTexts if it is a printed label")
        t = {"t": text, "x": r2(x), "y": r2(y), "s": r2(s["size"]), "b": span_bold(s)}
        if "Italic" in s["font"] or "Oblique" in s["font"]:
            t["i"] = True
        col = hexcolor(s["color"])
        if col != "#000000":
            t["c"] = col
        tpl["texts"].append(t)
    return tpl


def selection_keys():
    """Keys of every check/mark in all mappings: their values are option names, not patient data."""
    keys = set()
    for mp in MAPPINGS.glob("page*.json"):
        m = json.loads(mp.read_text(encoding="utf-8"))
        keys |= {c["key"] for c in m.get("checks", [])} | {c["key"] for c in m.get("marks", [])}
    return keys


def main(n):
    mapping = json.loads((MAPPINGS / f"page{n}.json").read_text(encoding="utf-8"))
    view = json.loads((ROOT / "fixtures" / "sostino.view.json").read_text(encoding="utf-8"))
    tpl = build(ref_page(n), mapping, view, selection_keys())
    out = ROOT / "lib" / "sheets" / "templates" / f"page{n}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(tpl, indent=1), encoding="utf-8")
    review = ROOT / "fixtures" / "review"
    review.mkdir(parents=True, exist_ok=True)
    with open(review / f"page{n}.labels.tsv", "w", encoding="utf-8") as f:
        for t in tpl["texts"]:
            f.write(f"{t['x']}\t{t['y']}\t{t['s']}\t{'B' if t['b'] else ''}\t{t['t']}\n")
    print(f"page {n}: {len(tpl['paths'])} paths, {len(tpl['texts'])} labels, {len(tpl['fields'])} fields, "
          f"{len(tpl['checks'])} checks, {len(tpl['marks'])} marks")


if __name__ == "__main__":
    try:
        main(int(sys.argv[1]))
    except BuildError as e:
        print("BUILD ERROR:", e)
        sys.exit(1)
