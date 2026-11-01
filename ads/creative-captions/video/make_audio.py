"""Synthesises the ad's music bed and sound effects (no samples, no licences needed).

Usage (from ads/creative-captions):  python3 video/make_audio.py
Writes video/build/music.wav, video/build/sfx.wav (48 kHz stereo, 30 s).
SFX timings come from video/edl.json so they follow the edit.
"""
import json, math, wave, os
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
EDL = json.load(open(os.path.join(HERE, "edl.json")))
DUR = EDL["duration"]
N = SR * DUR
rng = np.random.default_rng(7)  # deterministic renders


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
    return e


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def kick(n=int(0.35 * SR)):
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.16)


def hat(n=int(0.06 * SR)):
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))  # crude high-pass
    return x * env(n, 0.0005, 0.018) * 0.35


def clap(n=int(0.2 * SR)):
    x = rng.standard_normal(n)
    return x * env(n, 0.001, 0.05) * 0.4


def tone(freq, dur, a=0.01, d=0.5, shape="saw"):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if shape == "saw":
        s = sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, 7))
    else:
        s = np.sin(2 * np.pi * freq * t)
    return s * env(n, a, d)


def lowpass(x, alpha):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


# ---------------- music: 120 BPM, A minor (Am F C G) ----------------
bpm = 120
beat = 60 / bpm
music = np.zeros(N)
roots = [55.0, 43.65, 65.41, 49.0]  # A1 F1 C2 G1
chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 261.63, 329.63], [196.0, 246.94, 293.66]]
nbeats = int(DUR / beat)
for b in range(nbeats):
    t = b * beat
    bar = b // 4
    ci = (bar // 2) % 4
    sparse = t < 3.0          # hook: hits only
    if sparse:
        continue
    place(music, kick(), t, 0.9)
    if b % 4 in (1, 3) and t >= 6:
        place(music, clap(), t, 0.5)
    for h in (0, 0.5):
        if t >= 3:
            place(music, hat(), t + h * beat, 0.6 if h else 0.35)
    # bass on every beat, octave bounce on the off-beat
    place(music, tone(roots[ci], beat * 0.9, 0.005, 0.18, "sine"), t, 0.55)
    place(music, tone(roots[ci] * 2, beat * 0.45, 0.005, 0.08, "sine"), t + beat / 2, 0.25)
    # stab chord on bar starts once the product appears
    if b % 4 == 0 and t >= 6:
        for f in chords[ci]:
            place(music, tone(f, 1.6, 0.01, 0.45), t, 0.06)
# sub drop under the hook words
place(music, tone(36.7, 2.6, 0.002, 1.2, "sine"), 0.1, 0.8)
# riser into the close (21.5 -> 24)
n = int(2.5 * SR)
r = rng.standard_normal(n) * np.linspace(0, 1, n) ** 2
place(music, lowpass(r, 0.15) * 0.5, 21.5)
music = lowpass(music, 0.6)
# fade out the final 0.6 s
fo = int(0.6 * SR)
music[-fo:] *= np.linspace(1, 0, fo)

# ---------------- sound effects ----------------
sfx = np.zeros(N)
for ev in EDL["sfx"]:
    t, kind = ev["t"], ev["type"]
    if kind == "impact":
        n = int(0.9 * SR)
        x = lowpass(rng.standard_normal(n), 0.08) * env(n, 0.001, 0.25) * 2.0
        x += kick(n) * 1.1
        place(sfx, x, t, 0.9)
    elif kind == "whoosh":
        n = int(0.5 * SR)
        x = rng.standard_normal(n)
        sweep = np.sin(np.linspace(0, math.pi, n))
        a = np.linspace(0.02, 0.35, n)
        y = np.empty(n); acc = 0.0
        for i in range(n):
            acc += a[i] * (x[i] - acc); y[i] = acc
        place(sfx, y * sweep * 1.2, t - 0.25, 0.8)
    elif kind == "click":
        n = int(0.03 * SR)
        place(sfx, np.sin(2 * np.pi * 2400 * np.arange(n) / SR) * env(n, 0.0002, 0.004), t, 0.9)
    elif kind == "pop":
        n = int(0.12 * SR)
        tt = np.arange(n) / SR
        f = 900 * np.exp(-tt * 25) + 300
        place(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.04), t, 0.7)
    elif kind == "typing":
        k = 0.0
        while k < ev.get("dur", 1.0):
            n = int(0.02 * SR)
            place(sfx, rng.standard_normal(n) * env(n, 0.0002, 0.003), t + k, 0.35)
            k += rng.uniform(0.07, 0.13)
    elif kind == "ding":
        place(sfx, tone(1318.5, 0.9, 0.002, 0.3, "sine") + 0.4 * tone(1975.5, 0.9, 0.002, 0.2, "sine"), t, 0.35)


def write(path, mono, spread=0.0):
    peak = np.max(np.abs(mono)) or 1.0
    mono = mono / peak * 0.7  # headroom; final loudness is set by ffmpeg loudnorm
    left, right = mono, mono
    if spread:
        d = int(spread * SR)
        right = np.concatenate([np.zeros(d), mono[:-d]])
    st = np.stack([left, right], 1)
    pcm = (np.clip(st, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


out = os.path.join(HERE, "build")
os.makedirs(out, exist_ok=True)
write(os.path.join(out, "music.wav"), music, spread=0.012)
write(os.path.join(out, "sfx.wav"), sfx)
print("wrote", out + "/music.wav", out + "/sfx.wav")
