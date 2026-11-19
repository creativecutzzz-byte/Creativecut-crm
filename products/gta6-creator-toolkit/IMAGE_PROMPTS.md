# Image prompt for ChatGPT: GTA 6 Creator Toolkit

Paste everything inside the box below into ChatGPT in one go.
Then bring the PDF (or the PNGs) back to Claude Code. Each picture will be placed in its slot, and the book will be rebuilt.

**Important:** ChatGPT often gets the text inside images wrong (timestamps, "LIVE · /rexalive", prices). So these prompts ask for **no text at all**. All words, the overlay badge, the arrows' labels and the numbers are added afterwards in code, so they come out exactly right.
The phone-editor screens (Mission 4 trim, reframe and captions) stay drawn in code, because their labels have to match the steps exactly.

```text
You are illustrating an original e-book called "GTA 6 Creator Toolkit" (a phone video-editing guide).
Make 19 separate images, one by one, in the order below. Follow these rules for EVERY image:

STYLE RULES
- Flat vector illustration, clean bold shapes, soft gradients, slight hand-made feel. Modern, friendly, premium.
- Palette ONLY: sunset peach #FFB583, coral pink #F575A6, violet #8659D5, deep plum #21152E, warm paper #FFF8F1
  (plus white and near-black for small details).
- Mood: dusk / sunset over a tropical coastal city with palm trees.
- ABSOLUTELY NO TEXT, letters, numbers, logos, watermarks, signatures or UI labels anywhere in any image.
- 100% original. Do NOT copy or resemble any real video game, game characters, game logos, Rockstar Games artwork,
  or any real person or streamer. No weapons, no violence, no police, no gore.
- Same character design every time the streamer appears (see image 03).

THE IMAGES (use the exact number and file name)

01-cover-art.png  — portrait 1024x1536.
  A smartphone held upright, tilted slightly left, in the lower-middle of the frame. Its screen shows an abstract
  vertical video-editing timeline: colourful clip blocks, an audio waveform strip, a white playhead line, and a small
  9:16 preview window showing a sunset skyline. Behind it: a big dusk sky gradient (plum at top -> violet -> coral ->
  peach near the horizon), a soft glowing sun, a city skyline silhouette and palm silhouettes at the bottom.
  Thin white "crop frame" corner brackets floating around the phone.
  KEEP THE TOP 40% OF THE IMAGE AS CLEAN EMPTY SKY (a title will go there) and a clean dark strip at the very bottom.

02-stream-scene.png — landscape 1536x1024 (will be cropped to 16:9).
  A screenshot-style scene from a FICTIONAL livestream of an original open-world driving game: a city street at sunset,
  palm trees, a white compact car reversing and bumping into a small fruit stand, with yellow mangoes rolling onto the road.
  Bottom-left corner: a rounded "facecam" box showing the streamer (character from image 03) with headphones, laughing.
  Top-right corner: leave a clean, uncluttered patch of sky (an overlay badge will be placed there later).
  Keep important things away from the centre-left/right edges exactly as described, because the image is cropped later.

03-streamer-laughing.png — square 1024x1024.
  Close-up head-and-shoulders of an ORIGINAL friendly cartoon streamer: young Indian-looking adult, short dark hair,
  big over-ear headphones in plum, violet hoodie, laughing hard with eyes closed. Plain soft dark-plum background.
  This is the reference design for the character; keep it identical in 04 and 05.

04-streamer-shocked.png — square 1024x1024. Same character, same framing, mouth open, eyebrows up, shocked.

05-streamer-amazed.png — square 1024x1024. Same character, same framing, calm amazed smile, looking up at something
  beautiful, warm sunset light on the face.

06-rooftop-view.png — landscape 1536x1024.
  View from a rooftop over the coastal city at sunset: ocean, skyline, palms, glowing sky. A small silhouette of the
  streamer's game character standing at the edge, seen from behind. Peaceful, "wow" moment. No story elements.

DOODLES (07-12): each on a PURE WHITE background, centred, nothing else in the frame, square 1024x1024,
looking hand-drawn with a thick marker/pencil, single colour as stated.
07-doodle-loop.png     — a loose hand-drawn oval loop (like circling a word), coral #F575A6, slightly overshooting ends.
08-doodle-scissors.png — open scissors drawn as a simple line icon, coral #F575A6, pointing down.
09-doodle-arrow.png    — one curved hand-drawn arrow sweeping from bottom-right to top-left, deep pink #C2255C.
10-doodle-tick.png     — a big hand-drawn check mark, green #1F8A5B.
11-doodle-cross.png    — a big hand-drawn X, deep pink #C2255C.
12-receipt-blank.png   — portrait 1024x1536: a blank white paper till receipt with a zigzag torn bottom edge,
                          soft shadow, slight curl, NO text or lines on it, on a pure white background.

MISSION ICONS (13-19): square 1024x1024, flat icon-illustration, same palette, on a PURE WHITE background,
one simple centred object, generous empty margin, no text.
13-icon-m1-brief.png       — a clipboard with a checklist (blank lines, ticks) and a small pin.
14-icon-m2-moments.png     — a magnifying glass over a strip of three video frames.
15-icon-m3-plan.png        — a storyboard: three small panels with arrows between them.
16-icon-m4-edit.png        — a hand holding a phone with a vertical timeline on screen and scissors beside it.
17-icon-m5-check.png       — a 9:16 phone frame with a magnifying glass over its top-right corner.
18-icon-m6-publish.png     — a phone with an upward "send/upload" arrow and a small clock.
19-icon-m7-earn.png        — a calculator next to a short receipt and a small play-button icon (no money symbols).

WHEN ALL 19 ARE DONE
- Put all 19 images into ONE PDF, one image per page, in the exact order 01 -> 19, each image full-size, uncropped,
  nothing else on the page. Name it GTA6_Toolkit_Images.pdf and give me the download link.
- Also give me a ZIP of the 19 PNG files with the exact file names above.
- If you cannot make the PDF or ZIP, just list the 19 images with their numbers so I can download each one.
```

## What happens when you bring them back

1. Pull each image out of the PDF in page order (page N = image N).
2. Crop to the exact sizes; make the doodle and icon backgrounds transparent.
3. Place them: 01 → cover; 02 → stream frame and both Spot-the-Rejection crops A/B (derived in code from the same image, so A and B always match); 03 → facecam in the stacked layout; 03/04/05 → the three treatment cards and Ad B; 06 → the discovery moment and the worksheet page; 07–12 → the teaching doodles; 13–19 → the mission opener bands.
4. Keep the exact text, the "LIVE · /rexalive" badge, the labels and the numbers in code, then rebuild the PDF, the cover PNG, the preview and the ads. Re-run the overflow, link and 375 px phone checks.
