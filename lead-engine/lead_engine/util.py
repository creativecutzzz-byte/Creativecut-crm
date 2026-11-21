"""Small shared helpers: HTTP session, hashing, URL canonicalisation, time."""

from __future__ import annotations

import hashlib
import html
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests

IST = timezone(timedelta(hours=5, minutes=30))
USER_AGENT = "CreativeCutLeadEngine/1.0 (+https://creativecut.in)"

_session: requests.Session | None = None


def http() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        s.headers["User-Agent"] = USER_AGENT
        _session = s
    return _session


def with_retries(fn, attempts: int = 4, base_delay: float = 2.0, retry_on=(requests.RequestException,)):
    """Run fn() with exponential backoff. Re-raises the last error."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except retry_on as e:  # noqa: PERF203
            last = e
            if i < attempts - 1:
                time.sleep(base_delay * (2**i))
    raise last  # type: ignore[misc]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str:
    return dt.astimezone(IST).strftime("%Y-%m-%d %H:%M") if dt else ""


def parse_dt(value) -> datetime | None:
    """Parse ISO strings, YYYY-MM-DD, or epoch ms into an aware UTC datetime."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000 if value > 1e11 else value, timezone.utc)
    s = str(value).strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def short_hash(*parts: str, n: int = 10) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:n]


_TRACKING_PARAMS = re.compile(r"^(utm_|ref|refId|trackingId|position|pageNum|trk|rcm|lipi|originalSubdomain|share_id|context)", re.I)


def canonical_url(url: str) -> str:
    """Lower-case host, drop tracking params, fragments and trailing slashes."""
    if not url:
        return ""
    p = urlsplit(url.strip())
    host = p.netloc.lower()
    for prefix in ("www.", "m.", "old.", "in.", "uk.", "np."):
        if host.startswith(prefix) and host.count(".") >= 2:
            host = host[len(prefix):]
    q = [(k, v) for k, v in parse_qsl(p.query) if not _TRACKING_PARAMS.match(k)]
    path = re.sub(r"/+$", "", p.path) or "/"
    return urlunsplit(("https", host, path, urlencode(q), ""))


def domain_of(url_or_email: str) -> str:
    s = (url_or_email or "").strip().lower()
    if "@" in s and "/" not in s:
        return s.rsplit("@", 1)[1]
    host = urlsplit(s if "://" in s else "https://" + s).netloc
    return host[4:] if host.startswith("www.") else host


def clean_text(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def excerpt_around(text: str, pattern: re.Pattern, width: int = 220) -> str:
    t = clean_text(text)
    m = pattern.search(t)
    if not m:
        return t[:width]
    start = max(0, m.start() - width // 3)
    out = t[start : start + width]
    return ("…" if start else "") + out + ("…" if start + width < len(t) else "")


def first_name(full: str) -> str:
    full = (full or "").strip()
    if not full or re.search(r"\d|_", full) or len(full) > 40:
        return ""
    token = full.split()[0]
    return token if token.isalpha() and token[0].isupper() else ""
