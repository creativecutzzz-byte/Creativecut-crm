# Recording brief: real After Effects captures

**Why this exists:** all three ads need proof from the real Creative Captions panel running in Adobe After Effects. The production environment has no After Effects, so nothing here has been recorded yet. Every render in `out/` is a **placeholder layout** until these files are dropped into `captures/` and the builds are run again.

Not acceptable as product footage: redrawn or imitation AE UI, website previews (including the style gallery on tools.creativecut.in), AI-generated video of the interface (for example from Google Flow or Veo), stock laptop screens.

---

## 0. Set up (5 minutes)

1. **Spoken clip you own.** Film yourself (or a teammate who consents to appearing in ads) on a phone, 9:16, 8–10 seconds, in English. Say:
   > "Free trial class this **Sunday**. Book your spot. Link in bio."

   The word *Sunday* is the one the client "revises" to **Saturday** later. Keep the same clip for every capture.
2. **AE project:** 1080×1920 comp at 30 fps, named `Reel_Demo` (avoid client or personal names). Footage layer named `talking_head.mp4`.
3. **Screen:** record at 2560×1440 or higher, with OS display scaling at 100–125% so the panel text stays crisp when cropped. Use AE's default dark theme. Turn on Do Not Disturb. Hide the dock/taskbar, desktop icons, browser tabs and any client project names.
4. **Workspace:** Comp viewer large on the left, **Creative Captions** panel (Window → Extensions → Creative Captions) docked on the right at a comfortable width, Timeline across the bottom. Keep this layout for every take so crops stay consistent.
5. **Cursor:** move slowly and pause about 0.5 s on each control before clicking. No circling.
6. Recorder: OBS (or similar) at 60 fps, MKV/MOV, CRF ≤ 18. Re-mux to `.mp4` or `.mov`.

> Before recording, check: the actual control names in the panel, how the style is changed on captions that already exist (re-generate, or a one-click swap), and whether any of the three chosen styles needs AE 24.3+. Write those down in `captures/NOTES.md` so the on-screen labels match the real UI exactly.

---

## 1. Minimum footage needed (exact filenames)

Put these in `ads/creative-captions/captures/`. Names must match.

### Screen recordings (video ad)
| File | Length | What to capture |
|---|---|---|
| `v01-before.mp4` | 6 s | The uncaptioned clip **playing in the Comp viewer**, then the Timeline showing only the footage layer (no captions yet). |
| `v02-setup.mp4` | 6–10 s | In the Creative Captions panel: select the footage layer, choose **English**, pick **Viral Bold**, move to **Generate** and click. |
| `v03-generate.mp4` | real time | From the Generate click until captions appear on the Timeline as text layers, then about 2 s of playback. **Keep it unedited:** the build speeds it up and adds the label "Processing sped up". |
| `v04-styles.mp4` | 10–15 s | On the same frame, change the style to **Red Box Italic**, then **Golden Script**, using the panel's real control. Hold each result about 2 s with the caption visible in the Comp viewer. |
| `v05-correction.mp4` | 8–12 s | Select the caption text layer containing SUNDAY in the Timeline. Double-click it in the Comp viewer, type **SATURDAY**, press Enter or Esc to commit, then scrub or play so the corrected word is visible. |
| `v06-final.mp4` | 6 s | The finished reel **rendered out of AE** (1080×1920 export) in Viral Bold with SATURDAY, so the close shows the real output full-screen. |

### Stills (static ads)
Export these from AE (File → Export → Save Frame As) or grab them from the recordings above. Save as PNG at full resolution with no scaling.
| File | Content |
|---|---|
| `c1-before.png` | Comp viewer: the caption showing **SUNDAY** (same frame as the after shot). |
| `c1-after.png` | Same frame: the caption showing **SATURDAY**. |
| `c1-timeline.png` | Timeline crop with the caption **text layer selected** (layer name readable), ideally with the text cursor active in the comp. |
| `c2-style-1.png` | One frame of the comp with **Viral Bold** captions. |
| `c2-style-2.png` | **Same frame and words** with **Red Box Italic**. |
| `c2-style-3.png` | **Same frame and words** with **Golden Script**. |
| `c2-panel.png` | Crop of the Creative Captions panel showing the style selector (and language), readable at 100%. |

To grab a still from a recording:

```bash
ffmpeg -ss 00:00:04.2 -i captures/v05-correction.mp4 -frames:v 1 captures/c1-after.png
```

The stills only need to be comp-viewer crops of the right **content**. The templates handle the cropping and layout, so you don't need to frame them precisely.

---

## 2. How the edit uses the footage (video)

| Time | Shot | Reframe (crop from your screen) | Treatment |
|---|---|---|---|
| 0–3 s | v01 | Comp viewer only | Hard cut in, "NEVER EVER" slams on |
| 3–6 s | v01 tail | Timeline with the single footage layer | "Let captions become a second edit." |
| 6–9 s | v02 | Panel, tight around the language, style and Generate controls | Step chips ① ② ③ plus a lime ring on Generate at the click |
| 9–12 s | v03 | Timeline plus Comp viewer | Sped up and labelled "Processing sped up". Result line: "Word-timed. Editable text layers." |
| 12–18 s | v04 (plus v02/v03 for Viral Bold) | Comp viewer, the same crop for all three | 2 s per style, preset name chip |
| 18–24 s | v05 | Timeline layer to Comp viewer word | "Client revision?" then "Keep editing." with a ring on the word |
| 24–27 s | v06 | Full frame (it's already 9:16) | "Your next reel. Captioned." |
| 27–30 s | v06 dimmed | — | End card and offer |

Crops are set in `video/edl.json` (source pixels). After you drop in the captures, adjust the `crop` boxes once and run the build again. Each crop is scaled to fit a 1000 px wide card, so the UI keeps its proportions and is never stretched.

## 3. Rights
Use only footage you own or have written permission to feature. That includes the person speaking, any music in the clip, and fonts that appear in the panel. The ad's music and sound effects are synthesized by `video/make_audio.py` and owned outright.
