#!/usr/bin/env python3
"""Creative Captions — "First Clip" Reels ad. Rough-cut assembler.

Re-run any time:  python3 render.py
Every shot uses the real file when it is in footage/ or audio/. Otherwise it
renders a visible MISSING slate, and the export name says ROUGH-CUT.
Needs: Python 3 + Pillow, ffmpeg with libx264/aac.
"""
import json, math, os, random, shutil, struct, subprocess, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
W, H, FPS, SR = 1080, 1920, 30, 48000
BUILD = ROOT / "build"
OUT = ROOT / "exports"

# Brand tokens: src/app/globals.css (Creative Cut) and the Oct-2026 Creative Captions design rules
INK, FG, MUTED, ACCENT, FOREST = "#0a0a0c", "#f4f4f2", "#a7a7a7", "#c8f53c", "#1d4228"
WARN = "#ff4d4d"
F_BOLD = str(ROOT / "fonts/Satoshi-700.ttf")
F_REG = str(ROOT / "fonts/Satoshi-400.ttf")

# Reels safe zone (1080x1920): keep text out of top 250px and bottom 340px, right 120px (UI rail)
SAFE_TOP, SAFE_BOTTOM, SAFE_RIGHT = 250, 1920 - 340, 1080 - 120

def font(path, size): return ImageFont.truetype(path, size)

def find(folder, exts=(".mp4", ".mov", ".png", ".jpg", ".wav")):
    d = ROOT / folder
    if not d.exists(): return None
    files = sorted(p for p in d.iterdir() if p.suffix.lower() in exts)
    return files[0] if files else None

ASSETS = {
    "flow_A (streamer moment)": "footage/flow_A",
    "flow_B1 (marker tap)": "footage/flow_B1",
    "flow_B2 (over-shoulder)": "footage/flow_B2",
    "AE panel capture": "footage/ae_capture",
    "Product hero render (3D model)": "footage/hero_render",
    "Founder VO (Hemant)": "audio/vo",
    "Licensed music": "audio/music",
}
STATUS = {k: find(v) for k, v in ASSETS.items()}
MISSING = [k for k, v in STATUS.items() if v is None]
# The official Creative Captions wordmark and the brand guidelines were not supplied at all
MISSING += ["Official Creative Captions wordmark", "Brand guidelines"]
ROUGH = bool(MISSING)

# ---------------------------------------------------------------- drawing helpers
def text_c(d, y, s, f, fill, x=W // 2, stroke=0, sfill=INK):
    d.text((x, y), s, font=f, fill=fill, anchor="mm", stroke_width=stroke, stroke_fill=sfill)

def base(bg=INK):
    return Image.new("RGB", (W, H), bg)

def missing_slate(img, title, lines, tone=(26, 30, 24)):
    d = ImageDraw.Draw(img)
    for y in range(H):  # soft vertical gradient so slates read as "picture"
        k = y / H
        d.line([(0, y), (W, y)], fill=(int(tone[0] + 30 * k), int(tone[1] + 18 * k), int(tone[2] + 8 * k)))
    d.rectangle([40, 300, W - 40, 420], fill=WARN)
    text_c(d, 360, "MISSING: " + title, font(F_BOLD, 40), "white")
    y = 470
    for ln in lines:
        text_c(d, y, ln, font(F_REG, 34), MUTED); y += 50
    return img

def rough_tag(img):
    if not ROUGH: return img
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 64], fill=WARN)
    text_c(d, 32, "ROUGH CUT — missing brand / model / VO / real demo", font(F_BOLD, 30), "white")
    return img

def caption(d, words, active, y, size=88, emph=None):
    """Draw a word-by-word caption line. `active` = index of the word being spoken."""
    f = font(F_BOLD, size)
    widths = [d.textlength(w, font=f) for w in words]
    gap = size * 0.28
    x = (W - (sum(widths) + gap * (len(words) - 1))) / 2
    for i, w in enumerate(words):
        if i > active: break
        col = ACCENT if (emph is not None and i == emph) or i == active else FG
        d.text((x, y), w, font=f, fill=col, anchor="lm", stroke_width=6, stroke_fill=INK)
        x += widths[i] + gap

