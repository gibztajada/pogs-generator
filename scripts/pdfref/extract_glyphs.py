"""Extract unchecked/checked checkbox glyph paths (unit box) from reference page 2."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, ref_page, is_checkbox, path_d

page = ref_page(2)
boxes = [d for d in page.get_drawings() if is_checkbox(d)]


def nlines(d):
    return sum(1 for it in d["items"] if it[0] == "l")


unchecked, checked = min(boxes, key=nlines), max(boxes, key=nlines)
assert nlines(checked) > nlines(unchecked), "page 2 must contain both checkbox states"


def glyph(d):
    r = d["rect"]
    return {"d": path_d(d["items"], r.x0, r.y0, 1 / r.width, 1 / r.height, prec=4), "evenOdd": bool(d.get("even_odd"))}


out = ROOT / "lib" / "sheets" / "templates" / "glyphs.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"unchecked": glyph(unchecked), "checked": glyph(checked)}, indent=1), encoding="utf-8")
print("wrote", out)
