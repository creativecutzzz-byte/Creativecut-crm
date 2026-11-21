"""Portfolio sample bank built from the YouTube videos embedded on creativecut.in.

Each sample is matched to a deliverable, its YouTube ID is taken from the
embed, the direct watch URL is built, and playability without sign-in is
verified before it is used. If nothing relevant verifies, the caller marks
the outreach row NEEDS_REVIEW (playbook rule).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .util import http, with_retries

WATCH = "https://www.youtube.com/watch?v={}"
VIDEO_SPECIFIC = re.compile(r"(private|unavailable|removed|deleted|confirm your age|age[- ]restricted|copyright|terminated|not available in your country|blocked it|members[- ]only)", re.I)

_PROJECT = re.compile(
    r'"project":\{"id":"([A-Za-z0-9_-]{11})","category":"([^"]*)","niche":"([^"]*)","orientation":"([^"]*)"'
    r'.*?"rightsApproved":(true|false).*?\}.*?"caption":"((?:[^"\\]|\\.)*)"',
    re.S,
)


@dataclass
class Sample:
    video_id: str
    category: str
    niche: str
    orientation: str
    rights_approved: bool
    caption: str
    page_url: str

    @property
    def watch_url(self) -> str:
        return WATCH.format(self.video_id)


# deliverable -> ordered preferences of (category, niche, caption keyword) and link label
DELIVERABLE_RULES: dict[str, dict] = {
    "podcast": {"label": "podcast-style talking-head clip", "prefer": [(None, "creator-reels", "podcast")]},
    "talking_head": {"label": "talking-head reel with captions", "prefer": [(None, "creator-reels", "talking-head"), (None, "creator-reels", "presenter")]},
    "short_form": {"label": "short-form reel", "prefer": [(None, "creator-reels", "talking-head"), (None, "creator-reels", "reel")]},
    "saas_demo": {"label": "SaaS explainer", "prefer": [("motion", "saas-tech", "explainer"), ("motion", "saas-tech", None)]},
    "motion_graphics": {"label": "motion graphics piece", "prefer": [("motion", "motion", "motion graphics"), ("motion", None, None)]},
    "ad_creative": {"label": "product ad edit", "prefer": [(None, "product-ads", "product"), ("ai", "ai", "product ad"), (None, "product-ads", None)]},
    "real_estate": {"label": "property walkthrough reel", "prefer": [(None, "real-estate", "walkthrough"), (None, "real-estate", None)]},
    "event": {"label": "event film edit", "prefer": [(None, "events", None)]},
    "ai_content": {"label": "AI content reel", "prefer": [("ai", "ai", None)]},
    # No long-form YouTube edit is embedded on the site, so long-form briefs go to review.
    "long_form": {"label": "long-form YouTube edit", "prefer": []},
}


def load_bank(page_url: str = "https://www.creativecut.in/work") -> list[Sample]:
    r = with_retries(lambda: http().get(page_url, timeout=30))
    r.raise_for_status()
    h = r.text.replace('\\"', '"')
    out: dict[str, Sample] = {}
    for m in _PROJECT.finditer(h):
        vid = m.group(1)
        if vid in out:
            continue
        caption = m.group(6).encode().decode("unicode_escape", errors="ignore").encode("latin-1", errors="ignore").decode("utf-8", errors="ignore")
        out[vid] = Sample(vid, m.group(2), m.group(3), m.group(4), m.group(5) == "true", caption.strip(), page_url)
    return list(out.values())


_verify_cache: dict[str, tuple[bool, str]] = {}


def verify_playable(video_id: str) -> tuple[bool, str]:
    """True if the video plays for a signed-out viewer.

    oEmbed returns 200 only for public/unlisted, embeddable, non-private videos.
    The player endpoint then rules out age, region or private gates. Data-centre
    IPs often get YouTube's generic "confirm you're not a bot" wall, which says
    nothing about the video; in that case the oEmbed result decides.
    """
    if video_id in _verify_cache:
        return _verify_cache[video_id]
    url = WATCH.format(video_id)
    try:
        o = http().get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=15)
    except Exception as e:  # noqa: BLE001
        return False, f"oembed error: {e}"
    if o.status_code != 200:
        res = (False, f"oembed HTTP {o.status_code} (private, removed or embedding disabled)")
        _verify_cache[video_id] = res
        return res
    method = "oembed 200"
    try:
        p = http().post(
            "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
            json={"videoId": video_id, "context": {"client": {"clientName": "WEB", "clientVersion": "2.20241126.01.00", "hl": "en"}}},
            timeout=15,
        ).json().get("playabilityStatus", {})
        status, reason = p.get("status", ""), p.get("reason", "")
        if status == "OK":
            method += " + player OK"
        elif status and VIDEO_SPECIFIC.search(reason):
            res = (False, f"player {status}: {reason}")
            _verify_cache[video_id] = res
            return res
        elif status:
            # e.g. "Sign in to confirm you're not a bot" / "The page needs to be reloaded":
            # anti-bot answers to this IP, not facts about the video.
            method += f" (player check inconclusive: {reason[:60]})"
    except Exception:  # noqa: BLE001
        method += " (player check unavailable)"
    _verify_cache[video_id] = (True, method)
    return True, method


def _matches(s: Sample, cat, niche, kw) -> bool:
    return (cat is None or s.category == cat) and (niche is None or s.niche == niche) and (kw is None or kw.lower() in s.caption.lower())


def pick_sample(bank: list[Sample], deliverable: str, vertical_hint: bool | None = None) -> tuple[Sample | None, str, str]:
    """Return (sample, link_label, note). Exactly one verified, rights-approved sample or None."""
    rule = DELIVERABLE_RULES.get(deliverable)
    if not rule:
        return None, "", f"no sample rule for deliverable '{deliverable}'"
    tried = []
    for cat, niche, kw in rule["prefer"]:
        candidates = [s for s in bank if s.rights_approved and _matches(s, cat, niche, kw)]
        if vertical_hint is not None:
            candidates.sort(key=lambda s: (s.orientation == "vertical") != vertical_hint)
        for s in candidates:
            if s.video_id in tried:
                continue
            tried.append(s.video_id)
            ok, how = verify_playable(s.video_id)
            if ok:
                return s, rule["label"], how
    return None, rule["label"], f"no verified playable sample for {deliverable} (tried {len(tried)})"
