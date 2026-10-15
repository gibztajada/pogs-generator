"""Extract the page-1 header images into public/sheet-assets."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import fitz
from common import ROOT, REFS

doc = fitz.open(str(ROOT / REFS[1]))
page = doc[0]
imgs = sorted(page.get_images(full=True), key=lambda im: -im[2])  # widest first: text block, then seal
out = ROOT / "public" / "sheet-assets"
out.mkdir(parents=True, exist_ok=True)
for name, im in zip(["header.png", "seal.png"], imgs[:2]):
    pix = fitz.Pixmap(doc, im[0])
    if pix.alpha or pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix, 0)
    pix.save(str(out / name))
    print(name, "xref", im[0], pix.width, "x", pix.height, page.get_image_rects(im[0])[0])
