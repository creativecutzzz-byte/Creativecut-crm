# Handoff: GTA 6 Creator Toolkit, first paid edition

Prepared 19 Nov 2026 · Publisher: Creative Cut · Language: plain English (it replaces the original Hinglish brief)

## Deliverables

| What | Path |
|---|---|
| Finished PDF (36 pages, A5) | `GTA_6_Creator_Toolkit.pdf` |
| Cover, standalone (1748×2480 px, A5 at 300 dpi) | `GTA_6_Creator_Toolkit_Cover.png` |
| Manuscript (single text source) | `manuscript.md` |
| Editable layout source | `layout/style.css`, `layout/build.py`, `layout/render.js`, `layout/finalize.py` |
| Artwork | 19 ChatGPT-generated images (originals in `assets/ai-raw/`, made from `IMAGE_PROMPTS.md`), prepared versions in `assets/images/` (`layout/prep_images.py`), composed with exact text, badge and labels in `layout/make_art.py` → `assets/illustrations/*.svg` |
| Fonts and licences | `assets/fonts/` (Barlow Condensed, Inter and Caveat, all under SIL OFL 1.1) |
| Editorial brief | `editorial-brief.md` |
| Sources (dated, with status for each claim) | `sources.md` |
| Practice case | `practice-case.md` |
| Page map | `page-map.md` |
| Product preview: static image + tap-to-reveal page | `preview/spot-the-rejection-preview.png`, `preview/spot-the-rejection.html` |
| Meta ad images | `preview/ad-a-beginner-1080x1350.png`, `preview/ad-b-creator-1080x1350.png` |
| Launch copy, ad copy and test plan | `launch-copy.md` |
| Checkout test checklist | `checkout-test-checklist.md` |
| Task tracker | `TASKS.md` |
| Review renders (375 px phone width, contact sheets) | `layout/review/` |

**Rebuild:** `python3 layout/prep_images.py && python3 layout/make_art.py && python3 layout/build.py && node layout/render.js && python3 layout/finalize.py`
Then `python3 preview/build_preview.py && node preview/shoot.js` (needs Python `markdown` and Playwright).

## Page count
**36 pages**, as planned (4 front, 21 mission, 5 resources, 4 bonus, 2 end). The automated check found **0 pages where content runs past the page**.

## Font substitutions
- **Pricedown was not used.** I couldn't confirm permission to embed it in a paid PDF and ads. Rockstar has never publicly named the GTA VI logo typeface, so the book makes no claim about it.
- Display headings use **Barlow Condensed ExtraBold**, body text uses **Inter**, and handwritten notes use **Caveat**. All three are OFL, so embedding is allowed.

## Checks passed
- PDF: 36 A5 pages, cover on page 1, tagged PDF, text can be selected (both prompts copy out cleanly), 11 bookmark groups with 36 entries.
- Links: 14 internal links (contents page plus the page 4 → page 17 link) all land on the correct pages. There are 21 external source links.
- Metadata: Author, Creator and Producer all read "Creative Cut". No personal name appears anywhere.
- Phone check at 375 px: pages are readable. Fixed during review: 9 overflowing pages, a tracker table cut off at the edge, a tiny receipt and unreadable handwritten notes.
- Thumbnail: at 200 px wide, the title and "JUST YOUR PHONE." are still readable.
- Payout sums: $48.60 gross − $4.86 fee = $43.74 · $210 capped to $150, minus $15 = $135 · $2.10 is below the $3 minimum, so $0 · 7,400 views = $7.40 − $0.74 = $6.66 · 100,000 views × $1 per 1,000 = $100 gross · 16 × ₹199 = ₹3,184, which is at least ₹3,000.
- Preview page: no sideways scrolling at 375 px. Tapping A shows "Correct! Crop A fails."
- Language: no Hinglish left in reader-facing files.

## Still unverified (stated as unverified in the book or copy)
1. Which Whop payout methods work in India, and whether a PAN is needed. The book gives readers a test-withdrawal check and never says an Indian withdrawal has been confirmed.
2. Whether Content Rewards accepts creators from India. Its terms show no exclusion, but no page confirms it.
3. Xbox broadcast options (the help page couldn't be read) and whether YouTube Create works on iPhones in India (sources conflict).
4. GTA VI cheats and hidden tricks are left out completely, because the game launches today. Page 33 has a spoiler-free discovery worksheet instead.
5. SuperProfile: UPI support, payment fees, the delivery email and purchase-event tracking (all are checks in `checkout-test-checklist.md`).
6. The **domain:** the brief says `tool.creativecut.in`, but that address doesn't load. The live site is `tools.creativecut.in`, and it has no "Creator Resources" section yet.
7. The KreekCraft brief numbers (budget, rates) are a snapshot from 19 Nov 2026 and will change.

## Left out on purpose
- The Claude Code setup box, because no trusted repository was supplied. The prompts work by pasting plain text into any chat assistant.
- Proof of earnings, because none was supplied.
- Publishing and ad spend. These are left to the owner.

## Update: ChatGPT artwork added
- All 19 images from `GTA6_Toolkit_Images.pdf` are in the book: the cover, the stream scene (Crop A and Crop B are cut from the same image, so they always match), the streamer close-ups (facecam, treatment cards, Ad B), the rooftop scene (pp. 10 and 33), the hand-drawn doodles (arrow, loop, tick, cross, scissors, receipt) and the 7 mission icons in the opener bands.
- All text, the "LIVE · /rexalive" badge, timestamps and numbers are still drawn in code, so they are exact.
- Re-checked: 36 pages, 0 overflow, 14 internal links, tagged PDF, Creative Cut metadata. The PDF is now about 4.5 MB.
- The Mission 4 phone-editor screens stay schematic (their labels must match the steps); they now show the new stream scene.
- Rights note: the images were generated by the owner in ChatGPT. Check OpenAI's current terms for commercial use, and that no image resembles a real game, character or person, before selling.
