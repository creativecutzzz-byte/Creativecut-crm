# GTA 6 Creator Toolkit — Task Tracker

Publisher: **Creative Cut** (sole publishing credit; no personal author name anywhere).
Language: **clear, beginner-friendly English** for all reader-facing content. This replaces the original Hinglish instruction, including the Hinglish cover subtitle and ad lines, which are translated (see `editorial-brief.md` §2).

Folder: `products/gta6-creator-toolkit/`

Status key: `[ ]` not started · `[~]` in progress · `[x]` done and output inspected · `[!]` blocked (reason recorded)

---

## Task 1 — Lock the product and editorial brief
- **Inputs:** owner brief (title, subtitle, audience, voice, promise), English-language override.
- **Outputs:** `editorial-brief.md`
- **Completion check:** brief states title, English subtitle + cover detail, primary/secondary audience, voice rules, product promise, "free tools" meaning, claim rules, credit rule; file opened and read back.
- **Status:** [x] — Inspected 2026-11-19: all fields present; English override + translation table in §2.

## Task 2 — Verify current rules and build the practice case
- **Inputs:** editorial brief; primary sources (Content Rewards / Whop, Clipster, Vyro, YouTube Help, app stores / tool help pages, PlayStation / Xbox help); KreekCraft reference brief.
- **Outputs:** `sources.md`, `practice-case.md`, `assets/illustrations/*.svg`
- **Completion check:** every claim used in the book has a source row with link, date checked, claim supported, uncertainty; unverifiable items are marked "not verified" and kept out of the book as fact; practice case covers all 7 stages (brief → transcript → highlight → edit plan → vertical frame → submission review → reward) plus a second "your turn" timestamp; it is clearly labeled fictional; illustrations render in a browser.
- **Status:** [x] — Inspected: 40+ source rows with status V/P/S/X; 12 SVGs rendered and reviewed on a contact sheet (fixed receipt edge, clipped label, arrow overlap). Practice case covers all 7 stages + 2 'your turn' items. Hidden tricks/cheats excluded (game launches today, unverifiable).

## Task 3 — Page map
- **Inputs:** brief, sources, practice case.
- **Outputs:** `page-map.md`
- **Completion check:** 36 numbered entries, each with heading, what the reader learns/does, illustration; allocation matches the brief (1–4 front, 5–25 missions ×3, 26–30 resources, 31–34 bonuses, 35–36 end matter).
- **Status:** [x] — Inspected: 36 entries, allocation 4+21+5+4+2 verified; omissions (Claude Code box, cheats) recorded.

## Task 4 — Finished manuscript
- **Inputs:** page map, sources, practice case.
- **Outputs:** `manuscript.md`
- **Completion check:** every page in the map has finished copy; each mission has worked example + reader task + output that feeds the next mission; jargon defined at first use; earnings claims conditional; CPM arithmetic correct; no personal author name; no Hinglish remaining.
- **Status:** [x] — Inspected: all 36 pages written; each mission ends with a 'You now have' output used next; arithmetic re-checked ($48.60/$4.86/$43.74; $210→$150→$135; $2.10<$3→$0; $7.40→$6.66; $100 gross); no author name; no Hinglish left.

## Task 5 — Cover, interior, doodles
- **Inputs:** manuscript, palette, fonts, mood references (palette/mood only).
- **Outputs:** `layout/` (editable HTML/CSS source + build script), `assets/illustrations/` (original SVG art), `GTA_6_Creator_Toolkit_Cover.png`, font notes in `sources.md`.
- **Completion check:** cover PNG ≥ 1748×2480 px; title and "phone only" promise legible at 200 px wide thumbnail (inspected); four teaching doodles present (timestamp loop, scissors, missing-overlay arrow, CPM receipt); recurring before/after crop used on p.4 and in Mission 5.
- **Status:** [x] — Inspected: cover PNG 1748×2480; at 200 px wide title + 'JUST YOUR PHONE.' legible; 4 teaching doodles + recurring A/B crop (p.4 → p.17–18). Fonts: Barlow Condensed (Pricedown not used, permission unverified), Inter, Caveat — all OFL. Editable source: layout/ (make_art.py, build.py, style.css, render.js, finalize.py).

## Task 6 — Render, review, fix the PDF
- **Inputs:** layout source.
- **Outputs:** `GTA_6_Creator_Toolkit.pdf`, `layout/review/` page renders.
- **Completion check:** 36 pages A5; cover on p.1; bookmarks present; internal contents links work; text selectable (prompts extractable); metadata has Creative Cut only; pages viewed at ~375 px width; payout arithmetic re-checked; issues fixed and re-rendered.
- **Status:** [x] — Inspected rendered PDF: 36 A5 pages, cover p.1, 0 overflow pages (automated check), 14 internal links land on correct pages, 21 external links, 11 bookmark groups/36 entries, tagged PDF, text selectable (prompts extract cleanly via pdftotext), metadata Author/Creator/Producer = Creative Cut. Reviewed at 375 px: fixed 9 overflows, tracker table clipping, tiny receipt and phone-note labels; re-rendered.

## Task 7 — Mobile product preview
- **Inputs:** p.4 / Mission 5 art.
- **Outputs:** `preview/spot-the-rejection-preview.png`, `preview/spot-the-rejection.html` (tap-to-reveal), listing copy in `launch-copy.md`.
- **Completion check:** both versions viewed at 375 px; frames labeled "Illustration"; reference brief linked with date checked; one-sentence fix present.
- **Status:** [x] — Inspected: static PNG (reveal shown) + tap-to-reveal HTML reviewed at 375 px (no horizontal scroll; tap A → 'Correct! Crop A fails.'); both frames labeled Illustration; KreekCraft brief linked with date checked; one-sentence fix present.

## Task 8 — India launch kit
- **Inputs:** manuscript, preview.
- **Outputs:** `launch-copy.md`, `checkout-test-checklist.md`, `preview/ad-a-*.png`, `preview/ad-b-*.png`
- **Completion check:** listing for Creator Resources; SuperProfile noted as option (unverified features flagged); two Meta ads with copy + visual direction; optional PS5 hook; test plan (₹750 / ₹3,000 / 10 orders; 16 × ₹199 = ₹3,184 ≥ ₹3,000); nothing published, no spend.
- **Status:** [x] — Inspected: listing, preview copy, Ads A/B (copy + 1080×1350 images reviewed), optional PS5 hook, test plan (₹750 / ₹3,000 / 10 orders; 16×₹199=₹3,184). SuperProfile features flagged unverified. Domain discrepancy (tool. vs tools.creativecut.in) recorded. Nothing published, no spend.

## Task 9 — Hand off
- **Inputs:** all outputs.
- **Outputs:** `HANDOFF.md`, committed + pushed branch.
- **Completion check:** every deliverable exists and is listed with path; page count, font substitutions, passed checks, and unverified items reported.
- **Status:** [x] — HANDOFF.md lists every deliverable, page count (36), font substitution, passed checks, unverified items. Committed and pushed to claude/magical-wright-r25ftm.

---

## Log
- 2026-11-19 — All 9 tasks complete. Blocked/unverified items are listed in HANDOFF.md (none blocked a deliverable).
- 2026-11-19 — Project started. Repo had no prior toolkit drafts, so nothing needed re-translating from Hinglish.
