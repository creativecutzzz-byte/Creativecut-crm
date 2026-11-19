"""Generate the original illustrations for the GTA 6 Creator Toolkit.

All artwork is original and schematic. Nothing is traced from game footage or
Rockstar artwork. Run:  python3 layout/make_art.py
Writes SVG files into assets/illustrations/.
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "illustrations"
OUT.mkdir(parents=True, exist_ok=True)

PEACH, CORAL, VIOLET, PLUM, PAPER = "#FFB583", "#F575A6", "#8659D5", "#21152E", "#FFF8F1"
PASS, FAIL = "#1F8A5B", "#D62F6B"
HAND = "font-family:'Caveat',cursive;font-weight:700"
COND = "font-family:'Barlow Condensed',sans-serif;font-weight:800"
BODY = "font-family:'Inter',sans-serif"


# ---------- helpers ----------
def wob(points, amp=2.0, seed=1, closed=False):
    """Hand-drawn looking path through points (adds jitter + smoothing)."""
    rnd = random.Random(seed)
    pts = []
    for (x0, y0), (x1, y1) in zip(points, points[1:] + ([points[0]] if closed else [])):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 18))
        for i in range(n):
            t = i / n
            pts.append((x0 + (x1 - x0) * t + rnd.uniform(-amp, amp),
                        y0 + (y1 - y0) * t + rnd.uniform(-amp, amp)))
    if not closed:
        pts.append(points[-1])
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for a, b in zip(pts[1:], pts[2:]):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        d += f" Q{a[0]:.1f},{a[1]:.1f} {mx:.1f},{my:.1f}"
    d += f" L{pts[-1][0]:.1f},{pts[-1][1]:.1f}"
    if closed:
        d += " Z"
    return d


def loop(cx, cy, rx, ry, seed=3, turns=1.15):
    """Pencil loop (slightly overshooting ellipse)."""
    rnd = random.Random(seed)
    pts = []
    steps = 60
    for i in range(int(steps * turns) + 1):
        a = -math.pi * 0.9 + 2 * math.pi * i / steps
        k = 1 + rnd.uniform(-0.04, 0.04) + 0.06 * i / steps
        pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for p in pts[1:]:
        d += f" L{p[0]:.1f},{p[1]:.1f}"
    return d


def arrow(x0, y0, x1, y1, bend=0.3, color=CORAL, w=6, seed=5, head=26):
    """Curved hand-drawn arrow from (x0,y0) to (x1,y1)."""
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    nx, ny = -(y1 - y0), (x1 - x0)
    cx, cy = mx + nx * bend, my + ny * bend
    rnd = random.Random(seed)
    path = f"M{x0},{y0} Q{cx + rnd.uniform(-4,4):.1f},{cy + rnd.uniform(-4,4):.1f} {x1},{y1}"
    ang = math.atan2(y1 - cy, x1 - cx)
    h1 = (x1 - head * math.cos(ang - 0.45), y1 - head * math.sin(ang - 0.45))
    h2 = (x1 - head * math.cos(ang + 0.45), y1 - head * math.sin(ang + 0.45))
    return (f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'
            f'<path d="M{h1[0]:.1f},{h1[1]:.1f} L{x1},{y1} L{h2[0]:.1f},{h2[1]:.1f}" fill="none" '
            f'stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def svg(w, h, body, title, desc):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" '
            f'aria-labelledby="t d"><title id="t">{title}</title><desc id="d">{desc}</desc>{body}</svg>\n')


def save(name, content):
    (OUT / name).write_text(content, encoding="utf-8")
    print("wrote", name)


def palm(x, y, s=1.0, color=PLUM, seed=1):
    """Simple palm silhouette (trunk + fronds)."""
    rnd = random.Random(seed)
    trunk = f'<path d="M{x},{y} Q{x+14*s},{y-120*s} {x+6*s},{y-230*s}" stroke="{color}" stroke-width="{10*s}" fill="none" stroke-linecap="round"/>'
    tx, ty = x + 6 * s, y - 230 * s
    fronds = ""
    for a in (-160, -125, -90, -55, -20, 15, 200):
        ang = math.radians(a + rnd.uniform(-8, 8))
        L = (95 + rnd.uniform(-15, 15)) * s
        ex, ey = tx + L * math.cos(ang), ty + L * math.sin(ang) + 35 * s
        cx, cy = tx + L * 0.55 * math.cos(ang), ty + L * 0.55 * math.sin(ang) - 22 * s
        fronds += (f'<path d="M{tx:.1f},{ty:.1f} Q{cx:.1f},{cy:.1f} {ex:.1f},{ey:.1f} '
                   f'Q{cx:.1f},{cy+14*s:.1f} {tx:.1f},{ty+6*s:.1f}Z" fill="{color}"/>')
    return trunk + fronds


def skyline(y_base, w, color, seed=7, hmin=80, hmax=330, step=(40, 110)):
    rnd = random.Random(seed)
    x, out = 0, ""
    while x < w:
        bw = rnd.randint(*step)
        bh = rnd.randint(hmin, hmax)
        out += f'<rect x="{x}" y="{y_base-bh}" width="{bw+1}" height="{bh}" fill="{color}"/>'
        if rnd.random() < 0.25:
            out += f'<rect x="{x+bw/2-3}" y="{y_base-bh-40}" width="6" height="40" fill="{color}"/>'
        x += bw
    return out


# ---------- the fictional stream frame (1920 x 1080) ----------
def stream_frame_body():
    sky = (f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
           f'<stop offset="0" stop-color="{VIOLET}"/><stop offset=".55" stop-color="{CORAL}"/>'
           f'<stop offset="1" stop-color="{PEACH}"/></linearGradient></defs>'
           f'<rect width="1920" height="1080" fill="url(#sky)"/>'
           f'<circle cx="1180" cy="640" r="150" fill="#FFE3C4" opacity=".9"/>')
    city = skyline(760, 1920, "#5B3A8A", seed=11, hmin=120, hmax=380) + skyline(800, 1920, "#3A2457", seed=4, hmin=60, hmax=220)
    ground = f'<rect y="790" width="1920" height="290" fill="{PLUM}"/>'
    road = (f'<path d="M0,900 L1920,860 L1920,1000 L0,1080Z" fill="#3B2B4D"/>'
            f'<path d="M0,985 L1920,930" stroke="{PEACH}" stroke-width="8" stroke-dasharray="60 50" opacity=".7"/>')
    palms = palm(140, 800, 1.5, "#1A1024", 2) + palm(1660, 800, 1.7, "#1A1024", 5) + palm(1820, 810, 1.2, "#1A1024", 9)
    # fruit stand (left of car) and car
    stand = (f'<rect x="560" y="820" width="190" height="90" rx="6" fill="#7A4E2D"/>'
             f'<path d="M545,820 L765,820 L745,770 L565,770Z" fill="{CORAL}"/>'
             + "".join(f'<circle cx="{585+i*26}" cy="812" r="12" fill="#FFB12B"/>' for i in range(7)))
    car = (f'<path d="M820,930 L840,870 Q860,830 920,826 L1080,826 Q1130,830 1150,870 L1190,880 '
           f'Q1220,890 1220,920 L1220,945 L820,945Z" fill="{PAPER}"/>'
           f'<path d="M870,872 L895,840 L1000,838 L1000,872Z" fill="#9FD3F2"/>'
           f'<path d="M1015,872 L1015,838 L1090,840 L1125,872Z" fill="#9FD3F2"/>'
           f'<circle cx="900" cy="948" r="34" fill="{PLUM}"/><circle cx="900" cy="948" r="14" fill="#888"/>'
           f'<circle cx="1135" cy="948" r="34" fill="{PLUM}"/><circle cx="1135" cy="948" r="14" fill="#888"/>')
    # facecam bottom-left
    cam = (f'<rect x="40" y="700" width="420" height="340" rx="22" fill="#2E2140" stroke="{PAPER}" stroke-width="6"/>'
           f'<circle cx="250" cy="860" r="78" fill="{PEACH}"/>'
           f'<path d="M120,1040 Q250,930 380,1040Z" fill="{VIOLET}"/>'
           f'<path d="M168,860 Q168,760 250,760 Q332,760 332,860" fill="none" stroke="{PLUM}" stroke-width="18"/>'
           f'<rect x="150" y="840" width="34" height="60" rx="12" fill="{PLUM}"/><rect x="316" y="840" width="34" height="60" rx="12" fill="{PLUM}"/>'
           f'<path d="M222,880 Q250,905 278,880" stroke="{PLUM}" stroke-width="7" fill="none" stroke-linecap="round"/>'
           f'<circle cx="225" cy="845" r="7" fill="{PLUM}"/><circle cx="275" cy="845" r="7" fill="{PLUM}"/>')
    badge = overlay_badge(1440, 40)
    return sky + city + ground + road + palms + stand + car + cam + badge


def overlay_badge(x, y, scale=1.0):
    w, h = 440 * scale, 92 * scale
    return (f'<g transform="translate({x},{y}) scale({scale})">'
            f'<rect width="440" height="92" rx="46" fill="{PLUM}" stroke="{PAPER}" stroke-width="5"/>'
            f'<circle cx="52" cy="46" r="18" fill="#FF3B5C"/>'
            f'<text x="86" y="62" style="{COND}" font-size="46" fill="{PAPER}">LIVE · /rexalive</text></g>')


def illus_label(x, y, text="ILLUSTRATION", size=34, anchor="start"):
    return (f'<g><rect x="{x - (0 if anchor=="start" else len(text)*size*0.55)}" y="{y-size}" width="{len(text)*size*0.55+20}" '
            f'height="{size*1.35}" rx="8" fill="{PLUM}" opacity=".85"/>'
            f'<text x="{x+10 - (0 if anchor=="start" else len(text)*size*0.55)}" y="{y}" style="{BODY};font-weight:700;letter-spacing:2px" '
            f'font-size="{size*0.8}" fill="{PAPER}">{text}</text></g>')


def stream_frame():
    body = stream_frame_body() + illus_label(40, 70, "ILLUSTRATION · FICTIONAL STREAM", 30)
    save("stream-frame.svg", svg(1920, 1080, body, "Fictional 16:9 stream frame",
         "Original drawing of a 16:9 livestream: dusk city, a car next to a fruit stand, a facecam bottom-left, "
         "and the required LIVE /rexalive overlay badge in the top-right corner."))


# ---------- phone frames ----------
PH_W, PH_H = 1080, 1920


def phone_shell(inner, label_letter=None, verdict=None):
    """Wrap 1080x1920 screen content in a phone outline. Canvas 1240x2160."""
    out = (f'<rect x="20" y="20" width="1200" height="2120" rx="120" fill="{PLUM}"/>'
           f'<svg x="80" y="120" width="{PH_W}" height="{PH_H}" viewBox="0 0 {PH_W} {PH_H}">'
           f'<rect width="{PH_W}" height="{PH_H}" fill="#120B1A"/>{inner}</svg>'
           f'<rect x="520" y="52" width="200" height="34" rx="17" fill="#0B0710"/>')
    if label_letter:
        out += (f'<circle cx="150" cy="200" r="70" fill="{PAPER}" stroke="{PLUM}" stroke-width="8"/>'
                f'<text x="150" y="232" text-anchor="middle" style="{COND}" font-size="96" fill="{PLUM}">{label_letter}</text>')
    out += illus_label(430, 2105, "ILLUSTRATION", 40)
    return out


def caption_block(y, words, hi=None, size=74):
    """Bold caption with one highlighted word."""
    parts = []
    for wd in words.split():
        fill = PEACH if hi and wd.strip(".,!?").upper() == hi.upper() else "#FFFFFF"
        parts.append(f'<tspan fill="{fill}">{wd}</tspan>')
    return (f'<text x="540" y="{y}" text-anchor="middle" style="{COND}" font-size="{size}" '
            f'stroke="#000" stroke-width="10" paint-order="stroke" stroke-linejoin="round">{" ".join(parts)}</text>')


def crop_a_inner():
    # center 608x1080 slice of the 1920x1080 frame scaled to 1080x1920
    sx = (1920 - 607.5) / 2
    return (f'<svg width="1080" height="1920" viewBox="{sx} 0 607.5 1080" preserveAspectRatio="xMidYMid slice">'
            f'{stream_frame_body()}</svg>'
            + caption_block(1380, "NOT THE MANGOES!", "MANGOES", 92))


def crop_b_inner():
    face = (f'<svg x="0" y="0" width="1080" height="640" viewBox="40 700 420 340" preserveAspectRatio="xMidYMid slice">'
            f'{stream_frame_body()}</svg>')
    game = (f'<svg x="0" y="640" width="1080" height="607.5" viewBox="0 0 1920 1080">{stream_frame_body()}</svg>')
    bottom = f'<rect y="1247.5" width="1080" height="672.5" fill="#120B1A"/>'
    return face + game + bottom + caption_block(1420, "NOT THE MANGOES!", "MANGOES", 92)


def crop_a():
    save("crop-a.svg", svg(1240, 2160, phone_shell(crop_a_inner(), "A"),
         "Crop A: center crop",
         "Illustration. A 9:16 phone frame showing a centre crop of the fictional stream. The car fills the screen "
         "and the caption reads NOT THE MANGOES. The LIVE /rexalive badge is not visible."))


def crop_b():
    save("crop-b.svg", svg(1240, 2160, phone_shell(crop_b_inner(), "B"),
         "Crop B: stacked layout",
         "Illustration. A 9:16 phone frame with the facecam on top, the full 16:9 gameplay frame in the middle "
         "with the LIVE /rexalive badge still in its corner, and the caption below."))


def crop_a_annotated():
    inner = crop_a_inner()
    body = phone_shell(inner, "A")
    # ghost of the badge outside the phone (to the right) + arrow
    ghost = (f'<rect x="1180" y="150" width="560" height="120" rx="60" fill="none" stroke="{FAIL}" '
             f'stroke-width="6" stroke-dasharray="18 14"/>'
             f'<text x="1460" y="230" text-anchor="middle" style="{COND}" font-size="56" fill="{FAIL}" opacity=".55">LIVE · /rexalive</text>')
    note = (f'<text x="1250" y="400" style="{HAND}" font-size="78" fill="{FAIL}">The overlay was here.</text>'
            f'<text x="1250" y="480" style="{HAND}" font-size="78" fill="{FAIL}">The crop cut it out!</text>')
    arr = arrow(1500, 520, 1030, 330, bend=-0.35, color=FAIL, w=9, seed=8, head=40)
    x = (f'<path d="{wob([(1290,760),(1690,1100)],3,2)}" stroke="{FAIL}" stroke-width="16" stroke-linecap="round" fill="none"/>'
         f'<path d="{wob([(1690,760),(1290,1100)],3,4)}" stroke="{FAIL}" stroke-width="16" stroke-linecap="round" fill="none"/>'
         f'<text x="1490" y="1220" text-anchor="middle" style="{COND}" font-size="88" fill="{FAIL}">FAILS THE BRIEF</text>')
    save("crop-a-annotated.svg", svg(1900, 2160, body + ghost + note + arr + x,
         "Crop A annotated: missing overlay",
         "Illustration. Crop A with a hand-drawn red arrow pointing to where the LIVE /rexalive badge would be, "
         "outside the phone frame. Handwritten note: The overlay was here. The crop cut it out. Fails the brief."))


def crop_b_annotated():
    body = phone_shell(crop_b_inner(), "B")
    # badge in crop B: game area x0=80,y0=760 (phone offset 80,120 + 640), scale 1080/1920=.5625
    bx, by = 80 + 1440 * .5625, 120 + 640 + 40 * .5625
    lp = loop(bx + 124, by + 26, 165, 60, seed=12)
    note = (f'<path d="{lp}" fill="none" stroke="{PASS}" stroke-width="8" stroke-linecap="round"/>'
            f'<text x="1250" y="560" style="{HAND}" font-size="78" fill="{PASS}">Overlay kept,</text>'
            f'<text x="1250" y="640" style="{HAND}" font-size="78" fill="{PASS}">unchanged.</text>'
            + arrow(1330, 680, 1120, 830, bend=0.3, color=PASS, w=9, seed=3, head=40)
            + f'<path d="{wob([(1300,1000),(1420,1120),(1660,860)],3,6)}" stroke="{PASS}" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<text x="1480" y="1250" text-anchor="middle" style="{COND}" font-size="88" fill="{PASS}">PASSES</text>')
    save("crop-b-annotated.svg", svg(1900, 2160, body + note,
         "Crop B annotated: overlay kept",
         "Illustration. Crop B with a green pencil loop around the LIVE /rexalive badge in the gameplay area and a "
         "handwritten note: Overlay kept, unchanged. Passes."))


# ---------- doodles ----------
def doodle_timestamp():
    lines = [("01:12:01", "Watch this, I'm going to park it perfectly."),
             ("01:12:08", "I am a professional driver. Ten years…"),
             ("01:12:14", "Easy... easy... reverse a little..."),
             ("01:12:19", "[crash sound] [fruit stand falls over]"),
             ("01:12:21", "NO. No no no. The mangoes!")]
    body = f'<rect width="1200" height="660" rx="28" fill="#FFFFFF" stroke="{PLUM}" stroke-width="4"/>'
    for i, (t, s) in enumerate(lines):
        y = 100 + i * 92
        body += (f'<text x="60" y="{y}" style="{BODY};font-weight:700" font-size="36" fill="{VIOLET}">{t}</text>'
                 f'<text x="250" y="{y}" style="{BODY}" font-size="34" fill="{PLUM}">{s}</text>')
    body += f'<path d="{loop(130, 180, 115, 44, seed=21)}" fill="none" stroke="{CORAL}" stroke-width="6" stroke-linecap="round"/>'
    body += f'<text x="70" y="635" style="{HAND}" font-size="60" fill="{CORAL}">the hook starts here, so the cut starts here</text>'
    body += arrow(52, 610, 34, 232, bend=-0.1, color=CORAL, w=5, seed=2, head=24)
    save("doodle-timestamp-loop.svg", svg(1200, 660, body, "Pencil loop around a timestamp",
         "Five transcript lines from the fictional stream. A hand-drawn coral loop circles 01:12:08 with a note: hook starts here."))


def scissors(x, y, s=1.0, color=PLUM, rot=0):
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            f'<circle cx="-22" cy="40" r="17" fill="none" stroke="{color}" stroke-width="7"/>'
            f'<circle cx="22" cy="40" r="17" fill="none" stroke="{color}" stroke-width="7"/>'
            f'<path d="M-12,27 L14,-40 M12,27 L-14,-40" stroke="{color}" stroke-width="8" stroke-linecap="round"/></g>')


def doodle_scissors():
    rnd = random.Random(9)
    body = f'<rect width="1400" height="520" rx="28" fill="#FFFFFF" stroke="{PLUM}" stroke-width="4"/>'
    body += f'<rect x="60" y="230" width="1280" height="140" rx="16" fill="#EFE6F7"/>'
    body += f'<rect x="380" y="230" width="640" height="140" fill="{PEACH}" opacity=".85"/>'
    for i in range(160):
        x = 70 + i * 8
        h = 10 + abs(math.sin(i / 7)) * 40 + rnd.uniform(0, 30)
        if 760 < x < 800:
            h += 40
        body += f'<rect x="{x}" y="{300-h/2:.1f}" width="4" height="{h:.1f}" rx="2" fill="{VIOLET}" opacity=".75"/>'
    for x, lab in ((380, "IN 01:12:08"), (1020, "OUT 01:12:31")):
        body += f'<path d="{wob([(x,190),(x,410)],2,int(x))}" stroke="{CORAL}" stroke-width="6" stroke-dasharray="14 10" fill="none"/>'
        body += scissors(x, 140, 1.1, CORAL, 180)
        body += f'<text x="{x}" y="470" text-anchor="middle" style="{BODY};font-weight:700" font-size="34" fill="{PLUM}">{lab}</text>'
    body += f'<text x="780" y="215" text-anchor="middle" style="{HAND}" font-size="46" fill="{PLUM}">crash ↓ keep loud</text>'
    body += f'<text x="700" y="80" text-anchor="middle" style="{HAND}" font-size="54" fill="{CORAL}">cut here — and here</text>'
    save("doodle-scissors.svg", svg(1400, 520, body, "Scissors at the cut points",
         "A timeline with an audio waveform. Coral scissors mark the in point 01:12:08 and out point 01:12:31; "
         "the kept 23 seconds are highlighted peach. A note marks the crash spike: keep loud."))


def doodle_receipt():
    rows = [("Verified views", "48,600"), ("Rate", "$1.00 / 1,000"), ("48.6 × $1.00", "$48.60"),
            ("Min $3 · Max $150", "OK"), ("Fee 10%", "− $4.86")]
    W, H = 760, 1000
    zig = " ".join(f"L{x},{H-40 + (22 if i % 2 else 0)}" for i, x in enumerate(range(W - 40, 39, -30)))
    body = (f'<path d="M40,40 L{W-40},40 {zig} L40,{H-40} Z" fill="#FFFFFF" stroke="{PLUM}" stroke-width="4"/>'
            f'<text x="{W/2}" y="120" text-anchor="middle" style="{COND}" font-size="64" fill="{PLUM}">CLIP RECEIPT</text>'
            f'<text x="{W/2}" y="170" text-anchor="middle" style="{BODY}" font-size="28" fill="{VIOLET}">Fictional example · Rexa Live</text>'
            f'<path d="M80,200 L{W-80},200" stroke="{PLUM}" stroke-width="3" stroke-dasharray="10 8"/>')
    for i, (k, v) in enumerate(rows):
        y = 270 + i * 90
        body += (f'<text x="80" y="{y}" style="{BODY}" font-size="44" fill="{PLUM}">{k}</text>'
                 f'<text x="{W-80}" y="{y}" text-anchor="end" style="{BODY};font-weight:700" font-size="44" fill="{PLUM}">{v}</text>')
    body += (f'<path d="M80,{720} L{W-80},{720}" stroke="{PLUM}" stroke-width="3"/>'
             f'<text x="90" y="800" style="{COND}" font-size="60" fill="{PLUM}">NET</text>'
             f'<text x="{W-90}" y="800" text-anchor="end" style="{COND}" font-size="72" fill="{VIOLET}">$43.74</text>'
             f'<text x="{W/2}" y="880" text-anchor="middle" style="{BODY}" font-size="26" fill="{PLUM}">before any withdrawal fees</text>'
             f'<path d="{loop(W-170, 775, 130, 55, seed=31)}" fill="none" stroke="{CORAL}" stroke-width="6"/>')
    save("doodle-receipt.svg", svg(W, H, body, "CPM receipt",
         "A paper receipt for the fictional clip: 48,600 verified views at $1.00 per 1,000 equals $48.60, within the "
         "$3 minimum and $150 maximum, minus a 10% fee of $4.86, net $43.74 before withdrawal fees."))


# ---------- annotated phone editing steps (generic editor) ----------
def tap(x, y, n):
    return (f'<circle cx="{x}" cy="{y}" r="46" fill="none" stroke="{CORAL}" stroke-width="8"/>'
            f'<circle cx="{x+44}" cy="{y-44}" r="30" fill="{CORAL}"/>'
            f'<text x="{x+44}" y="{y-32}" text-anchor="middle" style="{BODY};font-weight:800" font-size="34" fill="#fff">{n}</text>')


def editor_screen(preview, extra="", tools=("Trim", "Crop", "Text", "Audio", "Export")):
    ui = (f'<rect width="1080" height="1920" fill="#17101F"/>'
          f'<rect x="0" y="0" width="1080" height="110" fill="#221830"/>'
          f'<text x="40" y="72" style="{BODY};font-weight:600" font-size="36" fill="#bbb">← Project</text>'
          f'<rect x="830" y="28" width="210" height="60" rx="30" fill="{CORAL}"/>'
          f'<text x="935" y="70" text-anchor="middle" style="{BODY};font-weight:700" font-size="32" fill="#fff">Export</text>'
          f'<svg x="265" y="150" width="550" height="977">{preview}</svg>'
          f'<rect x="265" y="150" width="550" height="977" fill="none" stroke="#555" stroke-width="3"/>'
          f'<rect x="0" y="1180" width="1080" height="380" fill="#221830"/>'
          f'<path d="M540,1190 L540,1550" stroke="#fff" stroke-width="5"/>'
          f'<rect x="120" y="1260" width="900" height="120" rx="12" fill="{VIOLET}" opacity=".9"/>'
          f'<rect x="120" y="1410" width="900" height="70" rx="12" fill="#3E7C9E" opacity=".9"/>'
          f'<text x="140" y="1450" style="{BODY}" font-size="28" fill="#fff">audio</text>'
          f'<rect x="0" y="1600" width="1080" height="320" fill="#120B1A"/>')
    for i, t in enumerate(tools):
        x = 108 + i * 216
        ui += (f'<rect x="{x-60}" y="1660" width="120" height="120" rx="28" fill="#2E2140"/>'
               f'<text x="{x}" y="1840" text-anchor="middle" style="{BODY};font-weight:600" font-size="30" fill="#ddd">{t}</text>')
    return ui + extra


def mini_frame():
    sx = (1920 - 607.5) / 2
    return f'<svg width="550" height="977" viewBox="{sx} 0 607.5 1080" preserveAspectRatio="xMidYMid slice">{stream_frame_body()}</svg>'


def phone_trim():
    extra = (f'<rect x="120" y="1255" width="22" height="130" rx="6" fill="{PEACH}"/>'
             f'<rect x="998" y="1255" width="22" height="130" rx="6" fill="{PEACH}"/>'
             + tap(108, 1720, 1) + tap(131, 1320, 2) + tap(1009, 1320, 3))
    inner = editor_screen(mini_frame(), extra)
    body = phone_shell(inner)
    body += (f'<text x="1240" y="1300" style="{HAND}" font-size="120" fill="{PLUM}">1 Trim</text>'
             f'<text x="1240" y="1450" style="{HAND}" font-size="120" fill="{PLUM}">2 Start</text>'
             f'<text x="1240" y="1600" style="{HAND}" font-size="120" fill="{PLUM}">3 End</text>')
    save("phone-trim.svg", svg(1900, 2160, body, "Trim on a phone",
         "Illustration of a generic phone editor. Numbered coral circles: 1 the Trim tool, 2 the start handle of the "
         "clip on the timeline, 3 the end handle."))


def phone_reframe():
    stacked = (f'<svg width="550" height="977" viewBox="0 0 1080 1920">{crop_b_inner()}</svg>')
    extra = (f'<rect x="265" y="476" width="550" height="310" fill="none" stroke="{PEACH}" stroke-width="6" stroke-dasharray="20 12"/>'
             + tap(324, 1720, 1) + tap(540, 330, 2) + tap(540, 630, 3))
    inner = editor_screen(stacked, extra)
    body = phone_shell(inner)
    body += (f'<text x="1240" y="1000" style="{HAND}" font-size="120" fill="{PLUM}">1 Crop 9:16</text>'
             f'<text x="1240" y="1150" style="{HAND}" font-size="120" fill="{PLUM}">2 Facecam</text>'
             f'<text x="1240" y="1300" style="{HAND}" font-size="120" fill="{PLUM}">   on top</text>'
             f'<text x="1240" y="1450" style="{HAND}" font-size="120" fill="{PLUM}">3 Full game</text>'
             f'<text x="1240" y="1600" style="{HAND}" font-size="120" fill="{PLUM}">   + overlay</text>')
    save("phone-reframe.svg", svg(1900, 2160, body, "Reframe to vertical",
         "Illustration of a generic phone editor showing the stacked 9:16 layout. 1 the Crop tool set to 9:16, "
         "2 the facecam scaled into the top area, 3 the full-width gameplay with the overlay badge kept visible."))


def safe_zone_overlay(w=1080, h=1920):
    return (f'<rect width="{w}" height="{h*0.12}" fill="{CORAL}" opacity=".35"/>'
            f'<rect y="{h*0.78}" width="{w}" height="{h*0.22}" fill="{CORAL}" opacity=".35"/>'
            f'<rect x="{w*0.86}" y="{h*0.4}" width="{w*0.14}" height="{h*0.38}" fill="{CORAL}" opacity=".35"/>'
            f'<rect x="{w*0.06}" y="{h*0.62}" width="{w*0.78}" height="{h*0.13}" fill="none" stroke="{PASS}" stroke-width="10" stroke-dasharray="26 16"/>')


def phone_captions():
    prev = (f'<svg width="550" height="977" viewBox="0 0 1080 1920">{crop_b_inner()}{safe_zone_overlay()}</svg>')
    extra = tap(540, 1720, 1) + tap(540, 870, 2)
    inner = editor_screen(prev, extra)
    body = phone_shell(inner)
    body += (f'<text x="1240" y="900" style="{HAND}" font-size="120" fill="{PLUM}">1 Auto</text>'
             f'<text x="1240" y="1050" style="{HAND}" font-size="120" fill="{PLUM}">   captions</text>'
             f'<text x="1240" y="1200" style="{HAND}" font-size="120" fill="{PASS}">2 Green box</text>'
             f'<text x="1240" y="1350" style="{HAND}" font-size="120" fill="{PASS}">   = safe</text>'
             f'<text x="1240" y="1500" style="{HAND}" font-size="120" fill="{FAIL}">Pink = app</text>'
             f'<text x="1240" y="1650" style="{HAND}" font-size="120" fill="{FAIL}">   buttons</text>')
    save("phone-captions.svg", svg(1900, 2160, body, "Captions in the safe zone",
         "Illustration of a generic phone editor. 1 the Text tool for auto captions. 2 the caption placed in a green "
         "dashed safe box; pink shaded areas at top, bottom and right edge show where app buttons cover the video."))


def safe_zone():
    inner = crop_b_inner() + safe_zone_overlay()
    body = phone_shell(inner)
    body += (f'<text x="1250" y="300" style="{HAND}" font-size="64" fill="{FAIL}">top ~12%: username,</text>'
             f'<text x="1250" y="370" style="{HAND}" font-size="64" fill="{FAIL}">search bar</text>'
             f'<text x="1250" y="1150" style="{HAND}" font-size="64" fill="{FAIL}">right edge: like,</text>'
             f'<text x="1250" y="1220" style="{HAND}" font-size="64" fill="{FAIL}">comment, share</text>'
             f'<text x="1250" y="1450" style="{HAND}" font-size="64" fill="{PASS}">captions here ✓</text>'
             f'<text x="1250" y="1860" style="{HAND}" font-size="64" fill="{FAIL}">bottom ~22%: title,</text>'
             f'<text x="1250" y="1930" style="{HAND}" font-size="64" fill="{FAIL}">description, music</text>')
    save("safe-zone.svg", svg(1900, 2160, body, "Vertical safe zone",
         "Illustration of a 9:16 frame with pink shaded areas where platform buttons and text usually cover the "
         "video (top, bottom and right edge) and a green box in the lower middle where captions are safe."))


# ---------- cover (1480 x 2100, A5 ratio) ----------
def cover():
    W, H = 1480, 2100
    defs = (f'<defs><linearGradient id="cv-sky" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{PLUM}"/><stop offset=".28" stop-color="{VIOLET}"/>'
            f'<stop offset=".62" stop-color="{CORAL}"/><stop offset=".9" stop-color="{PEACH}"/></linearGradient>'
            f'<linearGradient id="cv-scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{VIOLET}"/>'
            f'<stop offset=".6" stop-color="{CORAL}"/><stop offset="1" stop-color="{PEACH}"/></linearGradient>'
            f'<clipPath id="cv-clip"><rect x="0" y="0" width="{W}" height="{H}"/></clipPath></defs>')
    bg = f'<rect width="{W}" height="{H}" fill="url(#cv-sky)"/>'
    sun = f'<circle cx="1060" cy="1560" r="250" fill="#FFE3C4" opacity=".55"/><circle cx="1060" cy="1560" r="170" fill="#FFE9D1" opacity=".8"/>'
    city = (skyline(1760, W, "#6A3F8F", seed=21, hmin=160, hmax=520, step=(50, 120))
            + skyline(1830, W, "#3A2457", seed=8, hmin=80, hmax=300, step=(40, 100)))
    ground = f'<rect y="1820" width="{W}" height="280" fill="{PLUM}"/>'
    palms = palm(90, 1860, 2.6, "#170D21", 3) + palm(1360, 1870, 2.9, "#170D21", 6) + palm(1250, 1880, 1.8, "#170D21", 11)
    # crop-frame corner brackets around the title block
    def corners(x, y, w, h, L=70, c=PAPER, sw=10):
        return "".join(f'<path d="{d}" stroke="{c}" stroke-width="{sw}" fill="none" stroke-linecap="square"/>' for d in (
            f"M{x},{y+L} L{x},{y} L{x+L},{y}", f"M{x+w-L},{y} L{x+w},{y} L{x+w},{y+L}",
            f"M{x},{y+h-L} L{x},{y+h} L{x+L},{y+h}", f"M{x+w-L},{y+h} L{x+w},{y+h} L{x+w},{y+h-L}"))
    title = (corners(70, 90, 1340, 640)
             + f'<text x="740" y="330" text-anchor="middle" style="{COND}" font-size="250" fill="{PAPER}" letter-spacing="4">GTA 6</text>'
             + f'<text x="740" y="520" text-anchor="middle" style="{COND}" font-size="178" fill="{PEACH}">CREATOR</text>'
             + f'<text x="740" y="690" text-anchor="middle" style="{COND}" font-size="178" fill="{PEACH}">TOOLKIT</text>')
    sub = (f'<text x="740" y="840" text-anchor="middle" style="{BODY};font-weight:700" font-size="64" fill="{PAPER}">Make your first GTA 6 Short.</text>'
           f'<rect x="400" y="885" width="680" height="120" rx="60" fill="{PAPER}"/>'
           f'<text x="740" y="967" text-anchor="middle" style="{COND}" font-size="92" fill="{PLUM}">JUST YOUR PHONE.</text>')
    # phone with vertical editing timeline
    px, py, pw, ph = 470, 1080, 540, 960
    scr = (f'<g transform="rotate(-6 {px+pw/2} {py+ph/2})">'
           f'<rect x="{px-26}" y="{py-26}" width="{pw+52}" height="{ph+52}" rx="70" fill="#120B1A" stroke="{PAPER}" stroke-width="6"/>'
           f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="46" fill="#1C1328"/>'
           # preview window 9:16-ish
           f'<rect x="{px+120}" y="{py+40}" width="300" height="440" rx="14" fill="url(#cv-scr)"/>'
           + f'<svg x="{px+120}" y="{py+40}" width="300" height="440" viewBox="0 0 300 440"><g>'
           + skyline(400, 300, "#3A2457", seed=5, hmin=60, hmax=190, step=(20, 46))
           + f'<rect y="398" width="300" height="42" fill="{PLUM}"/>' + palm(40, 410, .7, "#170D21", 4) + '</g></svg>'
           + corners(px+100, py+20, 340, 480, L=40, c=PAPER, sw=7)
           # caption on preview
           + f'<rect x="{px+150}" y="{py+372}" width="240" height="46" rx="8" fill="{PLUM}" opacity=".8"/>'
           + f'<text x="{px+270}" y="{py+406}" text-anchor="middle" style="{COND}" font-size="34" fill="{PAPER}">HOOK IN 2s</text>'
           # timeline tracks
           + f'<rect x="{px+30}" y="{py+530}" width="{pw-60}" height="300" rx="16" fill="#271B36"/>'
           + "".join(f'<rect x="{px+50+i*96}" y="{py+560}" width="88" height="86" rx="10" fill="{c}"/>'
                     for i, c in enumerate([VIOLET, CORAL, PEACH, VIOLET, CORAL]))
           + f'<rect x="{px+50}" y="{py+665}" width="300" height="40" rx="10" fill="{PEACH}" opacity=".9"/>'
           + f'<rect x="{px+50}" y="{py+720}" width="440" height="40" rx="10" fill="#3E7C9E"/>'
           + "".join(f'<rect x="{px+60+i*14}" y="{py+740-(8+(i*37)%22)/2}" width="6" height="{8+(i*37)%22}" fill="#CFE6F2"/>' for i in range(30))
           + f'<path d="M{px+258},{py+540} L{px+258},{py+820}" stroke="{PAPER}" stroke-width="6"/>'
           + f'<path d="M{px+244},{py+540} L{px+272},{py+540} L{px+258},{py+560}Z" fill="{PAPER}"/>'
           + scissors(px+258, py+800, .9, PAPER, 180)
           + f'<rect x="{px+150}" y="{py+870}" width="240" height="56" rx="28" fill="{CORAL}"/>'
           + f'<text x="{px+270}" y="{py+910}" text-anchor="middle" style="{BODY};font-weight:800" font-size="30" fill="#fff">EXPORT 9:16</text>'
           + '</g>')
    detail = (f'<rect x="0" y="1990" width="{W}" height="110" fill="{PLUM}" opacity=".92"/>'
              f'<text x="740" y="2058" text-anchor="middle" style="{BODY};font-weight:600" font-size="40" fill="{PAPER}">'
              f'Free editing tools · Campaign checklist · YouTube roadmap</text>')
    brand = (f'<text x="1400" y="1960" text-anchor="end" style="{COND}" font-size="54" fill="{PAPER}" letter-spacing="3">CREATIVE CUT</text>')
    body = defs + f'<g clip-path="url(#cv-clip)">' + bg + sun + city + ground + palms + scr + title + sub + brand + detail + '</g>'
    save("cover.svg", svg(W, H, body, "GTA 6 Creator Toolkit cover",
         "Cover: GTA 6 Creator Toolkit. Make your first GTA 6 Short. Just your phone. A phone showing a vertical "
         "editing timeline over a dusk skyline with palm silhouettes and crop-frame corners. Free editing tools, "
         "campaign checklist, YouTube roadmap. Creative Cut."))


if __name__ == "__main__":
    stream_frame()
    crop_a()
    crop_b()
    crop_a_annotated()
    crop_b_annotated()
    doodle_timestamp()
    doodle_scissors()
    doodle_receipt()
    phone_trim()
    phone_reframe()
    phone_captions()
    safe_zone()
    cover()
