"""Optional business-email lookups for qualified leads that published no email.

Apollo: the same endpoints the CRM's Apollo agent already uses
(mixed_people/api_search is free; people/match reveals an email for 1 credit).
Vibe Prospecting: Explorium AgentSource v2 (documented at developers.explorium.ai):
  POST /v2/businesses/match, POST /v2/prospects, POST /v2/prospects/contact_information/enrich.
Vibe Prospecting is discontinued on 2 Dec 2026; lookups stop automatically then.
Each lookup is capped per run in Settings.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from .util import http

APOLLO = "https://api.apollo.io/api/v1"
EXPLORIUM = "https://api.explorium.ai/v2"
VIBE_END = date(2026, 12, 2)
TITLES = ["Founder", "Co-Founder", "CEO", "Head of Marketing", "Marketing Manager", "Content Lead", "Social Media Manager"]


class AuthError(RuntimeError):
    """The provider rejected the key: the app shows 'Needs reconnecting'."""


@dataclass
class Found:
    email: str
    name: str
    source: str


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\(demo\)|pvt|ltd|llc|inc|private|limited", "", (s or "").lower()))


def apollo_lookup(key: str, company: str, domain: str) -> Found | None:
    if not company:
        return None
    h = {"x-api-key": key, "Content-Type": "application/json", "Cache-Control": "no-cache"}
    params = [("q_keywords", company), ("per_page", "10"), ("page", "1")] + [("person_titles[]", t) for t in TITLES]
    r = http().post(f"{APOLLO}/mixed_people/api_search", params=params, headers=h, timeout=20)
    if r.status_code in (401, 403):
        raise AuthError(f"Apollo rejected the saved key (HTTP {r.status_code}).")
    r.raise_for_status()
    target = _norm(company)
    match = next((p for p in r.json().get("people", []) if _norm((p.get("organization") or {}).get("name", "")) == target and p.get("has_email") is not False), None)
    if not match:
        return None
    m = http().post(f"{APOLLO}/people/match", params={"id": match["id"], "reveal_personal_emails": "false"}, headers=h, timeout=20)
    if m.status_code in (401, 403):
        raise AuthError(f"Apollo rejected the saved key (HTTP {m.status_code}).")
    m.raise_for_status()
    p = m.json().get("person") or {}
    email = (p.get("email") or "").lower()
    if not email or "email_not_unlocked" in email:
        return None
    if domain and not email.endswith("@" + domain):
        return None  # only the brand's own domain counts as a business email
    return Found(email, p.get("name") or " ".join(x for x in (p.get("first_name"), p.get("last_name")) if x), "Apollo (people/match)")


def vibe_lookup(key: str, company: str, domain: str, today: date) -> Found | None:
    if today >= VIBE_END or not (company or domain):
        return None
    h = {"api_key": key, "Content-Type": "application/json"}
    biz = {k: v for k, v in (("name", company), ("domain", domain)) if v}
    r = http().post(f"{EXPLORIUM}/businesses/match", json={"businesses_to_match": [biz]}, headers=h, timeout=20)
    if r.status_code in (401, 403):
        raise AuthError(f"Explorium rejected the saved key (HTTP {r.status_code}).")
    r.raise_for_status()
    matched = (r.json().get("matched_businesses") or [{}])[0]
    bid = matched.get("business_id")
    if not bid:
        return None
    pr = http().post(f"{EXPLORIUM}/prospects", headers=h, timeout=30, json={
        "mode": "full", "page_size": 5, "page": 1,
        "filters": {"business_id": {"values": [bid]}, "job_department": {"values": ["marketing"]}, "has_contact_details": {"value": "email"}},
    })
    pr.raise_for_status()
    prospects = pr.json().get("data") or []
    if not prospects:
        return None
    first = prospects[0]
    en = http().post(f"{EXPLORIUM}/prospects/contact_information/enrich", headers=h, timeout=30,
                     json={"prospect_ids": [first["prospect_id"]], "parameters": {"contact_types": ["email"]}})
    en.raise_for_status()
    row = ((en.json().get("data") or [{}])[0].get("data")) or {}
    email = (row.get("professional_email") or "").lower()
    status = row.get("professional_email_status")
    if isinstance(status, dict):
        status = status.get("value") or status.get("status")
    if not email or status == "invalid":
        return None
    if domain and not email.endswith("@" + domain):
        return None
    return Found(email, first.get("full_name") or "", "Vibe Prospecting (Explorium contact enrich)")
