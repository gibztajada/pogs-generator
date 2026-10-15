"""Dump spans and drawings of every reference page to fixtures/ref/*.tsv for measuring."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, PAGES, ref_page, load_spans, span_origin, is_checkbox, hexcolor

out = ROOT / "fixtures" / "ref"
out.mkdir(parents=True, exist_ok=True)
for n in PAGES:
    page = ref_page(n)
    with open(out / f"page{n}.spans.tsv", "w", encoding="utf-8") as f:
        f.write("id\tx\ty\tx0\ty0\tx1\ty1\tsize\tfont\ttext\n")
        for s in load_spans(page):
            x, y = span_origin(s)
            b = s["bbox"]
            f.write(f"{s['id']}\t{x:.2f}\t{y:.2f}\t{b[0]:.2f}\t{b[1]:.2f}\t{b[2]:.2f}\t{b[3]:.2f}\t{s['size']:.2f}\t{s['font']}\t{s['text']}\n")
    with open(out / f"page{n}.drawings.tsv", "w", encoding="utf-8") as f:
        f.write("i\ttype\tcheckbox\tx0\ty0\tx1\ty1\tfill\tstroke\twidth\titems\n")
        for i, d in enumerate(page.get_drawings()):
            r = d["rect"]
            f.write(f"{i}\t{d['type']}\t{is_checkbox(d)}\t{r.x0:.2f}\t{r.y0:.2f}\t{r.x1:.2f}\t{r.y1:.2f}\t"
                    f"{hexcolor(d.get('fill'))}\t{hexcolor(d.get('color'))}\t{d.get('width')}\t{len(d['items'])}\n")
print("dumped to", out)