def vo_caption(d, s, y=1420):
    """Placeholder for plugin-generated VO captions (the plugin must be applied to the real VO)."""
    f = font(F_BOLD, 54)
    lines, cur = [], ""
    for w in s.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) > SAFE_RIGHT - 120: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur)
    for i, ln in enumerate(lines):
        text_c(d, y + i * 70, ln, f, FG, x=(SAFE_RIGHT + 60) // 2 + 30, stroke=5)
    d.text((60, y - 60), "VO caption — replace with plugin output", font=font(F_REG, 24), fill=WARN)

def chip(d, y, s, fill=ACCENT, fg=INK, size=46):
    f = font(F_BOLD, size)
    tw = d.textlength(s, font=f)
    x0 = (W - tw) / 2 - 36
    d.rounded_rectangle([x0, y - size, x0 + tw + 72, y + size], radius=size, fill=fill)
    text_c(d, y, s, f, fg)

def mark(img, cx, cy, size):
    m = Image.open(REPO / "public/brand/mark.png").convert("RGBA").resize((size, size), Image.LANCZOS)
    img.paste(m, (cx - size // 2, cy - size // 2), m)

# ---------------------------------------------------------------- shots
# Each shot: (start, end, draw(img, t_local, t_global)). Streamer line timing inside a take:
LINE = [("Bhai,", 0.60), ("ye", 0.95), ("wala", 1.15), ("clip", 1.50), ("karna!", 1.80)]
LINE_END = 2.15

def streamer(img, label):
    if STATUS["flow_A (streamer moment)"]: return img  # real picture composited by ffmpeg
    return missing_slate(img, "Flow Setup A — streamer", [label, "“Bhai, ye wala clip karna!”",
                         "one take · reuse exact picture + audio"], (40, 28, 20))

def s_hook(img, t, g):
    streamer(img, "00–03 · the moment")
    d = ImageDraw.Draw(img)
    chip(d, SAFE_TOP + 360, "After Effects mein pehla clip?")
    return img

def s_marker(img, t, g):
    if not STATUS["flow_B1 (marker tap)"]:
        missing_slate(img, "Flow B1 — marker tap", ["tight side angle · index finger → marker key", "then to mouse · locked camera"])
    d = ImageDraw.Draw(img); chip(d, SAFE_TOP + 360, "After Effects mein pehla clip?")
    return img

def s_late(img, t, g):
    streamer(img, "03–06 · same take, replay")
    d = ImageDraw.Draw(img)
    # Deliberately LATE manual caption: lands ~0.9s after the word was spoken, in plain white
    if t > LINE_END + 0.5:
        text_c(d, 1180, "bhai ye wala clip karna", font(F_REG, 50), "white", stroke=2)
    vo_caption(d, "Moment mil gaya. Bas caption late tha.")
    return img

def s_pause(img, t, g):
    if not STATUS["flow_B2 (over-shoulder)"]:
        missing_slate(img, "Flow B2 — over-shoulder pause", ["editor hears the mistimed line", "screen = trackable surface"])
    vo_caption(ImageDraw.Draw(img), "Moment mil gaya. Bas caption late tha.")
    return img

def s_hero(img, t, g):
    if not STATUS["Product hero render (3D model)"]:
        missing_slate(img, "Original 3D model render", ["Blender: blender/hero_render.py", "fallback: approved hero still, 2.5D slide",
                       "Drive: Creative-Caption-Product-Hero-*.png"], (14, 20, 14))
        d = ImageDraw.Draw(img)
        k = min(1, t / 1.4)  # placeholder product reveal so timing can be judged
        mark(img, W // 2 - int(40 * (1 - k)), 960, 300)
        text_c(d, 1180, "Creative Captions", font(F_BOLD, 76), FG)
        d.text((60, 1240), "wordmark placeholder — official wordmark missing", font=font(F_REG, 24), fill=WARN)
    vo_caption(ImageDraw.Draw(img), "Isi ke liye humne Creative Captions banaya.")
    return img

def s_panel(img, t, g, step):
    if not STATUS["AE panel capture"]:
        missing_slate(img, "Real AE panel capture", ["installed build · actual click order", "crop tight for phone legibility"], (18, 18, 22))
        d = ImageDraw.Draw(img)
        steps = ["1  Select layer", "2  Choose style", "3  Generate"]
        for i, s in enumerate(steps):
            on = i == step
            y = 860 + i * 150
            d.rounded_rectangle([140, y - 55, W - 220, y + 55], radius=22,
                                fill=ACCENT if on else "#1b1f1a", outline=ACCENT, width=3)
            d.text((180, y), s, font=font(F_BOLD, 52), fill=INK if on else FG, anchor="lm")
        if step == 3:
            text_c(d, 1330, "[edit across processing time]", font(F_REG, 32), MUTED)
    vo_caption(ImageDraw.Draw(img), "After Effects mein layer select karo, style chuno, aur Generate dabao.")
    return img

def s_replay(img, t, g):
    streamer(img, "15–19 · same take, plugin captions")
    d = ImageDraw.Draw(img)
    words = [w for w, _ in LINE]
    active = max([i for i, (_, s) in enumerate(LINE) if t >= s], default=-1)
    if active >= 0 and t < LINE_END + 1.6:
        caption(d, words, active, 1150, emph=3 if t >= LINE[3][1] else None)
    if not STATUS["AE panel capture"]:
        d.text((60, 1260), "SIMULATED — replace with genuine plugin render", font=font(F_REG, 26), fill=WARN)
    return img

def s_layer(img, t, g):
    if not STATUS["AE panel capture"]:
        missing_slate(img, "AE capture — native text layer edit", ["timeline: caption word layer selected", "type “clip” → “CLIP”"], (18, 18, 22))
        d = ImageDraw.Draw(img)
        word = "clip" if t < 1.6 else "CLIP"
        d.rounded_rectangle([160, 880, W - 220, 1040], radius=16, fill="#15181a", outline=ACCENT, width=3)
        d.text((200, 960), "T", font=font(F_BOLD, 60), fill=ACCENT, anchor="lm")
        d.text((280, 960), word, font=font(F_BOLD, 80), fill=FG, anchor="lm")
    vo_caption(ImageDraw.Draw(img), "Hinglish bhi. Aur ‘clip’ pe emphasis chahiye? Yahin edit kar lo.")
    return img

def s_end(img, t, g):
    d = ImageDraw.Draw(img)
    if t < 1.6:  # phone playback beat
        if not STATUS["flow_B2 (over-shoulder)"]:
            missing_slate(img, "Flow B2 — phone replay smile", ["phone shows the captioned replay"])
        vo_caption(ImageDraw.Draw(img), "Apna pehla clip bana rahe ho? Creative Captions try karo.")
        return img
    img.paste(base(), (0, 0))
    d = ImageDraw.Draw(img)
    for r in range(520, 0, -8):  # lime glow behind product
        a = int(40 * (1 - r / 520))
        d.ellipse([W // 2 - r, 820 - r // 2, W // 2 + r, 820 + r // 2], fill=(10 + a // 4, 10 + a // 2, 12))
    if STATUS["Product hero render (3D model)"] is None:
        mark(img, W // 2, 760, 320)
        d.text((60, 960), "hero render missing — mark placeholder", font=font(F_REG, 24), fill=WARN)
    text_c(d, 1060, "Creative Captions", font(F_BOLD, 84), FG)
    text_c(d, 1190, "Apne pehle clip pe try karo.", font(F_BOLD, 58), ACCENT)
    text_c(d, 1290, "tools.creativecut.in/captions", font(F_REG, 46), FG)
    text_c(d, 1370, "For After Effects 2022+ · Windows & Mac", font(F_REG, 32), MUTED)
    return img

def edit_27():
    return [
        (0.0, 2.3, s_hook), (2.3, 3.0, s_marker),
        (3.0, 4.9, s_late), (4.9, 6.0, s_pause),
        (6.0, 7.6, s_hero), (7.6, 9.0, lambda i, t, g: s_panel(i, t, g, -1)),
        (9.0, 10.6, lambda i, t, g: s_panel(i, t, g, 0)), (10.6, 12.2, lambda i, t, g: s_panel(i, t, g, 1)),
        (12.2, 13.4, lambda i, t, g: s_panel(i, t, g, 2)), (13.4, 15.0, lambda i, t, g: s_panel(i, t, g, 3)),
        (15.0, 19.0, s_replay), (19.0, 23.0, s_layer), (23.0, 27.0, s_end),
    ]

def edit_15():
    return [
        (0.0, 2.3, s_hook), (2.3, 3.0, s_marker),
        (3.0, 5.0, s_late),
        (5.0, 6.4, lambda i, t, g: s_panel(i, t, g, 0)), (6.4, 7.6, lambda i, t, g: s_panel(i, t, g, 2)),
        (7.6, 9.0, lambda i, t, g: s_panel(i, t, g, 3)),
        (9.0, 12.0, s_replay), (12.0, 15.0, lambda i, t, g: s_end(i, t + 1.6, g)),
    ]

# ---------------------------------------------------------------- audio (all original / synthesized)
def synth_music(dur, duck):
    """Original warm lo-fi pad + soft kick, generated here: no licensing needed. Replace with licensed track if wanted."""
    n = int(dur * SR); out = [0.0] * n
    chords = [(220.0, 277.18, 329.63), (196.0, 246.94, 293.66), (174.61, 220.0, 261.63), (196.0, 246.94, 329.63)]
    for i in range(n):
        t = i / SR
        c = chords[int(t / 2.0) % 4]
        v = sum(math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t) for f in c) * 0.035
        bt = t % 0.75
        v += math.sin(2 * math.pi * (55 + 60 * math.exp(-bt * 30)) * bt) * math.exp(-bt * 9) * 0.18
        g = 1.0
        for a, b in duck:  # duck under replay / key moments
            if a - 0.3 < t < b + 0.3: g = 0.25
        out[i] = v * g * min(1, t / 0.4) * min(1, (dur - t) / 0.8)
    return out

def synth_sfx(dur, hits):
    n = int(dur * SR); out = [0.0] * n; rnd = random.Random(7)
    for t0, kind in hits:
        s = int(t0 * SR)
        L = int((0.06 if kind != "whoosh" else 0.5) * SR)
        for j in range(L):
            if s + j >= n: break
            x = j / SR
            if kind == "key":   v = (rnd.uniform(-1, 1) * 0.6 + math.sin(2 * math.pi * 2400 * x)) * math.exp(-x * 120) * 0.5
            elif kind == "click": v = rnd.uniform(-1, 1) * math.exp(-x * 200) * 0.45
            else:               v = rnd.uniform(-1, 1) * math.sin(math.pi * j / L) * 0.12
            out[s + j] += v
    return out

def wav_write(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32000)) for s in samples))

# ---------------------------------------------------------------- render
def render(name, shots, dur, duck, hits, vo_offsets):
    fdir = BUILD / name; shutil.rmtree(fdir, ignore_errors=True); fdir.mkdir(parents=True)
    for k in range(int(dur * FPS)):
        g = k / FPS
        for a, b, fn in shots:
            if a <= g < b:
                img = rough_tag(fn(base(), g - a, g)); break
        img.save(fdir / f"{k:05d}.png", compress_level=1)
    stem = OUT / f"{name}_stems"; stem.mkdir(parents=True, exist_ok=True)
    wav_write(stem / "music.wav", synth_music(dur, duck))
    wav_write(stem / "effects.wav", synth_sfx(dur, hits))
    vo = STATUS["Founder VO (Hemant)"]
    vo_path = stem / "vo.wav"
    if vo:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(vo), "-ac", "1", "-ar", str(SR), "-t", str(dur), str(vo_path)], check=True)
    else:
        wav_write(vo_path, [0.0] * int(dur * SR))  # silent: founder VO missing
    tag = "ROUGH-CUT_" if ROUGH else ""
    mp4 = OUT / f"CreativeCaptions_FirstClip_{tag}{name}_1080x1920.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(fdir / "%05d.png"),
                    "-i", str(stem / "vo.wav"), "-i", str(stem / "music.wav"), "-i", str(stem / "effects.wav"),
                    "-filter_complex", "[1][2][3]amix=inputs=3:normalize=0,alimiter=limit=0.9[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
                    "-crf", "18", "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", str(SR),
                    "-t", str(dur), "-movflags", "+faststart", str(mp4)], check=True)
    shutil.rmtree(fdir)
    return mp4

if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    print("Missing:", MISSING or "none")
    m = render("27s", edit_27(), 27.0, [(15.0, 19.0)],
               [(2.55, "key"), (2.85, "click"), (5.9, "whoosh"), (9.6, "click"), (11.2, "click"), (12.6, "click"),
                (20.2, "key"), (20.5, "key"), (23.0, "whoosh")], None)
    c = render("15s", edit_15(), 15.0, [(9.0, 12.0)],
               [(2.55, "key"), (2.85, "click"), (5.6, "click"), (6.8, "click"), (12.0, "whoosh")], None)
    json.dump({"rough_cut": ROUGH, "missing": MISSING, "exports": [m.name, c.name]},
              open(OUT / "render_report.json", "w"), indent=2)
    print(m, c, sep="\n")
