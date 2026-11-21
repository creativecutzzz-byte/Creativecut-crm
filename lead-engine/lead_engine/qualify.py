"""Rule-based qualification: active buying intent, exclusions, niche, market, fit."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

from .sources import Opportunity
from .util import excerpt_around, now_utc

ROLE = r"(video\s*editor|video\s*editing|reels?\s*editor|short[- ]?form\s*editor|motion\s*(graphics?\s*)?design(er)?|motion\s*graphics|podcast\s*editor|animator|creative\s*agency|video\s*(production\s*)?agency|youtube\s*editor|thumbnail\s*and\s*video|editor\s+for\s+(my|our|a|the))"
INTENT = re.compile(
    rf"(\[hiring\]|\bhiring\b|looking\s+for|need(ed)?\s+(an?|some)?|seeking|searching\s+for|we('| a)re\s+hiring|wanted|recruiting|open\s+role|require[sd]?)[^.\n]{{0,80}}{ROLE}"
    rf"|{ROLE}[^.\n]{{0,40}}(needed|wanted|required|position|role|opening|\(freelance|\(contract|\(part[- ]time)",
    re.I,
)
ROLE_RE = re.compile(ROLE, re.I)

SELLING = re.compile(
    r"(\[for\s*hire\]|\bfor\s+hire\b|i\s*('?m| am)\s+(a|an)\s+(freelance\s+)?(video\s*editor|editor|motion)|available\s+for\s+(work|projects|hire)|"
    r"my\s+(editing\s+)?services|hire\s+me|dm\s+me\s+for\s+(edits|editing)|offering\s+(video|editing)|i\s+edit\s+videos|check\s+out\s+my\s+portfolio|"
    r"showreel\s+might\s+be|tips\s+for\s+(video\s+)?editors|how\s+to\s+become|"
    r"if\s+you('| a)re\s+looking\s+for\s+an?\s+(video\s+)?editor|my\s+dms?\s+(are\s+)?open|i\s+help\s+(brands|creators|businesses)|open\s+to\s+(new\s+)?(projects|clients|work)|let'?s\s+work\s+together|looking\s+for\s+(new\s+|more\s+)?clients)",
    re.I,
)
UNPAID = re.compile(r"(unpaid|for\s+exposure|no\s+budget|free\s+of\s+cost|volunteer|revenue[- ]share\s+only|equity\s+only|for\s+free\b)", re.I)
CLOSED = re.compile(r"(position\s+(is\s+)?filled|no\s+longer\s+accepting|role\s+(is\s+)?closed|hiring\s+closed|\bclosed\b[^.\n]{0,20}(applications|role|position)|found\s+(an|our)\s+editor|update:\s*hired)", re.I)
FLEX = re.compile(r"(freelanc|contract|part[- ]?time|project[- ]basis|per\s+(video|project|reel|minute|clip)|ongoing\s+work|long[- ]term\s+(editor|work|collab)|remote|as[- ]needed|batch|retainer|outsourc)", re.I)
FULLTIME = re.compile(r"(full[- ]?time|work\s+from\s+office|in[- ]house|wfo\b|on[- ]?site\s+only|permanent\s+role)", re.I)
INTERN = re.compile(r"\bintern(ship)?s?\b", re.I)
MASS_SPAM = re.compile(r"(multiple\s+global\s+job\s+openings|send\s+me\s+connection|we('| a)re\s+urgently\s+sourcing|across\s+various\s+industries)", re.I)

NICHES = [
    ("Real estate", re.compile(r"(real\s*estate|property|properties|realty|walkthrough|builder\s+floor|\bplots?\b|\bbhk\b)", re.I)),
    ("SaaS", re.compile(r"(saas|software\s+(company|product)|b2b|product\s+demo|app\s+demo|mobile\s+app|tech\s+startup|product\s+animation|ui\s+animation|dashboard\s+walkthrough)", re.I)),
    ("D2C", re.compile(r"(d2c|dtc|e-?commerce|shopify|skincare|beauty|ayurved|fashion|apparel|supplements?|nutrition|wellness|\bproduct\s+(ads?|videos?|shoots?)|ugc|amazon\s+brand|consumer\s+brand|fmcg)", re.I)),
    ("Agency", re.compile(r"(marketing\s+agency|digital\s+agency|creative\s+agency|our\s+agency|production\s+(house|company)|media\s+production|white[- ]label|for\s+our\s+clients)", re.I)),
    ("Coaches & creators", re.compile(r"(coach|course|creator|personal\s+brand|youtub|influencer|educator|education|podcast|talking[- ]head|channel)", re.I)),
]
DELHI = re.compile(r"(delhi|noida|gurgaon|gurugram|ghaziabad|faridabad|\bncr\b)", re.I)
INDIA = re.compile(r"(india|mumbai|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|ahmedabad|jaipur|lucknow|surat|kerala|₹|\binr\b|rupee|\blakh|\brs\.?\s?\d)", re.I)

DELIVERABLES = [
    ("podcast", re.compile(r"podcast(?!\s*(intro|outro|logo|title))", re.I)),
    ("real_estate", re.compile(r"(real\s*estate|property\s+(tour|walkthrough|video|reel)s?|walkthrough\s+videos?|bhk|realty)", re.I)),
    ("saas_demo", re.compile(r"(saas|product\s+demo|demo\s+videos?|product\s+animation|ui\s+animation|onboarding\s+video|feature\s+video|app\s+(demo|promo))", re.I)),
    ("ad_creative", re.compile(r"(\bads?\b|ad\s+creatives?|performance\s+creative|ugc|meta\s+ads|product\s+videos?|commercials?)", re.I)),
    ("long_form", re.compile(r"(long[- ]?form|youtube\s+(channel|videos?)|\d+\s*[-–]\s*\d+\s*[- ]?min(ute)?s?\b|documentar|vlog|retention)", re.I)),
    ("motion_graphics", re.compile(r"(motion\s*(graphics?|design)|animat|after\s+effects|kinetic|intro\s*(\+|and|/|&)?\s*outro|\bintro\b|\boutro\b|lower\s+thirds|title\s+cards?)", re.I)),
    ("talking_head", re.compile(r"(talking[- ]head|face[- ]cam|captions?|subtitles?)", re.I)),
    ("short_form", re.compile(r"(reels?|shorts|short[- ]form|tiktok)", re.I)),
]


def pick_deliverable(title: str, text: str) -> list[str]:
    """Rank deliverables: title matches weigh 3, body matches 1; ties keep list order."""
    scored = []
    for i, (d, rx) in enumerate(DELIVERABLES):
        sc = 3 * len(rx.findall(title or "")) + min(len(rx.findall(text or "")), 3)
        if sc:
            scored.append((-sc, i, d))
    return [d for _, _, d in sorted(scored)] or ["short_form"]


@dataclass
class Assessment:
    qualified: bool
    reasons_excluded: list[str] = field(default_factory=list)
    niche: str = "Other"
    market: str = "International"
    engagement: str = "Unspecified"
    deliverable: str = "short_form"
    deliverables: list[str] = field(default_factory=list)
    excerpt: str = ""
    fit_reason: str = ""
    score: int = 0
    age_days: float | None = None


def assess(o: Opportunity, window_days: int, now: datetime | None = None) -> Assessment:
    now = now or now_utc()
    # URLs and email addresses are contact data, not requirements (e.g. "podsaas.io").
    text = re.sub(r"\S+@\S+|https?://\S+|www\.\S+", " ", f"{o.title}\n{o.text}")
    a = Assessment(qualified=False)
    a.age_days = (now - o.posted_at).total_seconds() / 86400 if o.posted_at else None

    has_intent = bool(INTENT.search(text)) or (o.source == "linkedin_jobs" and bool(ROLE_RE.search(o.title)))
    if not has_intent:
        a.reasons_excluded.append("no explicit request for an editor / motion designer / agency")
    if SELLING.search(text):
        a.reasons_excluded.append("post sells editing services")
    if UNPAID.search(text):
        a.reasons_excluded.append("unpaid")
    if CLOSED.search(text):
        a.reasons_excluded.append("role appears closed")
    if MASS_SPAM.search(text):
        a.reasons_excluded.append("mass recruitment spam")
    flex = bool(FLEX.search(text))
    ft = bool(FULLTIME.search(text)) or o.employment_type.lower() == "full-time"
    if ft and not flex:
        a.reasons_excluded.append("full-time only")
    if INTERN.search(o.title or "") or (o.employment_type.lower() == "internship" and not flex):
        a.reasons_excluded.append("internship")
    if a.age_days is not None and a.age_days > window_days:
        a.reasons_excluded.append(f"older than {window_days} days")

    a.engagement = (
        "Freelance" if re.search(r"freelanc", text, re.I)
        else "Contract" if re.search(r"contract", text, re.I)
        else "Part-time" if re.search(r"part[- ]?time", text, re.I)
        else "Project" if flex else ("Full-time + flexible" if ft else "Unspecified")
    )
    # Niche by match count (title/company weigh more); ties keep list order.
    best = (0, 99, "Other")
    for i, (name, rx) in enumerate(NICHES):
        sc = len(rx.findall(text)) + 2 * len(rx.findall(f"{o.title} {o.company}"))
        if sc and (-sc, i) < (-best[0], best[1]):
            best = (sc, i, name)
    a.niche = best[2]
    loc = f"{o.location} {text}"
    a.market = "Delhi NCR" if DELHI.search(loc) else "India" if INDIA.search(loc) else "International"
    a.deliverables = pick_deliverable(o.title, text)
    a.deliverable = a.deliverables[0]
    a.excerpt = excerpt_around(text, INTENT if has_intent else ROLE_RE)

    score = 40 if has_intent else 0
    score += 15 if flex else 0
    score += {"SaaS": 15, "D2C": 15, "Coaches & creators": 12, "Real estate": 15, "Agency": 12}.get(a.niche, 4)
    score += {"Delhi NCR": 15, "India": 10}.get(a.market, 6)
    if a.age_days is not None:
        score += 10 if a.age_days <= 7 else 7 if a.age_days <= 14 else 3
    if re.search(r"(budget|₹|\$\s?\d|inr|usd|per\s+video|paid)", text, re.I):
        score += 5
    a.score = min(score, 100)
    a.qualified = not a.reasons_excluded
    parts = [f"{a.niche} lead" if a.niche != "Other" else "Brand lead", f"in {a.market}", f"asks for {a.deliverable.replace('_', ' ')}"]
    if flex:
        parts.append(f"({a.engagement.lower()})")
    parts.append("— matches Creative Cut's core services")
    a.fit_reason = " ".join(parts)
    return a
