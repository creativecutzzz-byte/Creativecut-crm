"""Build the 'Spot the Rejection' product preview and the two Meta ad creatives.

    python3 preview/build_preview.py   # writes the HTML files in preview/
    node preview/shoot.js              # writes the static PNGs
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "illustrations"
OUT = ROOT / "preview"
BRIEF = "https://contentrewards.com/c/campaigns/2eaa14fb-6927-4136-897e-b096e0d907d6"
_n = 0


def svg(name):
    global _n
    _n += 1
    s = (ART / name).read_text(encoding="utf-8")
    for i in set(re.findall(r'id="([\w-]+)"', s)):
        s = s.replace(f'id="{i}"', f'id="{i}-{_n}"').replace(f"url(#{i})", f"url(#{i}-{_n})")
    return s.replace('aria-labelledby="t d"', f'aria-labelledby="t-{_n} d-{_n}"')


HEAD = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&family=Caveat:wght@700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
@font-face{{font-family:'Barlow Condensed';font-weight:800;src:url(../assets/fonts/BarlowCondensed-ExtraBold.ttf)}}
@font-face{{font-family:Inter;font-weight:100 900;src:url(../assets/fonts/Inter.ttf)}}
@font-face{{font-family:Caveat;font-weight:400 700;src:url(../assets/fonts/Caveat.ttf)}}
:root{{--peach:#FFB583;--coral:#F575A6;--violet:#8659D5;--plum:#21152E;--paper:#FFF8F1;--pass:#1F8A5B;--fail:#C2255C}}
*{{box-sizing:border-box}} html,body{{margin:0}}
body{{font-family:Inter,sans-serif;color:var(--plum);background:var(--paper)}}
svg{{display:block;width:100%;height:auto}}
h1,h2{{font-family:'Barlow Condensed',sans-serif;font-weight:800;line-height:1.02;margin:0}}
{css}
</style></head><body>{body}</body></html>"""

PREVIEW_CSS = """
.wrap{max-width:480px;margin:0 auto;padding:20px 16px 28px}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--violet)}
h1{font-size:34px;margin:6px 0 10px}
.rule{background:#EFE6FB;border-left:6px solid var(--violet);border-radius:0 12px 12px 0;padding:10px 12px;font-weight:600;font-size:15px;margin:0 0 14px}
.pair{display:flex;gap:12px}
.pair figure{flex:1;margin:0;text-align:center}
.pair figcaption{font-weight:800;font-size:14px;margin-top:6px}
.ask{margin:16px 0 12px;font-family:'Barlow Condensed';font-weight:800;font-size:26px;text-align:center}
.choices{display:flex;gap:10px}
.choices button,.reveal-btn{flex:1;font:800 17px Inter;padding:14px;border-radius:999px;border:3px solid var(--plum);background:#fff;color:var(--plum);cursor:pointer}
.reveal-btn{width:100%;margin-top:10px;background:var(--plum);color:var(--paper)}
.answer{display:none;margin-top:16px;border:3px solid var(--fail);border-radius:16px;padding:14px;background:#fff}
.show .answer{display:block}
.show .choices,.show .reveal-btn{display:none}
.answer h2{color:var(--fail);font-size:28px;margin-bottom:6px}
.answer p{margin:8px 0;font-size:16px;line-height:1.45}
.answer figure{margin:6px 0 0}
.ref{font-size:13px;color:#4A3B5C;border-top:1px solid #E5D8EC;padding-top:10px;margin-top:12px}
.ref a{color:var(--violet)}
.cta{display:block;text-align:center;margin-top:16px;background:linear-gradient(120deg,var(--violet),var(--coral));color:#fff;
 font:800 18px Inter;padding:16px;border-radius:999px;text-decoration:none}
.note{font-size:12px;color:#4A3B5C;text-align:center;margin-top:8px}
.static .wrap{max-width:none;width:1080px;padding:56px 64px}
.static h1{font-size:76px}.static .eyebrow{font-size:24px}.static .rule{font-size:30px;padding:18px 24px;border-left-width:12px}
.static .pair{gap:28px}.static .pair figcaption{font-size:28px}
.static .ask{font-size:52px;margin:24px 0 18px}
.static .answer{border-width:6px;border-radius:28px;padding:26px 30px;display:flex;gap:26px;align-items:center}
.static .answer .txt{flex:1.2}.static .answer figure{flex:1}
.static .answer h2{font-size:56px}.static .answer p{font-size:30px}
.static .ref{font-size:24px}.static .cta{font-size:36px;padding:26px}
.static .note{font-size:22px}
"""


