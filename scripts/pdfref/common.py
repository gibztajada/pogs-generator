"""Shared helpers for reading the reference POGS PDFs with PyMuPDF."""
import re
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]
REFS = {
    1: "SOSTINO POGS 2 - Page 1.pdf",
    2: "SOSTINO POGS 2 - page 2.pdf",
    3: "SOSTINO POGS 2 - Sheet3.pdf",
    4: "SOSTINO POGS 2 - Sheet4.pdf",
    5: "SOSTINO POGS 2 - Sheet5.pdf",
    6: "SOSTINO POGS 2 - Sheet6.pdf",
}
ZOOM = 192 / 72  # same pixel grid as a Playwright screenshot of a 595pt sheet at deviceScaleFactor 2

_open = []


def ref_page(n):
    doc = fitz.open(str(ROOT / REFS[n]))
    _open.append(doc)
    return doc[0]


def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip().lower()


def hexcolor(c):
    if c is None:
        return None
    if isinstance(c, int):
        r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    else:
        r, g, b = (round(v * 255) for v in c[:3])
    return f"#{r:02x}{g:02x}{b:02x}"


def _same(a, b):
    return a is not None and abs(a.x - b.x) < 1e-3 and abs(a.y - b.y) < 1e-3


def path_d(items, ox=0.0, oy=0.0, sx=1.0, sy=1.0, prec=2):
    def P(p):
        return f"{round((p.x - ox) * sx, prec)} {round((p.y - oy) * sy, prec)}"

    out, cur = [], None
    for it in items:
        op = it[0]
        if op == "l":
            a, b = it[1], it[2]
            if not _same(cur, a):
                out.append("M" + P(a))
            out.append("L" + P(b))
            cur = b
        elif op == "c":
            a, c1, c2, b = it[1], it[2], it[3], it[4]
            if not _same(cur, a):
                out.append("M" + P(a))
            out.append(f"C{P(c1)} {P(c2)} {P(b)}")
            cur = b
        elif op == "re":
            r = it[1]
            out.append(f"M{P(r.tl)}L{P(r.tr)}L{P(r.br)}L{P(r.bl)}Z")
            cur = None
        elif op == "qu":
            q = it[1]
            out.append(f"M{P(q.ul)}L{P(q.ur)}L{P(q.lr)}L{P(q.ll)}Z")
            cur = None
    return "".join(out)


def load_spans(page):
    spans = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                text = "".join(c["c"] for c in s["chars"])
                if not text.strip():
                    continue
                spans.append({"text": text, "chars": s["chars"], "bbox": s["bbox"], "size": s["size"],
                              "font": s["font"], "color": s["color"], "used": False})
    for i, s in enumerate(spans):
        s["id"] = i
    return spans


def span_origin(span):
    for c in span["chars"]:
        if c["c"].strip():
            return c["origin"][0], c["origin"][1]
    return span["chars"][0]["origin"]


def span_bold(span):
    return "Bold" in span["font"]


def is_checkbox(d):
    r = d["rect"]
    fill = d.get("fill")
    if d.get("type") not in ("f", "fs") or fill is None or sum(fill[:3]) > 0.3:
        return False
    if not (3 <= r.width <= 10 and abs(r.width - r.height) < 0.1):
        return False
    return any(it[0] == "c" for it in d["items"])
