# Creative Captions: Meta ad kit (India launch)

Three ads for Creative Captions by Creative Cut Tools, with editable sources and build scripts.

> **Status: production kit ready, waiting on real After Effects captures.**
> Everything in `out/` is currently a `-PLACEHOLDER` render: the right size, final copy, final motion and audio, but with labelled slates where the real AE footage goes, and a red "not for publishing" banner. Drop the files listed in `RECORDING-BRIEF.md` into `captures/` and run the builds again. The suffix and banner disappear on their own once every capture is found.

| File | What it is |
|---|---|
| `COPY.md` | Three hooks per creative, the chosen ones, final Meta primary text / headline / CTA, UTM links, a suggested ₹4,000 test |
| `RECORDING-BRIEF.md` | Exactly what to record in AE, with filenames, the script line and screen settings |
| `VERIFICATION.md` | Every claim checked against the live site, what is still unverified, QA results |
| `static/creative-1-client-revision.html` | Creative 1 source (1080×1350) |
| `static/creative-2-style-variety.html` | Creative 2 source (1080×1350) |
| `video/edl.json` | Video edit list: which capture plays when, crops, callout rings, SFX cues |
| `video/overlay.html` | Motion-graphics layer (text, rings, end card) |
| `video/make_audio.py` | Synthesised music bed and SFX (owned, no licences) |
| `video/build.js` | Builds the MP4 (footage + overlay + audio) and the thumbnail frame |
| `video/thumbnail.html` | Video thumbnail source (1080×1920) |
| `out/` | Rendered PNGs and MP4 |

## Build
From `ads/creative-captions/` (needs Node with Playwright, Python 3 with numpy, and ffmpeg):

```bash
python3 video/make_audio.py
```

```bash
node video/build.js
```

```bash
node static/render.js
```

Run `build.js` before `render.js`: the build pulls the thumbnail frame out of `v06-final.mp4`. The video build takes about 2–3 minutes.

## After the captures arrive
1. Put the files in `captures/` using the exact names in the brief.
2. Run the video build once, then open `out/creative-3-never-ever-30s.mp4`.
3. In `video/edl.json`, set each segment's `crop` to the part of your screen that matters (panel, timeline or comp viewer), and move the `callouts` rings onto the real Generate button and the corrected word. Adjust `srcIn` so each action falls inside its slot, and move the matching `sfx` times (for example the click at 8.0 s).
4. In the statics, the `object-position` in `creative-2-style-variety.html` keeps the caption band in view. Nudge it if your captions sit higher or lower.
5. Run both builds again and go through the checklist in `VERIFICATION.md`.

Nothing here publishes ads or spends budget.
