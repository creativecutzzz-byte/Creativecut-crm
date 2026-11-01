# Verification log and review checklist

## Claims checked against the live site (2026-11-01)
I read https://tools.creativecut.in/captions in a headless browser with the ₹ INR toggle on, plus the embedded style gallery at `/embed/captions/index.html?view=gallery`.

| Claim used in ads | Site wording | Status |
|---|---|---|
| 7-day Pro trial, no card | "7 days of Pro free · no card needed · Windows & Mac"; FAQ: "7 days of everything in Pro. No card needed." | ✅ Verified |
| Generates captions inside AE | "Pick a layer, press Generate. Words are timed to the speech…" | ✅ Verified (site copy, not yet seen in the panel) |
| Editable AE text layers | "Real AE layers: Plain text layers and keyframes you can edit" | ✅ Verified (site copy) |
| 37 styles | "37 STYLES"; the gallery lists 37 names | ✅ Verified |
| 22 languages | 22 listed | ✅ Verified |
| 24 sound effects | Pricing: "24 sounds synced to your captions" (hero shows "24+") | ✅ Verified |
| English, Hindi, Hinglish | "Basic covers English, Hindi and Hinglish" | ✅ Verified |
| Transcription runs locally | "Transcription runs locally inside After Effects. Your client footage never leaves your computer." | ✅ Verified |
| AE 2022+ on Windows/Mac | "After Effects 2022 or newer on Windows and macOS" | ✅ Verified. Golden Script (and Big Word Stack) need AE 24.3+ for full styling |
| ₹299 Basic / ₹599 Pro (31 days) / ₹2,999 Lifetime | Shown with "31 days · one-time payment · no auto-renewal" | ✅ Verified. Not used in the ads themselves |
| CREATIVE20 = 20% off Pro | Live coupon API: `{"ok":true,"percent":20}` for Pro; "That code works on Pro only." for Basic and Lifetime | ✅ Verified 2026-11-01. Used only in the retargeting variant |
| Lifetime "first 100 buyers" | "Launch price for the first 100 buyers" | ✅ True today, but left out of cold ads |
| Style names Viral Bold, Red Box Italic, Golden Script | All three appear in the gallery and the plugin source | ✅ Names verified · Golden Script's script line needs AE 24.3+ · ⚠️ appearance in AE not yet captured |
| Panel controls: "Generate captions", "Apply to comp", LOOK tiles, EN English, `CC 001` layers | Read from the plugin source (creative-cut-website, panel v0.9.8) by the plugin session | ✅ From source · ⚠️ confirm in the recording |
| Restyle without re-transcribing | Source: "Apply to comp" rebuilds from the same transcript | ✅ From source · ⚠️ confirm in the recording |
| 14-day money-back on first purchases | Site: "14-day money-back on first purchases." | ✅ Verified (retargeting copy only) |

## Not verified (needs you, in After Effects)
- That the panel looks and behaves as the source describes on your machine. The control names above came from the code, not from a recording.
- Every visual in all three creatives. No AE capture exists yet, so **all renders in `out/` are `-PLACEHOLDER` layouts, not finished ads.**
- Any speed or timing claim. None is made in the ads. The video labels sped-up processing with its real speed factor.

## Logo
`assets/brand/creative-cut-tools-mark-256.png` is the 256 px app icon from tools.creativecut.in (the lime "C" mark). It's sharp at the sizes used (64–150 px). Send the master SVG or a 1024 px PNG and it can be swapped in with the same filename.

## Automated checks run on the build
| Check | Result |
|---|---|
| Static PNG size | 1080×1350 (×2) ✅ · thumbnail 1080×1920 ✅ |
| Video | 1080×1920, 30 fps, 900 frames, 30.000 s, H.264 High yuv420p, AAC-LC 48 kHz stereo, faststart ✅ |
| Audio level | −15.2 LUFS integrated, −1.0 dBFS sample peak (loudnorm target −14 LUFS / −1.5 dBTP), no voiceover ✅ |
| Music/SFX rights | Synthesised by `video/make_audio.py`, no third-party samples ✅ |
| Fonts | Anton and Inter, both SIL OFL ✅ |
| Safe area | Key video copy sits between y 270 and 1250 (Reels top 14% and bottom 35% kept clear). The CTA end card is at y 330–1130 ✅ |

## Re-check once the real captures are in
- [ ] Spelling of every on-screen word (SATURDAY, preset names, URL)
- [ ] Footage crops show readable panel text at phone size (preview the PNG at 360 px wide)
- [ ] The Generate ring and the word ring land on the real controls (`edl.json` → `callouts`)
- [ ] The "sped up" label shows on the generate shot if the build sped it up
- [ ] No notifications, file paths, client names or emails visible in any frame
- [ ] Watch the MP4 on a phone with sound on and off; text still makes sense muted
- [ ] File names have no `-PLACEHOLDER` suffix (meaning every capture was found)
