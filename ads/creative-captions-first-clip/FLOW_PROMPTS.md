# Google Flow — "Creative Captions — First Clip"

Flow access check (2026-11-25): this cloud session has **no authorized browser session to Google Flow**, so no clips were generated. Run these yourself in Flow (labs.google/flow), project name **Creative Captions — First Clip**, and drop the chosen clips into the folders below. Then re-run `python3 render.py`.

## Reference assignments (create these first in Flow, reuse for every related shot)

| Ref ID | What | Used by |
|---|---|---|
| REF-STREAMER | Generated still: young adult Indian streamer, ordinary cotton T-shirt, modest lived-in room, warm lamp behind, monitor light on face. No brands. | A |
| REF-EDITOR | Generated still: young adult Indian beginner editor, unbranded charcoal T-shirt, compact Delhi NCR bedroom desk, slightly scuffed desk, warm lamp camera-left, ordinary keyboard + mouse, phone on desk. | B1, B2 (both angles) |
| REF-ROOM-B | Same desk/room as REF-EDITOR without the person (lock layout + lamp position). | B1, B2 |

If an original supplied streamer clip exists, skip Setup A and put that clip in `footage/flow_A/`.

## Setup A — The moment → `footage/flow_A/A_take.mp4`

> Vertical 9:16, photoreal live-stream webcam shot, one continuous take, about 4 seconds. A young adult Indian streamer in a modest, lived-in room notices something funny just off camera, tries to hold back a laugh, leans a little toward the desk mic and says to a friend, in natural Delhi Hinglish: "Bhai, ye wala clip karna!" Delivery quick, amused, slightly breathless. Medium close-up, fixed webcam perspective, soft monitor light on the face, warm practical lamp behind, natural skin texture, ordinary cotton T-shirt. Face in the upper-middle of frame, empty space in the lower third for captions. Clean frame: no on-screen words, usernames, overlays, game footage, visible brands or likeness of any real streamer.

References: REF-STREAMER. Generate 4 takes, **pick one**. That single take's picture **and** audio is used three times (00–03, 03–06 late caption, 15–19 plugin replay). Do not regenerate for the replays. The line should start ~0.6 s into the clip.

## Setup B — The first edit

Shared style line (prepend to both):
> Vertical 9:16 cinematic documentary footage, evening, compact Delhi NCR bedroom desk. Young adult Indian beginner editor, unbranded charcoal T-shirt, slightly scuffed desk, warm lamp at camera left, soft monitor light, ordinary keyboard. Understated, focused acting. No software interface, no letters, no captions, no logos, no transition effects. Locked camera.

**B1 → `footage/flow_B1/B1_marker.mp4`** (≈2 s)
> Tight side angle at desk height: the editor's index finger presses a single key on the keyboard, then moves to the mouse. One small action. Shallow depth of field, lamp light from camera left.

**B2 → `footage/flow_B2/B2_shoulder.mp4`** (≈6 s, cut into two beats)
> Over the editor's shoulder toward the monitor. The monitor shows a flat, evenly lit, still mid-grey surface with four clear corners (for screen replacement). Beat 1: a quiet pause, the editor slightly leans back after hearing something sound wrong. Beat 2: the editor picks up a phone, watches it, and gives a small satisfied smile. Phone screen also a plain, flat, trackable surface.

References for both: REF-EDITOR + REF-ROOM-B. Check that wardrobe, lamp position, desk layout and light direction match between B1 and B2 before downloading.

## After generation
- Screen replace the B2 monitor and phone with the real AE capture / the plugin-captioned replay (track the four corners in AE).
- Do not keep any generated UI, text or logo that slips in. Regenerate instead.
