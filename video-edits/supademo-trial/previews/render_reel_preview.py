# Preview renderer for Reel_Style_Build.jsx: same data, same layout maths, half resolution.
import json, sys, subprocess, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D = json.load(open(sys.argv[1])); RAW = sys.argv[2]; OUT = sys.argv[3]; T0 = float(sys.argv[4]); DUR = float(sys.argv[5])
CFG = D["CFG"]; K = 0.5; W, H = 540, 960; FPS = 30
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"; FONT_ACC = "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf"
CAP, ACC, BIG = 84 * K, 112 * K, 190 * K
CAP_Y = round(1920 * 0.66) * K; MAX_LINE = 1080 * 0.86 * K
def hexc(h, a=255): h = h.lstrip("#"); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
SEG = D["SEGMENTS"]
def M(r):
    for s in reversed(SEG):
        if r >= s["rawIn"] - 1e-3: return s["t"] + r - s["rawIn"]
    return 0
def sm(x): x = min(max(x, 0), 1); return x * x * (3 - 2 * x)
def pop_scale(u, peak):
    if u < 0: return 0
    if u < 0.1: return peak * sm(u / 0.1)
    if u < 0.22: return peak + (1 - peak) * sm((u - 0.1) / 0.12)
    return 1.0
font_cache = {}
def F(path, size):
    k = (path, round(size)); 
    if k not in font_cache: font_cache[k] = ImageFont.truetype(path, round(size))
    return font_cache[k]
def text_sprite(text, size, path, color, glow=0, shadow=True):
    f = F(path, size); w = f.getlength(text); pad = int(size * 0.8)
    im = Image.new("RGBA", (int(w) + 2 * pad, int(size * 1.4) + 2 * pad), (0, 0, 0, 0))
    cx, cy = im.size[0] / 2, im.size[1] / 2
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((cx, cy + 7 * K), text, font=f, fill=(0, 0, 0, 215), anchor="mm")
        out = Image.alpha_composite(out, sh.filter(ImageFilter.GaussianBlur(8 * K)))
    if glow:
        g = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(g).text((cx, cy), text, font=f, fill=color[:3] + (255,), anchor="mm")
        g = g.filter(ImageFilter.GaussianBlur(glow)); out = Image.alpha_composite(out, g); out = Image.alpha_composite(out, g)
    ImageDraw.Draw(out).text((cx, cy), text, font=f, fill=color, anchor="mm")
    return out, w
def rr_sprite(w, h, r, fill=None, stroke=None, sw=0, shadow=False):
    pad = 30; im = Image.new("RGBA", (int(w) + 2 * pad, int(h) + 2 * pad), (0, 0, 0, 0))
    if shadow:
        s = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(s).rounded_rectangle((pad, pad + 6, pad + w, pad + h + 6), r, fill=(0, 0, 0, 120))
        im = Image.alpha_composite(im, s.filter(ImageFilter.GaussianBlur(12)))
    ImageDraw.Draw(im).rounded_rectangle((pad, pad, pad + w, pad + h), r, fill=fill, outline=stroke, width=int(sw))
    return im
