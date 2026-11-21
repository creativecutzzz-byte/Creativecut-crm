"""Build the internal status page (Netlify) from a Sheet snapshot JSON.

    python netlify/build_status.py SNAPSHOT.json netlify/site

SNAPSHOT is a LocalStore-format JSON (tabs -> rows). The page is protected by
the Basic-Auth edge function in netlify/site/netlify/edge-functions/auth.ts.
"""

from __future__ import annotations

import html
import json
import os
import sys
from collections import Counter

SHEET_URL = "https://docs.google.com/spreadsheets/d/1wxg9TbrErNUy42lWDDZPE5T82b_GnLUs8Am7zrU3Avs/edit"
e = html.escape


def preview_html(q: dict) -> str:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from lead_engine.pipeline import Pipeline

    return Pipeline._html_from_preview(q)


def build(snapshot: dict, run_log_extra: list[dict]) -> str:
    leads, queue = snapshot.get("Leads", []), snapshot.get("Outreach Queue", [])
    runs = run_log_extra or snapshot.get("Run Log", [])
    ls, qs = Counter(r.get("Status") for r in leads), Counter(r.get("Status") for r in queue)
    tiles = [
        ("Leads", len(leads)), ("Qualified", ls["QUALIFIED"] + ls["READY"]), ("Ready", qs["READY"]),
        ("Needs review", qs["NEEDS_REVIEW"] + ls["NEEDS_REVIEW"]), ("Sent", sum(1 for q in queue if q.get("Sent At"))),
        ("Replied", qs["REPLIED"]), ("Bounced", qs["BOUNCED"]), ("Skipped", ls["SKIPPED"] + qs["SKIPPED"]), ("Failed", qs["FAILED"]),
    ]
    tile_html = "".join(f'<div class="tile"><span>{e(k)}</span><b>{v}</b></div>' for k, v in tiles)
    run_rows = "".join(
        f"<tr><td>{e(r.get('Run ID',''))}</td><td>{e(r.get('Source',''))}</td><td>{e(r.get('Apify Run ID',''))}</td>"
        f"<td>{e(r.get('Apify Status',''))}</td><td>{e(str(r.get('Rows Found','')))}</td><td>{e(str(r.get('Cost USD','')))}</td><td>{e(r.get('Notes',''))}</td></tr>"
        for r in runs)
    cards = []
    for q in queue:
        lead = next((l for l in leads if l["Lead ID"] == q["Lead ID"]), {})
        cards.append(f"""
<article class="card">
  <header><span class="pill {e(q['Status'].lower())}">{e(q['Status'])}</span>
    <h3>{e(q['Subject'])}</h3>
    <p class="meta">{e(lead.get('Company') or lead.get('Contact Name') or '')} · {e(lead.get('Market',''))} · {e(lead.get('Niche',''))} · {e(q['Variation'])}
      · <a href="{e(lead.get('Source URL',''))}">original post</a></p></header>
  <div class="mail">{preview_html(q)}</div>
  {f'<p class="err">{e(q["Last Error"])}</p>' if q.get('Last Error') else ''}
</article>""")
    lead_rows = "".join(
        f"<tr><td>{e(l['Status'])}</td><td>{e(l.get('Fit Score',''))}</td><td>{e(l.get('Company') or l.get('Contact Name',''))}</td>"
        f"<td>{e(l.get('Market',''))}</td><td>{e(l.get('Niche',''))}</td><td>{e(l.get('Post Date',''))}</td><td>{e(l.get('Contact Channel',''))}</td>"
        f"<td><a href=\"{e(l.get('Source URL',''))}\">source</a></td></tr>" for l in leads)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Creative Cut Lead Engine</title>
<style>
:root{{--bg:#0f0f12;--card:#17171c;--ink:#f3f3f0;--mute:#9a9aa3;--lime:#cdf33f;--line:#2a2a31;--red:#ff7a7a}}
@media (prefers-color-scheme: light){{:root:not([data-theme="dark"]){{--bg:#f6f6f2;--card:#fff;--ink:#141417;--mute:#5d5d66;--line:#e2e2dc;--lime:#5a7a00;--red:#b42318}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:24px 16px 64px}}h1{{font-size:24px;margin:0 0 4px}}h2{{margin:36px 0 12px;font-size:18px}}
a{{color:var(--lime)}}.sub{{color:var(--mute);margin:0 0 20px}}
.tiles{{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}}
.tile{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}}.tile span{{color:var(--mute);font-size:12px;display:block}}.tile b{{font-size:24px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}}.card h3{{margin:6px 0 2px;font-size:16px}}
.meta{{color:var(--mute);font-size:13px;margin:0}}.mail{{background:#fff;color:#222;border-radius:8px;padding:12px 16px;margin-top:12px}}.mail a{{color:#1a56db}}
.pill{{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;border:1px solid var(--line)}}.pill.ready{{background:var(--lime);color:#111}}
.err{{color:var(--red);font-size:13px}}.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:13px}}
td,th{{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}}th{{color:var(--mute);font-weight:600}}
</style></head><body><main>
<h1>Creative Cut Lead Engine</h1>
<p class="sub">Internal status. Source of truth: <a href="{SHEET_URL}">Creative Cut | Lead Generation &amp; Outreach</a> (Google Sheet). Mode: DRY_RUN until Settings → SENDING_ENABLED = TRUE.</p>
<div class="tiles">{tile_html}</div>
<h2>Outreach queue (rendered previews)</h2>{''.join(cards)}
<h2>Run log</h2><div class="scroll"><table><tr><th>Run</th><th>Source</th><th>Apify run</th><th>Status</th><th>Rows</th><th>USD</th><th>Notes</th></tr>{run_rows}</table></div>
<h2>Leads</h2><div class="scroll"><table><tr><th>Status</th><th>Fit</th><th>Company / poster</th><th>Market</th><th>Niche</th><th>Posted</th><th>Channel</th><th></th></tr>{lead_rows}</table></div>
</main></body></html>"""


if __name__ == "__main__":
    snap = json.load(open(sys.argv[1]))
    extra = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else []
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "index.html"), "w") as fh:
        fh.write(build(snap, extra))
    print("wrote", os.path.join(out, "index.html"))
