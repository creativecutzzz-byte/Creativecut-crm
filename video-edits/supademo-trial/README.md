# Supademo editor trial: 30-second recreation (After Effects)

The brief was to edit the first 30 seconds of Halva's raw footage so it matches Supademo's
YouTube video *"I Studied 1000 SaaS Demo Videos, Here's Why Most Fail"*
(https://www.youtube.com/watch?v=1WXxcFaEEVE, from 0:10) as closely as possible, styled after supademo.com.

## Files

| File | What it is |
|---|---|
| `Supademo_Trial_Build.jsx` | Builds the whole editable AE project: comps, shape and text layers, keyframes, text animators, colour controls. It then saves `Supademo_Trial_Edit.aep`. |
| `previews/trial30_animatic.mp4` | Low-res animatic of the 30s trial (ref 0:10–0:40), rendered with ffmpeg to check cuts and timing. The graphics are flat stand-ins, not the AE look. |
| `previews/reference_vs_edit.png` | Top: this edit at 0, 6, 12 … 48s. Bottom: the reference at the same timestamps. |
| `previews/render_animatic.py` | Script that renders the animatic. |

## Open it in After Effects

1. Put `Supademo_Trial_Build.jsx` in the same folder as `Halva Editor Trial - Raw footage.mp4`. If it can't find the file, it asks you to pick it.
2. Install **Inter** (Bold and SemiBold). It's the font supademo.com uses: https://rsms.me/inter/
3. In AE: **File → Scripts → Run Script File…**, then pick the `.jsx`. It takes about 10 seconds.
4. Open `00_TRIAL_30s_A (ref 0-10 to 0-40)`. That's the deliverable, and it's already in the Render Queue.

### Project structure

```
SUPADEMO TRIAL/
  00_TRIAL_30s_A (ref 0-10 to 0-40)   ← the brief (30s window starting at 0:10)
  00_TRIAL_30s_B (ref 0-00 to 0-30)   ← same edit from 0:00, in case that's what the client meant
  01_MASTER                           ← full 0:00–0:49 edit; both trial comps nest this
    CONTROLS (null)                   ← Brand Magenta / Dark BG / Grid Lines; every fill is linked
    CAP 1-5                           ← phrase captions; magenta words come from "Highlight" animators
    GFX_01 … GFX_06                   ← graphics precomps
    CARD FRAME                        ← rounded A-roll inset before the dark panel
    LOOK grade / LOOK vignette        ← adjustment + vignette; affect the A-roll only
    A01 … A06                         ← A-roll selects, 2-frame audio fades on every cut
  02 GFX precomps/  01 Footage/  03 Solids/
```

Comp markers in `01_MASTER` mark where each SFX goes (whoosh, pop, click, riser).
No music or SFX came with the footage, so add your own library on those markers.

## Research notes

**Reference video.** YouTube blocks this cloud IP for downloads, so I worked from YouTube's own
storyboard frames: 1 frame every 6 seconds, at 320×180. I measured every graphic's position and size
from those frames, and sampled the colours from them.

**Raw footage.** One 12:22 file, 4K at 30fps. It's a single-camera bookshelf setup with 2–3 takes of most lines.
I transcribed it with word-level timestamps (Whisper) and matched it against the storyboard:

- The reference uses **intro take 2** (raw 13.6s) and runs straight into **take 1 of "we found one thing"** (raw 30.9s).
  You can see it in the presenter's matching hand pose at 0:24 and 0:48 in `reference_vs_edit.png`.
- After that it jumps to raw 64.1s ("In fact…") and raw 75.0s ("So in this video…").

**Style guide**, from the reference and supademo.com:

| Token | Value | Used for |
|---|---|---|
| Brand magenta | `#D6248F` | number badges, highlight words, list bullets, the +200,000 counter |
| Dark navy | `#18222B` → `#0B1117` edges | dark panels, card-frame background |
| Ink | `#0C111D` | text on white cards (supademo.com body colour) |
| Indigo | `#444CE7` / `#818CF8` | supademo.com brand; logo placeholders, accent dots |
| Grid paper | white + `#ECECF1` lines, 96px | light full-screen cards |
| Type | Inter Bold / SemiBold | everything |

Captions show a whole phrase at once (not word by word), centred at y≈870, 62px, with a soft shadow.
The reference has no caption on the "In fact…" line.

## Edit decision list (`01_MASTER`)

| Master time | Raw source | Line | Graphic |
|---|---|---|---|
| 0:00.00–0:12.02 | 13.60–25.62 | "We studied a thousand… two simple questions" | CAP 1 → **GFX_01**: grid card, headline, dots that pop into logos on *Beehive / Lightspeed / Lovable*, then a swarm on "tiny bootstrap tools" (2.9–9.7) → CAP 2 |
| 0:12.02–0:16.80 | 25.62–30.40 (punch 112%) | "Are product demos really that profitable… a video?" | **GFX_02**: magenta "1" and "?" badges, question typed on bottom-left, "1" flips to "2" on question two |
| 0:16.80–0:28.43 | 30.92–42.55 | "We actually found one thing… most impressive ones" | **GFX_03**: full-screen grid with a big magenta "1" (17.0–22.6) → CAP 3–5 |
| 0:28.43–0:28.95 | 64.10–64.62 (punch) | "In fact," | — |
| 0:28.95–0:38.95 | 64.98–74.98 | "…worst performing… beautiful, expensive, useless…" | **CARD FRAME** pull-in (29.2) → **GFX_04**: navy panel, UI mock, *Beautiful / Expensive / Useless* on each word (31.5–38.9) |
| 0:38.95–0:49.07 | 74.98–85.10 | "So in this video… seven things… 200,000 companies" | **GFX_05**: "In this video" chapter list, presenter shrinks into a rounded PiP (39.0–44.9) → **GFX_06**: +200,000 count-up (46.4) |

## Things to finish by hand (polish pass)

- **Logos:** `LOGO Beehiiv / Lightspeed / Lovable (replace)` in GFX_01 are indigo circles with initials.
  Import the real logos, select the placeholder, and Alt/Option-drag the PNG onto it. The animation is kept.
- **UI mock:** `UI_Mock_REPLACE_with_screenshot` in GFX_04 stands in for a screenshot of a Supademo demo gallery.
  Replace it the same way.
- **Chapter titles 4–7** in GFX_05 are my guesses; they're blurred in the reference.
- **Smoothing:** keyframes use easy-ease at 60–85% influence. For the snappy Supademo feel, open the graph editor on
  the `pop()` scale keys and the `placeGfx` scale-in keys and pull the outgoing handles harder.
  Adding motion blur to the GFX layers helps too.
- **Grade:** `LOOK grade` has Exposure −0.15, a 12% warming photo filter, and an untouched Lumetri you can tune.
- **SFX and music:** follow the comp markers.

## Re-timing

All timings are data at the top of the `.jsx`:

- `SEGMENTS` holds the raw in/out points and master start of each A-roll cut.
- `CAPTIONS` holds each caption's raw word times and highlight words.
- Every graphic converts raw → master time with `M()`, so changing a cut moves its graphics with it. Re-run the script into a fresh project.
