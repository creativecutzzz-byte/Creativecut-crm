"""Prepare the ChatGPT-generated artwork (assets/ai-raw) for the layout (assets/images).

    python3 layout/prep_images.py

- photos/scenes -> cropped, resized JPEGs
- doodles 07-11 -> trimmed PNGs with transparent background (single stroke colour)
- receipt 12     -> background flood-filled to transparent, trimmed
- icons 13-19    -> trimmed with padding, kept on white (shown inside a white badge)
Writes assets/images/boxes.json with the trimmed sizes so the SVGs can place them exactly.
"""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "ai-raw"
OUT = ROOT / "assets" / "images"
OUT.mkdir(parents=True, exist_ok=True)
boxes = {}


def jpg(name, out, size=None, crop=None, q=84):
    im = Image.open(RAW / name).convert("RGB")
    if crop:
        im = im.crop(crop)
    if size:
        im.thumbnail(size, Image.LANCZOS)
    im.save(OUT / out, "JPEG", quality=q, optimize=True, progressive=True)
    boxes[out] = im.size


def nonwhite_bbox(im, thr=24):
    bg = Image.new("RGB", im.size, (255, 255, 255))
    diff = ImageChops.difference(im.convert("RGB"), bg).convert("L").point(lambda v: 255 if v > thr else 0)
    return diff.getbbox()


def stroke_png(name, out, max_side=512):
    im = Image.open(RAW / name).convert("RGB")
    im = im.crop(nonwhite_bbox(im))
    px = list(im.get_flattened_data())
    # stroke colour = average of clearly coloured pixels
    strong = [p for p in px if min(p) < 200 and (255 * 3 - sum(p)) > 200]
    c = tuple(sum(ch) // len(strong) for ch in zip(*strong))
    dc = max(1, max(255 - c[0], 255 - c[1], 255 - c[2]))
    a = [min(255, int(255 * max(255 - p[0], 255 - p[1], 255 - p[2]) / dc)) for p in px]
    rgba = Image.new("RGBA", im.size, c + (0,))
    rgba.putalpha(Image.new("L", im.size))
    rgba.putalpha(Image.frombytes("L", im.size, bytes(a)))
    rgba.thumbnail((max_side, max_side), Image.LANCZOS)
    rgba.save(OUT / out, optimize=True)
    boxes[out] = rgba.size


def receipt_png(name, out):
    im = Image.open(RAW / name).convert("RGB")
    mask = Image.new("L", im.size, 0)
    work = im.copy()
    for corner in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
        ImageDraw.floodfill(work, corner, (255, 0, 255), thresh=6)
    # magenta = background
    data = work.get_flattened_data()
    alpha = bytes(0 if p == (255, 0, 255) else 255 for p in data)
    rgba = im.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", im.size, alpha))
    rgba = rgba.crop(rgba.getbbox())
    rgba.thumbnail((700, 1000), Image.LANCZOS)
    rgba.save(OUT / out, optimize=True)
    boxes[out] = rgba.size


def icon(name, out, side=360):
    im = Image.open(RAW / name).convert("RGB")
    x0, y0, x1, y1 = nonwhite_bbox(im)
    s = max(x1 - x0, y1 - y0)
    pad = int(s * 0.12)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = s // 2 + pad
    im = im.crop((cx - half, cy - half, cx + half, cy + half))
    im = im.resize((side, side), Image.LANCZOS)
    im.save(OUT / out, "JPEG", quality=88, optimize=True)
    boxes[out] = im.size


if __name__ == "__main__":
    jpg("01-cover-art.png", "cover-art.jpg", q=88)
    jpg("02-stream-scene.png", "stream-scene.jpg", crop=(0, 160, 1536, 1024), size=(1536, 864), q=82)
    for n, o in (("03-streamer-laughing.png", "streamer-laughing.jpg"), ("04-streamer-shocked.png", "streamer-shocked.jpg"),
                 ("05-streamer-amazed.png", "streamer-amazed.jpg")):
        jpg(n, o, size=(640, 640))
    jpg("06-rooftop-view.png", "rooftop-view.jpg", size=(1280, 1280))
    for n, o in (("07-doodle-loop.png", "doodle-loop.png"), ("08-doodle-scissors.png", "doodle-scissors.png"),
                 ("09-doodle-arrow.png", "doodle-arrow.png"), ("10-doodle-tick.png", "doodle-tick.png"),
                 ("11-doodle-cross.png", "doodle-cross.png")):
        stroke_png(n, o)
    # green copy of the loop for "pass" annotations (same hand-drawn alpha, recoloured)
    lp = Image.open(OUT / "doodle-loop.png")
    green = Image.new("RGBA", lp.size, (31, 138, 91, 255))
    green.putalpha(lp.getchannel("A"))
    green.save(OUT / "doodle-loop-green.png", optimize=True)
    boxes["doodle-loop-green.png"] = green.size
    receipt_png("12-receipt-blank.png", "receipt-blank.png")
    for i, n in enumerate(["13-icon-m1-brief", "14-icon-m2-moments", "15-icon-m3-plan", "16-icon-m4-edit",
                           "17-icon-m5-check", "18-icon-m6-publish", "19-icon-m7-earn"], start=1):
        icon(n + ".png", f"icon-m{i}.jpg")
    (OUT / "boxes.json").write_text(json.dumps(boxes, indent=1))
    for k, v in boxes.items():
        print(f"{k:24s} {v}")
