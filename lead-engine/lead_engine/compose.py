"""Personalised email composition following the Creative Cut Outreach Playbook.

Source of truth: "Creative Cut — Personalised Outreach Playbook" (Google Doc
15P2uFT-Q7LJ56D0t7Dwk8a_dx4YqF3niJDYxp71cvhY). Variation copy below mirrors it.
Every fact used in the email is recorded with its source URL.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

from .samples import Sample

SITE = "https://creativecut.in"
IG = "https://www.instagram.com/ig_creativecut_/"


@dataclass
class Facts:
    first_name: str = ""
    requirement: str = ""          # short phrase: what they asked for, from the post
    deliverable: str = ""          # what we offer to do
    project: str = ""              # series / channel / product / company name
    platform: str = ""
    asks_for_test: bool = False
    answered: set[str] = field(default_factory=set)  # question keys already answered in the brief
    sources: list[str] = field(default_factory=list)  # "fact — url"
    confidence: str = "rules"      # "ai" | "rules" | "low"


@dataclass
class Email:
    subject: str
    html: str
    text: str
    variation: str
    question: str
    problems: list[str]


VARIATIONS = {
    "podcast": "Short-form or podcast repurposing",
    "short_form": "Talking-head content",
    "talking_head": "Talking-head content",
    "saas_demo": "SaaS demo or explainer",
    "ad_creative": "D2C ad creative",
    "long_form": "Long-form YouTube",
    "agency": "Agency overflow",
    "default": "Default first email",
}

# (question key, text). The first one the lead hasn't answered is used.
QUESTIONS = {
    "Short-form or podcast repurposing": [("clips_per_episode", "How many clips do you want from each episode?"), ("weekly_volume", "How many clips are you planning to publish each week?"), ("footage", "Do you already have the first episodes ready to cut?")],
    "Talking-head content": [("caption_reference", "Do you already have a reference for how you want the captions to look?"), ("weekly_volume", "How many reels are you planning to publish each week?"), ("footage", "Do you already have footage ready for the first edit?")],
    "SaaS demo or explainer": [("audience", "Who's the demo for?"), ("footage", "Do you already have the screen recordings for it?")],
    "Agency overflow": [("recurring", "Is this for a single project or recurring support?"), ("footage", "Do you already have footage ready for the first batch?")],
    "D2C ad creative": [("footage", "Do you already have footage for the first batch?"), ("weekly_volume", "How many ad variations are you planning each month?")],
    "Long-form YouTube": [("runtime", "What's your target runtime for each episode?"), ("weekly_volume", "How many videos are you planning each month?")],
    "Default first email": [("recurring", "Are you looking for help with the first batch or ongoing edits?"), ("footage", "Do you already have footage ready for the first edit?")],
}

ANSWER_PATTERNS = {
    "clips_per_episode": r"\d+\s*(clips?|shorts|reels)\s*(per|from each|an?)\s*episode",
    "weekly_volume": r"(\d+\s*[-–]?\s*\d*\s*(videos?|reels?|clips?|shorts)\s*(/|per|a|each)\s*(week|month|day))|(per|a|each)\s+week",
    "caption_reference": r"(caption\s+style|reference\s+(video|link)|example\s+of\s+the\s+kind|style\s+like|similar\s+to\s+@?\w+)",
    "audience": r"(for\s+(investors|customers|users|onboarding|sales|prospects|our\s+clients))",
    "recurring": r"(ongoing|long[- ]term|recurring|retainer|regular\s+basis|one[- ]off|one[- ]time|single\s+project|as[- ]needed|monthly)",
    "footage": r"(i('| wi)ll\s+provide|we('| wi)ll\s+provide|footage\s+(is\s+)?(ready|provided)|raw\s+footage\s+provided|script\s+and\s+(completed\s+)?voiceover)",
    "runtime": r"\d+\s*[-–]?\s*\d*\s*min",
}

PLACEHOLDER = re.compile(r"\[[^\]]{2,}\]|\{[a-z_]+\}|\bTODO\b|\bXXX\b")


def choose_variation(deliverable: str, niche: str) -> str:
    if niche == "Agency":
        return VARIATIONS["agency"]
    if deliverable == "motion_graphics" and niche == "SaaS":
        return VARIATIONS["saas_demo"]
    if deliverable == "ad_creative" and niche not in ("D2C", "Other", "Real estate"):
        return VARIATIONS["default"]
    return VARIATIONS.get(deliverable, VARIATIONS["default"])


def detect_answered(text: str) -> set[str]:
    return {k for k, p in ANSWER_PATTERNS.items() if re.search(p, text or "", re.I)}


def pick_question(variation: str, answered: set[str]) -> str:
    for key, q in QUESTIONS[variation]:
        if key not in answered:
            return q
    return ""


def _subject(variation: str, f: Facts) -> str:
    p = f.project
    return {
        "Short-form or podcast repurposing": f"Clips for {p}" if p else "Clips for your podcast",
        "Talking-head content": f"Edits for {p}" if p else "Edits for your reels",
        "SaaS demo or explainer": f"{p} demo edit" if p else "Your product demo edit",
        "Agency overflow": f"Editing support for {p}" if p else "Editing support for your team",
        "D2C ad creative": f"{p} ad edits" if p else "Ad edits for your brand",
        "Long-form YouTube": f"YouTube editing for {p}" if p else "YouTube editing for your channel",
    }.get(variation, f"Editing for {p}" if p else "Editing for your videos")


def _a(url: str, label: str) -> str:
    return f'<a href="{html.escape(url, quote=True)}">{html.escape(label)}</a>'


def compose(f: Facts, variation: str, sample: Sample | None, sample_label: str) -> Email:
    problems: list[str] = []
    e = html.escape
    greet = f"Hey {e(f.first_name)}," if f.first_name else "Hey there,"
    req, deliv = e(f.requirement), e(f.deliverable)
    plat = e(f.platform) if f.platform else "Reels and Shorts"

    offer = {
        "Short-form or podcast repurposing": f"I can pull the strongest standalone moments and cut them for {plat}.",
        "Talking-head content": "I can handle the edit and keep the pacing close to what you described.",
        "SaaS demo or explainer": "I can cut the walkthrough and use motion graphics to make each step easier to follow.",
        "Agency overflow": f"I can take a batch of {deliv} and work from your existing brand references.",
        "D2C ad creative": f"I can cut {deliv} from your footage.",
        "Long-form YouTube": "I can help shape the edit around story pacing and clean B-roll.",
    }.get(variation, f"I'd be up for helping with {deliv}.")
    opener = f"Saw your post about {req}. {offer}"

    question = pick_question(variation, f.answered)
    if not question:
        problems.append("every playbook question is already answered in the brief")

    paras = [f"<p>{greet}</p>", f"<p>{opener}</p>"]
    text_paras = [greet.replace("&amp;", "&"), html.unescape(re.sub(r"<[^>]+>", "", opener))]
    if sample:
        link = _a(sample.watch_url, f"Watch a similar {sample_label}")
        paras.append(f"<p>Here's one I worked on that's close to what you described: {link}.</p>")
        text_paras.append(f"Here's one I worked on that's close to what you described: Watch a similar {sample_label} ({sample.watch_url}).")
    else:
        problems.append("no verified portfolio sample")
    if f.asks_for_test:
        t = "Happy to start with a paid test on one clip. If you send the footage and reference, I can confirm the rate and turnaround before we start."
        paras.append(f"<p>{t}</p>")
        text_paras.append(t)
        question = "Which clip would you like to use?"
    if question:
        paras.append(f"<p>{e(question)}</p>")
        text_paras.append(question)
    paras.append(f'<p>Hemant<br>{_a(SITE, "Creative Cut")}</p>')
    text_paras.append(f"Hemant\nCreative Cut ({SITE})")
    optout = "Not relevant? Just reply “no thanks” and I won’t follow up."
    paras.append(f'<p style="color:#888;font-size:12px">{e(optout)}</p>')
    text_paras.append(optout)

    body_html = "\n".join(paras)
    body_text = "\n\n".join(text_paras)
    subject = _subject(variation, f)
    if not f.requirement:
        problems.append("missing sourced requirement for the opener")
    if PLACEHOLDER.search(body_text) or PLACEHOLDER.search(subject):
        problems.append("unresolved placeholder")
    return Email(subject, body_html, body_text, variation, question, problems)


LINK_RE = re.compile(r'<a\s+href="([^"]+)">([^<]+)</a>')


def links_in(body_html: str) -> list[tuple[str, str]]:
    return [(html.unescape(u), html.unescape(t)) for u, t in LINK_RE.findall(body_html)]


def check_rendered(email: Email, url_ok) -> list[str]:
    """Verify every link is an http(s) hyperlink with descriptive text and resolves."""
    problems = list(email.problems)
    links = links_in(email.html)
    if not any(u.rstrip("/") == SITE for u, _ in links):
        problems.append("signature link to creativecut.in missing")
    for u, t in links:
        if not u.startswith("https://"):
            problems.append(f"non-https link {u}")
        if t.strip().startswith("http"):
            problems.append(f"bare URL used as link text: {t}")
        if IG in u and t != "IG Creative":
            problems.append("Instagram link must use the label 'IG Creative'")
        if not url_ok(u):
            problems.append(f"link did not verify: {u}")
    if re.search(r"(?<![\"'>])https?://", re.sub(r'<a\s+href="[^"]+">', "", email.html)):
        problems.append("raw URL in HTML body (must be a hyperlink)")
    return problems
