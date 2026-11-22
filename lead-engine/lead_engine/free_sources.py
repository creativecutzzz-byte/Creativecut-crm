"""Free lead sources (no Apify, no key), from the public-apis list:
RemoteOK (https://remoteok.com/api) and Arbeitnow (https://www.arbeitnow.com/api/job-board-api).
Only listings whose title names an editing / motion role are kept; the normal qualification
rules (freelance/contract, recency, exclusions) then run on them like any other source.
"""

from __future__ import annotations

import re

from .sources import Opportunity
from .util import clean_text, http, parse_dt

ROLE_TITLE = re.compile(r"(video\s*edit|editor\b|motion\s*(graphics?|design)|animator|podcast|youtube|reels?|content\s*creator|videograph)", re.I)
UA = {"User-Agent": "CreativeCutLeadEngine/1.0 (+https://creativecut.in)"}


def remoteok(limit: int = 30) -> list[Opportunity]:
    r = http().get("https://remoteok.com/api", headers=UA, timeout=30)
    r.raise_for_status()
    out = []
    for j in r.json()[1:]:  # first element is a legal notice
        title = j.get("position") or ""
        if not ROLE_TITLE.search(title):
            continue
        out.append(Opportunity(
            source="remoteok", post_id=str(j.get("id") or ""), url=j.get("url") or "",
            posted_at=parse_dt(j.get("date")), title=title, text=clean_text(j.get("description") or ""),
            company=j.get("company") or "", location=j.get("location") or "Remote",
            employment_type="", apply_url=j.get("apply_url") or "",
        ))
        if len(out) >= limit:
            break
    return out


def arbeitnow(limit: int = 30) -> list[Opportunity]:
    r = http().get("https://www.arbeitnow.com/api/job-board-api", headers=UA, timeout=30)
    r.raise_for_status()
    out = []
    for j in r.json().get("data", []):
        title = j.get("title") or ""
        if not ROLE_TITLE.search(title):
            continue
        out.append(Opportunity(
            source="arbeitnow", post_id=str(j.get("slug") or ""), url=j.get("url") or "",
            posted_at=parse_dt(j.get("created_at")), title=title, text=clean_text(j.get("description") or ""),
            company=j.get("company_name") or "", location=j.get("location") or ("Remote" if j.get("remote") else ""),
            employment_type=", ".join(j.get("job_types") or []),
        ))
        if len(out) >= limit:
            break
    return out


FREE = {"remoteok": remoteok, "arbeitnow": arbeitnow}