def paste(base, spr, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if scale <= 0.01 or alpha <= 0.01: return
    s = spr
    if abs(scale - 1) > 1e-3: s = s.resize((max(1, int(s.size[0] * scale)), max(1, int(s.size[1] * scale))), Image.BILINEAR)
    if abs(rot) > 0.05: s = s.rotate(rot, resample=Image.BILINEAR, expand=True)
    if alpha < 0.999:
        a = np.array(s); a[..., 3] = (a[..., 3] * alpha).astype(np.uint8); s = Image.fromarray(a)
    x, y = int(cx - s.size[0] / 2), int(cy - s.size[1] / 2)
    # clip to frame
    l, t = max(0, -x), max(0, -y); r, b = min(s.size[0], W - x), min(s.size[1], H - y)
    if r <= l or b <= t: return
    base.alpha_composite(s.crop((l, t, r, b)), (x + l, y + t))
def sweep(spr, u, dur=0.5):
    if u < 0 or u > dur: return spr
    a = np.array(spr).astype(np.float32); h, w = a.shape[:2]
    xs = np.arange(w)[None, :] + np.arange(h)[:, None] * 0.4
    c = -0.3 * w + (u / dur) * 1.9 * w; band = np.clip(1 - np.abs(xs - c) / (w * 0.12), 0, 1)
    m = band * (a[..., 3] / 255) * 0.75
    a[..., :3] = a[..., :3] * (1 - m[..., None]) + 255 * m[..., None]
    return Image.fromarray(a.astype(np.uint8))

# ---------- build timeline items
items = []   # each: dict(t_in, t_out, draw(fr, t))
def word_item(text, size, path, color, glow, x, y, t_word, t_in, t_out, accent, fit, do_sweep=False):
    spr, _ = text_sprite(text, size, path, color, glow)
    def draw(fr, t, holder=(0, 0, 1.0)):
        u = t - t_word; sc = pop_scale(u, 1.28 if accent else 1.16) * fit
        dy = 40 * K * (1 - sm(u / 0.18)); al = min(max(u / 0.05, 0), 1); rot = 9 * (1 - sm(u / 0.25)) if accent else 0
        s = sweep(spr, u - 0.25) if do_sweep else spr
        paste(fr, s, x, y + dy, sc, al, rot)
    items.append((t_in, t_out, draw))
def layout_chunk(c, nxt):
    big = c.get("style") == "big"
    toks, lines = [], [[]]
    for r in c["s"].split(" "):
        if r == "|": lines.append([]); continue
        acc = r.startswith("*"); txt = r.replace("*", ""); tok = dict(text=txt.upper() if acc else txt, acc=acc); lines[-1].append(tok); toks.append(tok)
    for i, tk in enumerate(toks): tk["t"] = M(c["w"][i])
    t_in = M(c["w"][0]) - 0.03; t_out = M(c["out"]) if c.get("out") else M(nxt["w"][0]) - 0.03
    hx, hy = W / 2, (CAP_Y - 120 * K) if big else CAP_Y
    rows, widest, lh = [], 0, []
    for ln in lines:
        row, total, h, gap = [], 0, 0, (34 if big else 22) * K
        for tk in ln:
            size = BIG if big else (ACC if tk["acc"] else CAP); path = FONT_ACC if (big or tk["acc"]) else FONT
            w = F(path, size).getlength(tk["text"]); row.append((tk, size, path, w)); total += w; h = max(h, size)
        total += gap * (len(row) - 1); widest = max(widest, total); rows.append((row, total, gap)); lh.append(h * 1.02)
    fit = MAX_LINE / widest if widest > MAX_LINE else 1
    y = -sum(lh) / 2
    for (row, total, gap), h in zip(rows, lh):
        x = -total / 2; yc = y + h / 2
        for tk, size, path, w in row:
            acc = big or tk["acc"]
            col = hexc(CFG["ACCENT"] if (c.get("red") or (not big and tk["acc"])) else CFG["ACCENT_2"]) if acc else (255, 255, 255, 255)
            word_item(tk["text"], size, path, col, (14 if big else 7) * K * 2 if acc else 0, hx + (x + w / 2) * fit, hy + yc * fit, tk["t"], t_in, t_out, acc, fit, big)
            x += w + gap
        y += h
    if big:
        rnd = random.Random(int(c["w"][0] * 100)); t0 = M(c["w"][0])
        for k in range(12):
            sz = (6 + rnd.random() * 12) * K * 2; px = hx + (rnd.random() - 0.5) * widest * fit * 1.15; py = hy + (rnd.random() - 0.5) * sum(lh) * 1.6
            dot = Image.new("RGBA", (int(sz * 4), int(sz * 4)), (0, 0, 0, 0)); ImageDraw.Draw(dot).ellipse((sz * 1.5, sz * 1.5, sz * 2.5, sz * 2.5), fill="white")
            dot = Image.alpha_composite(dot.filter(ImageFilter.GaussianBlur(sz * 0.5)), dot); delay = 0.05 + rnd.random() * 0.35
            def d(fr, t, dot=dot, px=px, py=py, delay=delay, k=k):
                u = t - t0 - delay; paste(fr, dot, px, py, pop_scale(u, 1.6), abs(math.sin(t * 7 + k)))
            items.append((t_in, t_out, d))
for i, c in enumerate(D["CHUNKS"]): layout_chunk(c, D["CHUNKS"][i + 1] if i + 1 < len(D["CHUNKS"]) else None)

# hook
HK = D["HOOK"]; t_in, t_out = M(HK["w"][0]) - 0.03, M(HK["out"]); hx, hy = W / 2, CAP_Y - 40 * K
wi = 0
for ln, words in enumerate(HK["lines"]):
    acc = ln == 1; size = (170 if acc else 96) * K; path = FONT_ACC if acc else FONT; gap = 26 * K
    ws = [F(path, size).getlength(w) for w in words]; total = sum(ws) + gap * (len(ws) - 1); fit = MAX_LINE / total if total > MAX_LINE else 1
    x = -total / 2
    for w, wd in zip(words, ws):
        word_item(w, size, path, hexc(CFG["ACCENT"]) if acc else (255, 255, 255, 255), 14 * K if acc else 0,
                  hx + (x + wd / 2) * fit, hy + (-110 if ln == 0 else 40) * K, M(HK["w"][wi]), t_in, t_out, acc, fit, acc)
        x += wd + gap; wi += 1
bar_at = M(15.90)
pill = rr_sprite(600 * K, 112 * K, 56 * K, fill=(10, 10, 10, 115), stroke=(255, 255, 255, 90), sw=2.5 * K)
def icon(kind):
    s = 80; im = Image.new("RGBA", (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = s / 2; u = K
    if kind == "rec": d.ellipse((c - 20 * u, c - 20 * u, c + 20 * u, c + 20 * u), fill="#FF3B30")
    if kind == "search": d.ellipse((c - 26 * u, c - 26 * u, c + 18 * u, c + 18 * u), outline="white", width=int(6 * u)); d.line((c + 12 * u, c + 12 * u, c + 26 * u, c + 26 * u), fill="white", width=int(8 * u))
    if kind == "div": d.rectangle((c - 1, c - 32 * u, c + 1, c + 32 * u), fill=(255, 255, 255, 100))
    if kind == "chat": d.rounded_rectangle((c - 32 * u, c - 23 * u, c + 32 * u, c + 23 * u), 12 * u, outline="white", width=int(6 * u)); d.polygon([(c - 22 * u, c + 20 * u), (c - 6 * u, c + 20 * u), (c - 18 * u, c + 34 * u)], fill="white")
    if kind == "user": d.ellipse((c - 15 * u, c - 31 * u, c + 15 * u, c - 1 * u), fill="white"); d.rounded_rectangle((c - 28 * u, c + 4 * u, c + 28 * u, c + 32 * u), 14 * u, fill="white")
    return im
icons = [(icon(k), x) for k, x in [("rec", -225), ("search", -110), ("div", -20), ("chat", 80), ("user", 200)]]
def draw_pill(fr, t):
    u = t - bar_at
    if u < 0: return
    sx = 1.08 * sm(u / 0.22) if u < 0.22 else 1.08 + (1 - 1.08) * sm((u - 0.22) / 0.12) if u < 0.34 else 1
    p = pill.resize((max(1, int(pill.size[0] * sx)), pill.size[1]), Image.BILINEAR); paste(fr, p, hx, hy + 220 * K, 1, min(u / 0.08, 1))
    for q, (im, x) in enumerate(icons): paste(fr, im, hx + x * K, hy + 220 * K, pop_scale(u - 0.12 - q * 0.05, 1.25))
items.append((t_in, t_out, draw_pill))

# glass cards
for idx, cd in enumerate(D["CARDS"]):
    at, out = M(cd["at"]), M(cd["out"]); x, y = W / 2 + cd["side"] * 290 * K, H * 0.30
    card = rr_sprite(230 * K, 230 * K, 44 * K, fill=(255, 255, 255, 31), stroke=(255, 255, 255, 115), sw=3 * K, shadow=True)
    cx, cy = card.size[0] / 2, card.size[1] / 2
    if cd["kind"] == "user":
        ic = Image.new("RGBA", card.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ic); g = hexc(CFG["CARD_ICON"])
        d.ellipse((cx - 39 * K, cy - 34 * K - 39 * K, cx + 39 * K, cy - 34 * K + 39 * K), fill=g); d.rounded_rectangle((cx - 66 * K, cy + 15 * K, cx + 66 * K, cy + 89 * K), 37 * K, fill=g)
        ic = Image.alpha_composite(ic.filter(ImageFilter.GaussianBlur(10 * K)), ic)
    else:
        ic, _ = text_sprite(cd["label"], (96 if len(cd["label"]) > 1 else 130) * K, FONT_ACC, hexc(cd["color"]), 10 * K, False)
        tmp = Image.new("RGBA", card.size, (0, 0, 0, 0)); tmp.alpha_composite(ic, (int(cx - ic.size[0] / 2), int(cy - ic.size[1] / 2))); ic = tmp
    spr = Image.alpha_composite(card, ic)
    def dc(fr, t, spr=spr, at=at, out=out, x=x, y=y, idx=idx, side=cd["side"]):
        u = t - at; sc = pop_scale(u, 1.18) if u < 0.28 else 1
        if t > out - 0.2: v = (t - (out - 0.2)) / 0.2; sc = 1 + 0.1 * sm(v / 0.35) if v < 0.35 else 1.1 * (1 - sm((v - 0.35) / 0.65))
        paste(fr, spr, x, y + math.sin(t * 2.4 + idx) * 8 * K, sc, 1, -side * 14 * (1 - sm(u / 0.3)))
    items.append((at - 0.03, out, dc))

# ---------- render overlay frames into ffmpeg
shade = np.zeros((H, W, 4), np.uint8); top = CAP_Y - 260 * K
for yy in range(H): shade[yy, :, 3] = int(115 * sm((yy - top) / (320 * K) + 0.5))
shade = Image.fromarray(shade)
inputs, fc = [], []
for i, s in enumerate(SEG):
    sc = 0.4667 * (1.05 / 1.05) * s["zoom"]; cw, ch = 540 / sc, 960 / sc; fx, fy = 1760 - 270 / sc, 900 - 420 / sc
    inputs += ["-ss", f"{s['rawIn']:.3f}", "-t", f"{s['rawOut'] - s['rawIn']:.3f}", "-i", RAW]
    fc.append(f"[{i}:v]fps=30,crop={cw:.0f}:{ch:.0f}:{fx:.0f}:{fy:.0f},scale=540:960,setsar=1[v{i}];[{i}:a]aresample=48000,afade=t=in:d=0.04,afade=t=out:st={s['rawOut'] - s['rawIn'] - 0.05:.3f}:d=0.05[a{i}]")
n = len(SEG)
fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[base][aud]")
fc.append(f"[base]eq=brightness=-0.05:contrast=1.08:saturation=0.95,vignette=angle=0.7[ar]")
fc.append(f"[ar][{n}:v]overlay=0:0:format=auto,format=yuv420p[vout]")
base_file = OUT + ".base.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", ";".join(fc[:-1]), "-map", "[ar]", "-map", "[aud]",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "160k", base_file], check=True)
cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(T0), "-t", str(DUR), "-i", base_file, "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", "30", "-i", "pipe:0",
       "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[vout]", "-map", "[vout]", "-map", "0:a",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "copy", "-movflags", "+faststart", OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in range(int(DUR * FPS)):
    t = T0 + f / FPS; fr = Image.new("RGBA", (W, H), (0, 0, 0, 0)); fr.alpha_composite(shade)
    for a, b, d in items:
        if a <= t < b: d(fr, t)
    p.stdin.write(fr.tobytes())
p.stdin.close(); p.wait()