def preview(static=False):
    a, b, ann = svg("crop-a.svg"), svg("crop-b.svg"), svg("crop-a-annotated.svg")
    answer = f"""<div class="answer" id="answer" aria-live="polite"><div class="txt">
<h2>Crop A fails.</h2>
<p>The centre crop cuts off the required <b>LIVE · /rexalive</b> overlay. <b>The fix:</b> use a stacked layout, so the full frame (overlay included) stays on screen.</p>
</div><figure>{ann}</figure></div>"""
    body = f"""<main class="wrap">
<div class="eyebrow">Free preview · GTA 6 Creator Toolkit</div>
<h1>Spot the Rejection</h1>
<p class="rule">Brief: “Rexa’s LIVE · /rexalive badge must be visible and unchanged for the whole clip.”</p>
<div class="pair"><figure>{a}<figcaption>A · Illustration</figcaption></figure>
<figure>{b}<figcaption>B · Illustration</figcaption></figure></div>
<div class="ask">Which clip will fail the campaign brief?</div>
<div class="choices"><button type="button" data-pick="A">Clip A</button><button type="button" data-pick="B">Clip B</button></div>
<button type="button" class="reveal-btn">Tap to reveal</button>
{answer}
<p class="ref">“Rexa Live” is a fictional practice case. Real-world rule like this one: “Every clip must include KreekCraft’s overlay”, from the
<a href="{BRIEF}">KreekCraft GTA 6 Clipping brief on Content Rewards</a> (checked 19 Nov 2026).</p>
<a class="cta" href="#buy">Get the GTA 6 Creator Toolkit · ₹199</a>
<p class="note">A preview from the paid PDF · Published by Creative Cut · An independent guide</p>
</main>
<script>
const m=document.body;
document.querySelectorAll('[data-pick],.reveal-btn').forEach(b=>b.addEventListener('click',()=>{{
  m.classList.add('show');
  const p=b.dataset.pick; if(p){{const h=document.querySelector('.answer h2');
  h.textContent = p==='A' ? 'Correct! Crop A fails.' : 'Not quite. Crop A fails.';}}
  document.getElementById('answer').scrollIntoView({{behavior:'smooth',block:'nearest'}});
}}));
</script>"""
    cls = ' class="static show"' if static else ""
    html = HEAD.format(title="Spot the Rejection", css=PREVIEW_CSS, body=body)
    if static:
        html = html.replace("<body>", f"<body{cls}>").replace("<script>", "<script hidden>")
    return html


AD_CSS = """
body{width:1080px;height:1350px;overflow:hidden;background:linear-gradient(165deg,#21152E 0%,#8659D5 38%,#F575A6 72%,#FFB583 100%);color:#fff}
.ad{padding:64px 64px 0;height:100%;display:flex;flex-direction:column}
.brand{font-family:'Barlow Condensed';font-weight:800;font-size:30px;letter-spacing:.12em;color:#FFE3C4}
h1{font-size:94px;margin:14px 0 30px;text-transform:uppercase}
h1 em{font-style:normal;color:var(--peach)}
.row{display:flex;gap:22px;align-items:stretch;flex:1}
.card{flex:1;background:var(--paper);color:var(--plum);border-radius:28px;padding:22px;display:flex;flex-direction:column;gap:12px}
.step{font-family:'Barlow Condensed';font-weight:800;font-size:40px}
.step b{color:var(--violet)}
.big{font-family:'Barlow Condensed';font-weight:800;font-size:58px;line-height:1}
.hand{font-family:Caveat;font-weight:700;font-size:42px;color:var(--fail)}
.lab{font-size:20px;font-weight:800;letter-spacing:.12em;color:#4A3B5C}
.cta{margin:30px 0 24px;background:var(--paper);color:var(--plum);border-radius:999px;text-align:center;
 font:800 42px Inter;padding:26px}
.foot{font-size:22px;color:#FFF8F1;opacity:.9;text-align:center;margin-bottom:28px}
.ts{font:800 44px Inter;color:var(--violet)}
.loop{border:5px solid var(--coral);border-radius:50%;padding:6px 18px;display:inline-block;transform:rotate(-3deg)}
"""


