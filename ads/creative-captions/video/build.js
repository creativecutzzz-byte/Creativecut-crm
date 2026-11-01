// Builds the 30 s, 1080x1920, 30 fps H.264/AAC ad from real AE captures + the motion-graphics overlay.
// Usage (from ads/creative-captions):  python3 video/make_audio.py && node video/build.js
// Missing captures become labelled slates and the output gets a -PLACEHOLDER suffix and a red banner.
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cap = (f) => path.join(root, "captures", f);
const B = path.join(__dirname, "build");
const EDL = JSON.parse(fs.readFileSync(path.join(__dirname, "edl.json"), "utf8"));
const FPS = EDL.fps, DUR = EDL.duration, W = 1080, H = 1920;
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const probe = (f) => {
  const o = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height:format=duration", "-of", "json", f]).toString());
  return { w: o.streams[0].width, h: o.streams[0].height, dur: parseFloat(o.format.duration) };
};
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

fs.rmSync(path.join(B, "seg"), { recursive: true, force: true });
fs.rmSync(path.join(B, "ov"), { recursive: true, force: true });
fs.mkdirSync(path.join(B, "seg"), { recursive: true });
fs.mkdirSync(path.join(B, "ov"), { recursive: true });

(async () => {
  const browser = await chromium.launch();

  // 1. background plate (near-black + forest glow)
  const bgPage = await browser.newPage({ viewport: { width: W, height: H } });
  await bgPage.setContent(`<body style="margin:0;width:${W}px;height:${H}px;background:
    radial-gradient(1100px 900px at 90% 5%, rgba(22,58,38,.95), transparent 70%),
    radial-gradient(900px 800px at 0% 100%, rgba(15,42,27,.9), transparent 70%), #0a0d0b"></body>`);
  await bgPage.screenshot({ path: path.join(B, "bg.png") });
  await bgPage.close();

  // 2. base track: one clip per segment, footage fitted into its card without distortion
  let draft = false;
  const tl = { segments: [], callouts: EDL.callouts, draft: false };
  let styleIndex = 0;
  EDL.segments.forEach((s, i) => {
    const d = s.t1 - s.t0;
    const box = s.box || EDL.defaultBox;
    const src = cap(s.src);
    const seg = { id: s.id, t0: s.t0, t1: s.t1, src: s.src, need: s.need, rect: box, missing: false };
    if (s.style) { seg.style = s.style; seg.styleIndex = ++styleIndex; }
    const out = path.join(B, "seg", `${String(i).padStart(2, "0")}.mp4`);
    if (!fs.existsSync(src)) {
      draft = true; seg.missing = true;
      ff(["-loop", "1", "-framerate", String(FPS), "-t", String(d), "-i", path.join(B, "bg.png"),
        "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "16", "-r", String(FPS), out]);
    } else {
      const p = probe(src);
      const [cx, cy, cw, ch] = s.crop || [0, 0, p.w, p.h];
      const k = Math.min(box[2] / cw, box[3] / ch);
      const fw = even(cw * k), fh = even(ch * k);
      const fx = Math.round(box[0] + (box[2] - fw) / 2), fy = Math.round(box[1] + (box[3] - fh) / 2);
      seg.rect = [fx, fy, fw, fh];
      let speed = s.speed === "auto" ? Math.max(1, (p.dur - Math.max(0, s.srcIn)) / d) : s.speed;
      let srcIn = s.srcIn < 0 ? Math.max(0, p.dur + s.srcIn - d * speed) : s.srcIn;
      seg.speed = speed; seg.spedUp = speed > 1.5;
      ff(["-loop", "1", "-framerate", String(FPS), "-t", String(d), "-i", path.join(B, "bg.png"),
        "-ss", String(srcIn), "-t", String(d * speed + 0.5), "-i", src,
        "-filter_complex",
        `[1:v]crop=${cw}:${ch}:${cx}:${cy},setpts=(PTS-STARTPTS)/${speed},fps=${FPS},scale=${fw}:${fh}:flags=lanczos,` +
        `tpad=stop_mode=clone:stop_duration=${d}[f];[0:v][f]overlay=${fx}:${fy}:shortest=0,format=yuv420p,trim=duration=${d}`,
        "-an", "-c:v", "libx264", "-crf", "16", "-r", String(FPS), out]);
    }
    tl.segments.push(seg);
  });
  tl.draft = draft;
  fs.writeFileSync(path.join(B, "seg", "list.txt"),
    EDL.segments.map((_, i) => `file '${String(i).padStart(2, "0")}.mp4'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", path.join(B, "seg", "list.txt"), "-c", "copy", path.join(B, "base.mp4")]);
  fs.writeFileSync(path.join(B, "timeline.json"), JSON.stringify(tl, null, 2));

  // 3. overlay frames (transparent PNGs)
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(__dirname, "overlay.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((t) => window.setup(t), tl);
  await page.waitForTimeout(300);
  const total = FPS * DUR;
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    await page.screenshot({ path: path.join(B, "ov", `${String(f).padStart(4, "0")}.png`), omitBackground: true });
    if (f % 150 === 0) console.log(`overlay ${f}/${total}`);
  }
  await browser.close();

  // 4. composite + audio (music ducked under SFX, loudness-normalised for mobile: -14 LUFS, -1.5 dBTP)
  const name = "creative-3-never-ever-30s" + (draft ? "-PLACEHOLDER" : "") + ".mp4";
  for (const s of ["", "-PLACEHOLDER"]) {
    const f = path.join(root, "out", "creative-3-never-ever-30s" + s + ".mp4");
    if (path.basename(f) !== name && fs.existsSync(f)) fs.unlinkSync(f);
  }
  ff(["-i", path.join(B, "base.mp4"), "-framerate", String(FPS), "-i", path.join(B, "ov", "%04d.png"),
    "-i", path.join(B, "music.wav"), "-i", path.join(B, "sfx.wav"),
    "-filter_complex",
    "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v];" +
    "[2:a]volume=0.55[m];[3:a]volume=1.0[s];[m][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
    "-map", "[v]", "-map", "[a]", "-t", String(DUR), "-r", String(FPS),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", path.join(root, "out", name)]);
  console.log((draft ? "PLACEHOLDER " : "FINAL       ") + "out/" + name);

  // 5. thumbnail source frame from the finished reel (used by video/thumbnail.html)
  const th = cap(EDL.thumbnail.src);
  if (fs.existsSync(th)) ff(["-ss", String(EDL.thumbnail.t), "-i", th, "-frames:v", "1", cap("c3-thumb.png")]);
})();
