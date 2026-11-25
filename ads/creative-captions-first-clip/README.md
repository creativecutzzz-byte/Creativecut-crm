# Creative Captions — "First Clip" · 27 s Reels ad

**Status: ROUGH CUT.** None of the picture or sound assets for this ad were supplied, so every missing shot is a red-bannered MISSING slate and the exports are named `ROUGH-CUT`.

## 1. Asset check (2026-11-25)

Searched: this repo (the Creativecut CRM codebase), the user's Google Drive, and the live site tools.creativecut.in.

| Role | Found? | File / source |
|---|---|---|
| Creative Captions 3D model (.blend/.glb/.fbx) | **MISSING** | Not in the repo or Drive. Drive "Blender Files \| 3D" only holds `GoldStrings 750ml.zip` (another client). |
| Linked textures | **MISSING** | (come with the model) |
| Official Creative Captions wordmark | **MISSING** | Live site shows the "Creative Cut Tools" mark (`/brand/mark-dark.png`). The repo has `public/brand/mark.png` + `lockup-ink.png` (Creative Cut). The rough cut uses `mark.png` + "Creative Captions" set in Satoshi, labelled as a placeholder. |
| Fonts | Found | `src/app/fonts/Satoshi-400/500/700.woff2` → converted to `fonts/*.ttf`. Bebas Neue (headings) did not download here, so the rough cut uses Satoshi Bold. |
| Brand guidelines | **MISSING** (partial) | No guideline doc. Colours come from `src/app/globals.css` and the Oct-2026 ad-scripts doc: ink `#0A0A0C`, lime `#C8F53C`, text `#F4F4F2`, muted `#A7A7A7`. |
| Approved Instagram Reel references | Partial (Drive, older) | `Creative-Captions_Meta-Ad_30s_9x16_No-VO.mp4`, `KMIT-Creative-Caption-V2-Six-Ads.zip`, Stories PNGs (01–06 V2). These are older agency work, used for reference only. |
| Approved product renders | Found (Drive, not downloaded) | `04 — Product Hero Static/Creative-Caption-Product-Hero-2160x2700.png` and `-1080x1350.png`. This is the fallback for a 2.5D slide. Too large to pull through the Drive connector here; drop one into `footage/hero_render/`. |
| AE panel recording | **MISSING** | `Creative-Captions_Editable-Motion-Project.zip` (Drive) may have panel stills. It is not a recording of the installed build. |
| Original streamer clip / voice | **MISSING** | none, so Flow Setup A is used |
| Founder VO (Hemant) | **MISSING** | none, so `vo.wav` stem is silent |
| Music | Original placeholder | Synthesized in `render.py` (no licence needed). Replace if a licensed track is preferred. |

**Live destination check** (tools.creativecut.in/captions + /pricing, 200 OK): product "Creative Captions", v0.9.9, AE 2022+, Win/Mac. **No free trial, no coupon, and no INR price is shown.** The older script's "7 days free / CREATIVE20" is out of date, so **the ad carries no price, coupon or trial.** Site wording for the flow: "Pick a layer, press Generate", "Choose a style and language, press Generate". The exact click order still has to come from the real capture.

## 2. Google Flow
No authorized Flow browser session exists in this cloud session. The exact prompts and reference assignments are in **FLOW_PROMPTS.md**.

## 3. Drop-in folders → re-run `python3 render.py`
```
footage/flow_A/        chosen streamer take (picture+audio, reused 3×)
footage/flow_B1/       marker-tap angle
footage/flow_B2/       over-shoulder pause + phone smile
footage/ae_capture/    real AE capture: select layer → style → Generate, then clip→CLIP edit
footage/hero_render/   blender/hero_render.py output (or approved hero PNG)
audio/vo/              Hemant VO (run through Creative Captions for the VO captions)
audio/music/           licensed track (optional)
```
`render.py` detects each file and drops that shot's MISSING slate and the ROUGH-CUT label once nothing is missing. **Known gap:** the code that composites real video into the frame is not written yet. Today a found file only clears its slate, and the picture behind it stays blank. When the footage arrives, the finishing pass is: in AE, a 1080×1920 comp built from `edit_27()` / `edit_15()` timings, the genuine plugin captions on the replay (one caption set only), and screen-replace on B2.

## 4. Locked edit as built
| Time | Shot | Audio |
|---|---|---|
| 0.0–2.3 | A take + chip "After Effects mein pehla clip?" | streamer line |
| 2.3–3.0 | B1 marker tap | key + mouse SFX |
| 3.0–4.9 | A replay, plain white caption arrives ~0.9 s late | VO "Moment mil gaya. Bas caption late tha." |
| 4.9–6.0 | B2 pause | — |
| 6.0–9.0 | 3D hero → panel | VO "Isi ke liye humne Creative Captions banaya." |
| 9.0–15.0 | Select layer / style / Generate · cut across processing at 13.4 | VO "After Effects mein layer select karo…" + clicks |
| 15.0–19.0 | A replay, word-by-word captions, "clip" in lime on the word (16.5 s) | music ducked to 25% |
| 19.0–23.0 | Native AE text layer clip → CLIP | VO "Hinglish bhi…" |
| 23.0–27.0 | Phone replay → hero + wordmark + end card "Apne pehle clip pe try karo." · tools.creativecut.in/captions | VO "Apna pehla clip…" |

15 s cutdown: 0–3 hook · 3–5 late caption · 5–9 Generate · 9–12 corrected replay · 12–15 CTA.

## 5. Exports (`exports/`)
- `CreativeCaptions_FirstClip_ROUGH-CUT_27s_1080x1920.mp4`: H.264 High, yuv420p, 30 fps, AAC 48 kHz, 27.000 s
- `CreativeCaptions_FirstClip_ROUGH-CUT_15s_1080x1920.mp4`: 15.000 s
- `27s_stems/` and `15s_stems/`: `vo.wav` (silent, VO missing), `music.wav`, `effects.wav`
- `render_report.json`: missing list

Verified: duration, dimensions and codecs (ffprobe), plus a frame check at phone size. The text sits inside the Reels safe zone (top 250 px, bottom 340 px, right 120 px kept clear). The muted read of the open (hook chip) and the end (end card) is understandable. Audio sync against real dialogue could not be checked because no dialogue or VO exists yet.