def ad_a():
    b = svg("crop-b-annotated.svg")
    body = f"""<div class="ad">
<div class="brand">CREATIVE CUT · GTA 6 CREATOR TOOLKIT</div>
<h1>Make your first GTA 6 Short. <em>No game or console needed.</em></h1>
<div class="row">
 <div class="card" style="flex:.9"><div class="step"><b>1</b> Timestamp</div>
  <div class="ts"><span class="loop">01:12:08</span></div>
  <div style="font-size:26px">“I am a professional driver.”</div>
  <div class="step" style="margin-top:14px"><b>2</b> Hook</div>
  <div class="big">“10 years experience 😤”</div>
  <div class="hand">first 2 seconds!</div>
  <div class="lab" style="margin-top:auto">FICTIONAL PRACTICE CASE</div></div>
 <div class="card" style="flex:1.1"><div class="step"><b>3</b> Final frame, checked</div>{b}</div>
</div>
<div class="cta">Get the GTA 6 Creator Toolkit · ₹199</div>
<div class="foot">Paid PDF guide · free phone editing tools · Illustrations, fictional example</div>
</div>"""
    return HEAD.format(title="Ad A", css=AD_CSS, body=body)


def ad_b():
    b = svg("crop-b.svg")
    cards = [("01:12:08", "Funny reaction", "“I am a professional driver.” → crash", "streamer-laughing"),
             ("01:47:40", "Unexpected moment", "“Is he following me?” → “I did NOT expect that.”", "streamer-shocked"),
             ("02:05:19", "Spoiler-free discovery", "“Wait. Stop. Look at this.” → the view", "streamer-amazed")]
    items = "".join(f'<div class="card" style="flex-direction:row;gap:18px;align-items:center">'
                    f'<img src="../assets/images/{av}.jpg" alt="" style="width:120px;height:120px;border-radius:50%;flex:none">'
                    f'<div><div class="ts" style="font-size:34px">{t}</div>'
                    f'<div class="step">{k}</div><div style="font-size:24px;line-height:1.3">{d}</div></div></div>'
                    for t, k, d, av in cards)
    body = f"""<div class="ad">
<div class="brand">CREATIVE CUT · GTA 6 CREATOR TOOLKIT</div>
<h1>How do you get <em>three Shorts</em> from one livestream?</h1>
<div class="row"><div style="flex:1.25;display:flex;flex-direction:column;gap:18px">{items}</div>
<div style="flex:.75;display:flex;align-items:center">{b}</div></div>
<div class="cta">Get the GTA 6 Creator Toolkit · ₹199</div>
<div class="foot">Paid PDF guide · Illustrations · “Rexa Live” is a fictional practice stream</div>
</div>"""
    return HEAD.format(title="Ad B", css=AD_CSS, body=body)


if __name__ == "__main__":
    (OUT / "spot-the-rejection.html").write_text(preview(), encoding="utf-8")
    (OUT / "spot-the-rejection-static.html").write_text(preview(static=True), encoding="utf-8")
    (OUT / "ad-a-beginner.html").write_text(ad_a(), encoding="utf-8")
    (OUT / "ad-b-creator.html").write_text(ad_b(), encoding="utf-8")
    print("wrote preview HTML files")
