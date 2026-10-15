"""Rasterize reference pages to tests/fidelity/reference/pageN.png at ZOOM.

A page whose mapping has "fitWidth" (page 4) is rendered with the same scale-about-frame-origin
transform the template uses, cropped to its frame, on a white A4 canvas.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fitz
from common import ROOT, PAGES, ZOOM, ref_page

out = ROOT / "tests" / "fidelity" / "reference"
out.mkdir(parents=True, exist_ok=True)
W, H = round(595 * ZOOM), round(842 * ZOOM)

for n in PAGES:
    page = ref_page(n)
    mp = ROOT / "scripts" / "pdfref" / "mappings" / f"page{n}.json"
    fit = json.loads(mp.read_text(encoding="utf-8")).get("fitWidth") if mp.exists() else None
    if not fit:
        page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=False).save(str(out / f"page{n}.png"))
        continue
    x0, y0, x1, y1 = fit["frame"]
    k = (fit["targetRight"] - x0) / (x1 - x0)
    pad = 2
    clip = fitz.Rect(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM * k, ZOOM * k), clip=clip, alpha=False)
    canvas = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, W, H), False)
    canvas.clear_with(255)
    # Under the transform x' = x0 + (x - x0) * k, the clip corner (x0 - pad) lands at x0 - pad * k.
    pix.set_origin(round((x0 - pad * k) * ZOOM), round((y0 - pad * k) * ZOOM))
    canvas.copy(pix, pix.irect)
    canvas.save(str(out / f"page{n}.png"))
print("rasterized to", out)
