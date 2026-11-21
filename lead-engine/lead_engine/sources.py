"""Lead sources backed by Apify Actors.

Actor IDs, input fields and output fields below were checked against each
Actor's published input schema and a real test run (see README, "Apify
Actors"). Inputs are sized from the per-event price so a run's real spend
stays within the per-source cap, even when an Actor enforces a higher
minimum `maxTotalChargeUsd`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import quote_plus

from .util import canonical_url, clean_text, parse_dt


@dataclass
class Opportunity:
    source: str
    post_id: str
    url: str
    posted_at: object  # datetime | None
    title: str
    text: str
    author_name: str = ""
    author_is_company: bool = False
    company: str = ""
    company_url: str = ""
    website: str = ""
    location: str = ""
    employment_type: str = ""
    apply_url: str = ""
    raw_meta: dict = field(default_factory=dict)

    @property
    def key(self) -> str:
        """Dedup key: original post ID when the platform has one, else canonical URL."""
        return f"{self.source.split('_')[0]}:{self.post_id}" if self.post_id else canonical_url(self.url)


@dataclass
class SourceSpec:
    name: str
    actor_id: str
    price_per_item: float  # USD, FREE tier, from the Actor's pricing (checked 2026-11-21)
    start_cost: float
    label: str


SPECS = {
    "linkedin_posts": SourceSpec("linkedin_posts", "harvestapi/linkedin-post-search", 0.002, 0.00005, "LinkedIn posts"),
    "linkedin_jobs": SourceSpec("linkedin_jobs", "curious_coder/linkedin-jobs-scraper", 0.002, 0.00005, "LinkedIn jobs"),
    "google_hiring": SourceSpec("google_hiring", "apify/google-search-scraper", 0.0045, 0.00005, "Google (Reddit + hiring pages)"),
    "reddit_threads": SourceSpec("reddit_threads", "trudax/reddit-scraper-lite", 0.0018, 0.0216, "Reddit threads"),
}

LINKEDIN_POST_QUERIES = [
    "looking for freelance video editor",
    "hiring freelance video editor",
    "need a video editor for reels",
    "looking for motion designer freelance",
    "hiring podcast editor",
    "looking for video editing agency",
]

LINKEDIN_JOB_SEARCHES = [
    ("video editor", "India"),
    ("motion graphics designer", "India"),
    ("video editor", "Worldwide"),
]

GOOGLE_QUERIES = [
    'site:reddit.com "[hiring]" "video editor"',
    'site:reddit.com "[hiring]" ("motion designer" OR "motion graphics" OR "podcast editor")',
    '"hiring" ("freelance video editor" OR "contract video editor") ("send your portfolio" OR "email") India',
    '"looking for" ("video editor" OR "motion designer") freelance (SaaS OR D2C OR "real estate" OR coach)',
]

AGGREGATOR_HOSTS = re.compile(
    r"(upwork|fiverr|freelancer\.|truelancer|vollna|jobrapido|naukri\.com/[a-z-]+-jobs|glassdoor|indeed\.|weekday\.works|"
    r"guru\.com|peopleperhour|workana|simplyhired|ziprecruiter|/hire/|/job-search/|/jobs-in-|/become/)",
    re.I,
)


def _affordable(cap_usd: float, spec: SourceSpec, want: int) -> int:
    budget = max(0.0, cap_usd - spec.start_cost)
    return max(0, min(want, int(budget / spec.price_per_item)))


# ------------------------------------------------------------ input builders
def build_input(name: str, window_days: int, max_items: int, cap_usd: float, reddit_urls: list[str] | None = None) -> tuple[dict, int]:
    spec = SPECS[name]
    n = _affordable(cap_usd, spec, max_items)
    if name == "linkedin_posts":
        per = max(1, n // len(LINKEDIN_POST_QUERIES))
        return {
            "searchQueries": LINKEDIN_POST_QUERIES,
            "maxPosts": per,
            "postedLimit": "week" if window_days <= 7 else "month",
            "sortBy": "date",
            "profileScraperMode": "short",
        }, per * len(LINKEDIN_POST_QUERIES)
    if name == "linkedin_jobs":
        tpr = window_days * 86400
        urls = [
            "https://www.linkedin.com/jobs/search/?keywords={}&location={}&f_JT=C%2CP&f_TPR=r{}".format(quote_plus(k), quote_plus(loc), tpr)
            for k, loc in LINKEDIN_JOB_SEARCHES
        ]
        per = max(1, n // len(urls))
        return {"urls": urls, "limitPerSource": per, "scrapeCompany": True}, per * len(urls)
    if name == "google_hiring":
        pages = max(1, min(n, len(GOOGLE_QUERIES)))
        return {
            "queries": "\n".join(GOOGLE_QUERIES[:pages]),
            "maxPagesPerQuery": 1,
            "quickDateRange": f"d{window_days}",
        }, pages
    if name == "reddit_threads":
        urls = (reddit_urls or [])[:n]
        return {
            "startUrls": [{"url": u} for u in urls],
            "maxItems": len(urls),
            "maxPostCount": len(urls),
            "maxComments": 0,
            "skipComments": True,
            "skipUserPosts": True,
            "skipCommunity": True,
            "includeNSFW": False,
        }, len(urls)
    raise KeyError(name)


# ------------------------------------------------------------ normalisers
def normalize(name: str, item: dict) -> list[Opportunity]:
    if name == "linkedin_posts":
        a = item.get("author") or {}
        is_co = a.get("type") == "company"
        posted = (item.get("postedAt") or {}).get("date") if isinstance(item.get("postedAt"), dict) else item.get("postedAt")
        return [Opportunity(
            source=name, post_id=str(item.get("id") or ""), url=item.get("linkedinUrl") or "",
            posted_at=parse_dt(posted), title="", text=item.get("content") or "",
            author_name=a.get("name") or "", author_is_company=is_co,
            company=(a.get("name") if is_co else "") or "", company_url=a.get("linkedinUrl") or "",
            website=a.get("website") or "", location=a.get("location") or "",
            raw_meta={"author_info": a.get("info") or "", "author_profile": a.get("linkedinUrl") or ""},
        )]
    if name == "linkedin_jobs":
        return [Opportunity(
            source=name, post_id=str(item.get("id") or ""), url=(item.get("link") or "").split("?")[0],
            posted_at=parse_dt(item.get("postedAt")), title=item.get("title") or "",
            text=item.get("descriptionText") or clean_text(item.get("descriptionHtml") or ""),
            company=item.get("companyName") or "", company_url=item.get("companyLinkedinUrl") or "",
            website=item.get("companyWebsite") or "", location=item.get("location") or "",
            employment_type=item.get("employmentType") or "", apply_url=item.get("applyUrl") or "",
            raw_meta={"industries": item.get("industries") or "", "applicants": item.get("applicantsCount") or ""},
        )]
    if name == "google_hiring":
        out = []
        for r in item.get("organicResults") or []:
            url = r.get("url") or ""
            if not url or AGGREGATOR_HOSTS.search(url):
                continue
            if "reddit.com" in url and "/comments/" not in url:
                continue
            out.append(Opportunity(
                source=name, post_id="", url=url, posted_at=parse_dt(r.get("date")),
                title=r.get("title") or "", text=r.get("description") or "",
                raw_meta={"query": (item.get("searchQuery") or {}).get("term", "")},
            ))
        return out
    if name == "reddit_threads":
        if item.get("dataType") not in (None, "post"):
            return []
        return [Opportunity(
            source=name, post_id=str(item.get("parsedId") or item.get("id") or ""), url=item.get("url") or "",
            posted_at=parse_dt(item.get("createdAt")), title=item.get("title") or "", text=item.get("body") or "",
            author_name=item.get("username") or "", location="",
            raw_meta={"community": item.get("communityName") or ""},
        )]
    raise KeyError(name)


def reddit_urls_from(opps: list[Opportunity]) -> list[str]:
    seen, out = set(), []
    for o in opps:
        if "reddit.com" in o.url and "/comments/" in o.url:
            c = canonical_url(o.url)
            if c not in seen:
                seen.add(c)
                out.append(o.url)
    return out
