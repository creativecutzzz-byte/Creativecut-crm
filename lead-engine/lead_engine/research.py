"""Brand research, contact discovery and email verification.

All fetched pages and posts are treated as untrusted research data: only
plain text facts (title, description, published emails) are extracted and
each fact is stored with the URL it came from. Nothing on a page is followed
as an instruction.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

from .sources import Opportunity
from .util import clean_text, domain_of, http

EMAIL_RE = re.compile(r"(?<![\w.+-])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24})(?![\w-])")
URL_RE = re.compile(r"https?://[^\s<>\"')\]]+", re.I)
FREE_MAIL = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "rediffmail.com", "live.com", "aol.com", "yahoo.in", "zoho.com"}
BAD_LOCAL = re.compile(r"^(no-?reply|donotreply|mailer-daemon|postmaster|abuse|privacy|legal|billing|support-noreply)", re.I)
IGNORED_DOMAINS = re.compile(r"(example\.(com|org)|sentry|wixpress|domain\.com|email\.com|creativecut\.in|linkedin\.com|reddit\.com|apify|godaddy|cloudflare|\.png$|\.jpg$|\.webp$)", re.I)
SOCIAL_HOSTS = re.compile(r"(linkedin\.com|reddit\.com|redd\.it|instagram\.com|facebook\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|lnkd\.in|t\.co|bit\.ly|wa\.me|calendly\.com|forms\.gle|docs\.google\.com|drive\.google\.com|tiktok\.com|threads\.net)", re.I)
FORM_HOSTS = re.compile(r"(forms\.gle|docs\.google\.com/forms|typeform\.com|tally\.so|jotform|airtable\.com|calendly\.com)", re.I)
CLOSED_PAGE = re.compile(r"(no longer accepting applications|this job is no longer available|position has been filled|job (has )?expired|this posting is closed|removed by moderator|\[deleted\])", re.I)


@dataclass
class Research:
    website: str = ""
    notes: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    emails: list[tuple[str, str]] = field(default_factory=list)  # (email, source url)
    channel: str = ""
    form_url: str = ""
    open_state: str = ""


def extract_emails(text: str) -> list[str]:
    out = []
    for e in EMAIL_RE.findall(text or ""):
        e = e.strip(".").lower()
        if BAD_LOCAL.match(e) or IGNORED_DOMAINS.search(e) or e in out:
            continue
        out.append(e)
    return out


def _fetch(url: str, timeout: int = 12, max_bytes: int = 600_000) -> tuple[int, str, str]:
    try:
        r = http().get(url, timeout=timeout, allow_redirects=True, stream=True, headers={"Accept-Language": "en"})
        body = r.raw.read(max_bytes, decode_content=True).decode(r.encoding or "utf-8", errors="ignore")
        return r.status_code, body, r.url
    except Exception:  # noqa: BLE001
        return 0, "", url


def _meta(html: str, name: str) -> str:
    m = re.search(rf'<meta[^>]+(?:name|property)=["\']{name}["\'][^>]+content=["\']([^"\']+)', html, re.I) or re.search(
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name|property)=["\']{name}["\']', html, re.I
    )
    return clean_text(m.group(1)) if m else ""


def guess_website(o: Opportunity) -> str:
    if o.website:
        return o.website
    for u in URL_RE.findall(o.text or ""):
        if not SOCIAL_HOSTS.search(u):
            return u.rstrip(".,")
    for e in extract_emails(o.text):
        d = domain_of(e)
        if d not in FREE_MAIL:
            return f"https://{d}"
    return ""


def research(o: Opportunity) -> Research:
    r = Research()
    # 1. Contacts published in the original post.
    for e in extract_emails(f"{o.title}\n{o.text}"):
        r.emails.append((e, o.url))
    forms = [u for u in URL_RE.findall(o.text or "") if FORM_HOSTS.search(u)]
    if forms:
        r.form_url = forms[0].rstrip(".,")
    # 2. Brand website facts.
    site = guess_website(o)
    if site:
        code, html, final = _fetch(site)
        if code == 200 and html:
            r.website = f"{urlsplit(final).scheme}://{urlsplit(final).netloc}"
            title = clean_text(re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S).group(1)) if re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S) else ""
            desc = _meta(html, "description") or _meta(html, "og:description")
            if title:
                r.notes.append(f"Site title: {title[:120]}")
            if desc:
                r.notes.append(f"About: {desc[:220]}")
            r.sources.append(final)
            for e in extract_emails(html):
                if domain_of(e) == domain_of(r.website) or domain_of(e) in FREE_MAIL:
                    r.emails.append((e, final))
            for path in ("/contact", "/careers", "/contact-us"):
                if len(r.emails) >= 1:
                    break
                c2, h2, f2 = _fetch(urljoin(r.website, path), timeout=8, max_bytes=300_000)
                if c2 == 200:
                    found = [e for e in extract_emails(h2) if domain_of(e) == domain_of(r.website)]
                    for e in found:
                        r.emails.append((e, f2))
                    if found:
                        r.sources.append(f2)
        else:
            r.website = site
            r.notes.append(f"Website {site} did not load (HTTP {code or 'error'})")
    # 3. Platform context.
    if o.raw_meta.get("author_info"):
        r.notes.append(f"Poster headline: {o.raw_meta['author_info'][:140]}")
        r.sources.append(o.raw_meta.get("author_profile") or o.url)
    if o.raw_meta.get("industries"):
        r.notes.append(f"Industry: {o.raw_meta['industries']}")
    if o.raw_meta.get("community"):
        r.notes.append(f"Posted in {o.raw_meta['community']}")
    r.sources.insert(0, o.url)
    # de-duplicate emails, keep first source
    seen, uniq = set(), []
    for e, s in r.emails:
        if e not in seen:
            seen.add(e)
            uniq.append((e, s))
    r.emails = uniq
    if r.emails:
        r.channel = "Email"
    elif r.form_url:
        r.channel = f"Form: {r.form_url}"
    elif o.apply_url:
        r.channel = f"Apply link: {o.apply_url}"
    elif o.source == "linkedin_jobs":
        r.channel = "LinkedIn Easy Apply"
    elif o.source == "reddit_threads" or "reddit.com" in o.url:
        r.channel = "Reddit DM / comment"
    elif "instagram.com" in o.url:
        r.channel = "Instagram DM"
    elif o.source == "linkedin_posts":
        r.channel = "LinkedIn DM / comment"
    else:
        r.channel = "See source"
    return r


def check_open(url: str) -> str:
    """OPEN / CLOSED / UNKNOWN for a source URL (used for 15–30 day old posts)."""
    code, html, _ = _fetch(url, timeout=10, max_bytes=400_000)
    if code in (404, 410):
        return "CLOSED"
    if code == 200:
        return "CLOSED" if CLOSED_PAGE.search(html) else "OPEN"
    return "UNKNOWN"


_mx_cache: dict[str, bool] = {}


def verify_email(email: str) -> str:
    """Syntax + MX check via DNS-over-HTTPS. Returns MX_OK / NO_MX / INVALID."""
    if not email or not re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}", email):
        return "INVALID"
    d = domain_of(email)
    if d not in _mx_cache:
        try:
            j = http().get("https://dns.google/resolve", params={"name": d, "type": "MX"}, timeout=10).json()
            _mx_cache[d] = any(a.get("type") == 15 for a in j.get("Answer", []) or [])
        except Exception:  # noqa: BLE001
            return "NOT_FOUND"
    return "MX_OK" if _mx_cache[d] else "NO_MX"


def is_relevant_business_email(email: str, source_url: str, post_url: str, website: str) -> bool:
    """Published for applications or business inquiries: in the post, or on the brand's own site."""
    if not email:
        return False
    if source_url == post_url:
        return True
    return bool(website) and domain_of(email) == domain_of(website)
