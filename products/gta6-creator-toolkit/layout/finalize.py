"""Add bookmarks + metadata to layout/raw.pdf -> GTA_6_Creator_Toolkit.pdf.

    python3 layout/finalize.py
"""
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "layout" / "raw.pdf"
OUT = ROOT / "GTA_6_Creator_Toolkit.pdf"
HTML = (ROOT / "layout" / "book.html").read_text(encoding="utf-8")

titles = {int(n): t for t, n in re.findall(r'data-title="([^"]+)" data-page="(\d+)"', HTML)}

GROUPS = [
    ("Start here", range(1, 5)),
    ("Mission 1 · Choose a campaign", range(5, 8)),
    ("Mission 2 · Find three moments", range(8, 11)),
    ("Mission 3 · Plan one Short", range(11, 14)),
    ("Mission 4 · Edit on a phone", range(14, 17)),
    ("Mission 5 · Check the brief", range(17, 20)),
    ("Mission 6 · Publish, submit, troubleshoot", range(20, 23)),
    ("Mission 7 · Three earning routes", range(23, 26)),
    ("Copy-and-use resources", range(26, 31)),
    ("Bonuses", range(31, 35)),
    ("Glossary and sources", range(35, 37)),
]

reader = PdfReader(str(RAW))
writer = PdfWriter(clone_from=reader)
assert len(writer.pages) == 36, f"expected 36 pages, got {len(writer.pages)}"

for name, rng in GROUPS:
    parent = writer.add_outline_item(name, rng[0] - 1)
    for n in rng:
        t = titles[n].split(": ", 1)[-1] if titles[n].startswith("Mission") else titles[n]
        writer.add_outline_item(f"p.{n} · {t}", n - 1, parent=parent)

writer.add_metadata({
    "/Title": "GTA 6 Creator Toolkit",
    "/Subject": "Make your first GTA 6 Short. Just your phone. An independent guide.",
    "/Author": "Creative Cut",
    "/Creator": "Creative Cut",
    "/Producer": "Creative Cut",
    "/Keywords": "GTA 6, Shorts, clipping, phone editing, campaign checklist, YouTube",
})
writer.page_mode = "/UseOutlines"
with open(OUT, "wb") as f:
    writer.write(f)
print("wrote", OUT.name)
