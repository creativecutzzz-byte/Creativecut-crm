"""Build the print-ready HTML for the GTA 6 Creator Toolkit from manuscript.md.

    python3 layout/make_art.py   # regenerate illustrations (optional)
    python3 layout/build.py      # writes layout/book.html
    node layout/render.js        # writes the PDF, cover PNG and review renders
"""
import html
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "illustrations"
SRC = ROOT / "manuscript.md"
OUT = ROOT / "layout" / "book.html"

PAGE_RE = re.compile(r'<!-- PAGE (\d+) id=(\S+) class=(\S+) title="([^"]+)" -->')
FIG_RE = re.compile(r"\{\{fig ([\w.-]+) \| ([^}]+)\}\}")
_fig_count = 0


def inline_svg(name, cls=""):
    global _fig_count
    _fig_count += 1
    n = _fig_count
    s = (ART / name).read_text(encoding="utf-8")
    # make ids unique per inline copy
    for i in set(re.findall(r'id="([\w-]+)"', s)):
        s = s.replace(f'id="{i}"', f'id="{i}-{n}"').replace(f"url(#{i})", f"url(#{i}-{n})")
    s = s.replace('aria-labelledby="t d"', f'aria-labelledby="t-{n} d-{n}"')
    if cls:
        s = s.replace("<svg ", f'<svg class="{cls}" ', 1)
    return s


def fig(m):
    name, cap = m.group(1), m.group(2).strip()
    kind = "fig-" + name.split(".")[0]
    return (f'<figure class="{kind}">{inline_svg(name)}'
            f'<figcaption>{html.escape(cap)}</figcaption></figure>')


def prompt_blocks(text):
    """```prompt fences become selectable prompt boxes with a label."""
    def rep(m):
        body = html.escape(m.group(1).rstrip("\n"))
        return (f'<div class="promptbox"><div class="plabel">PROMPT · select all and copy</div>'
                f'<pre class="prompt">{body}</pre></div>')
    return re.sub(r"```prompt\n(.*?)```", rep, text, flags=re.S)


def build():
    src = SRC.read_text(encoding="utf-8")
    src = re.sub(r"\A<!--.*?-->\s*", "", src, flags=re.S)  # drop file header comment
    marks = list(PAGE_RE.finditer(src))
    pages = []
    for i, m in enumerate(marks):
        num, pid, cls, title = m.groups()
        end = marks[i + 1].start() if i + 1 < len(marks) else len(src)
        body = src[m.end():end].strip()
        if body.strip() == "{{cover}}":
            content = inline_svg("cover.svg", "cover-art")
        else:
            body = prompt_blocks(body)
            body = FIG_RE.sub(fig, body)
            content = markdown.markdown(
                body, extensions=["tables", "fenced_code", "md_in_html", "attr_list", "sane_lists"])
            content = content.replace('<pre><code class="language-text">', '<pre class="sheet"><code>')
        pages.append((int(num), pid, cls, title, content))

    assert [p[0] for p in pages] == list(range(1, len(pages) + 1)), "page numbers out of order"

    out = []
    for num, pid, cls, title, content in pages:
        foot = "" if cls == "cover" else (
            f'<footer><span>GTA 6 Creator Toolkit · Creative Cut</span><span class="pn">{num}</span></footer>')
        out.append(f'<section class="page {cls}" id="{pid}" data-title="{html.escape(title)}" '
                   f'data-page="{num}"><div class="inner">{content}</div>{foot}</section>')

    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GTA 6 Creator Toolkit</title>
<meta name="author" content="Creative Cut">
<meta name="description" content="Make your first GTA 6 Short. Just your phone. An independent guide published by Creative Cut.">
<link rel="stylesheet" href="style.css">
</head>
<body>
{''.join(out)}
</body>
</html>
"""
    OUT.write_text(doc, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} with {len(pages)} pages")


if __name__ == "__main__":
    build()
