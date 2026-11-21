"""Offline tests: no network, no Apify spend, fake Gmail."""

from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone

import pytest

from lead_engine import pipeline as P
from lead_engine import research as R
from lead_engine.compose import Facts, check_rendered, compose
from lead_engine.config import Env
from lead_engine.gmail import GmailTimeout
from lead_engine.ledger import LocalLedger, attempt_id
from lead_engine.samples import Sample
from lead_engine.samples import verify_playable as REAL_VERIFY
from lead_engine.sheets import LocalStore, merge_row
from lead_engine.sources import normalize

NOW = datetime(2026, 11, 21, 12, 0, tzinfo=timezone.utc)


def li_post(pid, text, days_ago=1, name="Asha Rao"):
    return {"id": pid, "linkedinUrl": f"https://www.linkedin.com/posts/x-activity-{pid}-ab?utm_source=share", "content": text,
            "postedAt": {"date": (NOW - timedelta(days=days_ago)).isoformat()}, "author": {"name": name, "type": "profile", "linkedinUrl": "https://linkedin.com/in/x"}}


GOOD = "We're hiring a freelance video editor for Instagram Reels for our D2C skincare brand. Paid per video. Email hello@glowco.in"
ITEMS = {
    "linkedin_posts": [
        li_post("1", GOOD),
        li_post("1", GOOD),  # exact duplicate post ID
        li_post("2", "Looking for a part-time podcast editor for our SaaS founder show. Send work to team@podsaas.io", name="Ravi Kumar"),
        li_post("3", "[For Hire] I am a video editor, DM me for edits"),            # selling services
        li_post("4", "Hiring video editor, full-time, work from office in Pune"),   # full-time only
        li_post("5", "Looking for a video editor, unpaid, for exposure"),           # unpaid
        li_post("6", GOOD.replace("hello@glowco.in", "x@y.com"), days_ago=40),    # too old
    ]
}
BANK = [
    Sample("FSR7tlrR34Y", "editing", "creator-reels", "vertical", True, "Podcast-style talking-head reel with captions.", "https://www.creativecut.in/work"),
    Sample("-dcbuUzgirI", "motion", "creator-reels", "vertical", True, "Talking-head creator reel about YouTube automation, with captions.", "https://www.creativecut.in/work"),
    Sample("v7C_SsqCYAU", "ai", "ai", "vertical", True, "AI-enhanced product ad for a facial mist.", "https://www.creativecut.in/work"),
]


class FakeGmail:
    def __init__(self, timeout_first=False):
        self.sent, self.lock, self.timeout_first = [], threading.Lock(), timeout_first

    def send(self, raw, thread_id=None, timeout=30):
        import base64
        import email

        msg = email.message_from_bytes(base64.urlsafe_b64decode(raw))
        with self.lock:
            rec = {"id": f"m{len(self.sent)}", "threadId": f"t{len(self.sent)}", "to": msg["To"], "rfc": msg["Message-ID"]}
            self.sent.append(rec)
        if self.timeout_first:
            self.timeout_first = False
            raise GmailTimeout("read timed out after submit")
        return {"id": rec["id"], "threadId": rec["threadId"]}

    def find_sent(self, rfc, scan=100):
        for r in self.sent:
            if r["rfc"] == rfc:
                return {"id": r["id"], "threadId": r["threadId"]}
        return None

    def classify_thread(self, tid, sender):
        return "SENT", ""


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(R, "_fetch", lambda url, **k: (0, "", url))
    monkeypatch.setattr(R, "verify_email", lambda e: "MX_OK")
    monkeypatch.setattr(R, "check_open", lambda url: "OPEN")
    monkeypatch.setattr(P, "load_bank", lambda url: BANK)
    monkeypatch.setattr(P, "verify_playable", lambda vid: (True, "test"))
    import lead_engine.samples as S
    monkeypatch.setattr(S, "verify_playable", lambda vid: (True, "test"))
    monkeypatch.setattr(P.Pipeline, "_url_verified", lambda self, url: True)


def make(tmp_path, live=False, cap=10, gmail=None):
    store = LocalStore(str(tmp_path / "sheet.json"))
    store.data["Settings"] = [{"Key": "SENDING_ENABLED", "Value": "TRUE" if live else "FALSE"}, {"Key": "DAILY_SEND_CAP", "Value": str(cap)},
                              {"Key": "ACTIVE_SOURCES", "Value": "linkedin_posts"}, {"Key": "MIN_QUALIFIED_BEFORE_EXTEND", "Value": "0"}]
    store.save()
    return store, LocalLedger(str(tmp_path / "ledger"))


def run(store, ledger, gmail=None, now=NOW):
    return P.Pipeline(store, ledger, Env(), gmail=gmail, trigger="test", now=now, offline_items=ITEMS).run()


def test_qualification_and_exclusions(tmp_path):
    store, ledger = make(tmp_path)
    st = run(store, ledger)
    leads = store.read("Leads")
    assert len(leads) == 2, [l["Post Excerpt"] for l in leads]
    assert st.found == 7 and st.qualified == 2
    q = store.read("Outreach Queue")
    assert {r["Recipient"] for r in q} == {"hello@glowco.in", "team@podsaas.io"}
    assert all(r["Status"] == "READY" for r in q), [r["Last Error"] for r in q]
    assert st.sent == 0  # DRY_RUN


def test_duplicate_run_adds_nothing(tmp_path):
    store, ledger = make(tmp_path)
    run(store, ledger)
    before = (len(store.read("Leads")), len(store.read("Outreach Queue")))
    st2 = run(store, ledger, now=NOW + timedelta(hours=7))
    assert (len(store.read("Leads")), len(store.read("Outreach Queue"))) == before
    assert st2.qualified == 0


def test_manual_edits_preserved():
    existing = {"Lead ID": "L1", "Status": "SKIPPED", "System Status": "READY", "Notes": "called them", "Company": "Old"}
    new = {"Lead ID": "L1", "Status": "SENT", "Notes": "", "Company": "New"}
    out = merge_row("Leads", existing, new)
    assert out["Status"] == "SKIPPED" and out["Notes"] == "called them" and out["Company"] == "New"
    untouched = merge_row("Leads", {"Lead ID": "L1", "Status": "READY", "System Status": "READY"}, {"Lead ID": "L1", "Status": "SENT"})
    assert untouched["Status"] == "SENT" and untouched["System Status"] == "SENT"


def test_ledger_claim_is_exclusive(tmp_path):
    led = LocalLedger(str(tmp_path))
    aid = attempt_id("L1", "A@B.com")
    assert aid == attempt_id("L1", "a@b.com")
    assert led.claim(aid, {"status": "SENDING"}) is True
    assert led.claim(aid, {"status": "SENDING"}) is False


def test_live_send_once_across_overlapping_runs(tmp_path):
    store, ledger = make(tmp_path, live=False)
    run(store, ledger)  # drafts READY rows
    store.data["Settings"][0]["Value"] = "TRUE"
    store.save()
    gm = FakeGmail()
    # Two overlapping executions: the run lock lets only one in.
    ledger.acquire_lock("run", 3600)
    st_blocked = run(store, ledger, gmail=gm)
    assert st_blocked.sent == 0 and gm.sent == []
    ledger.release_lock("run")
    st = run(store, ledger, gmail=gm)
    assert st.sent == 2 and len(gm.sent) == 2
    # Retry / rerun: nothing is resent.
    st3 = run(store, ledger, gmail=gm, now=NOW + timedelta(hours=1))
    assert st3.sent == 0 and len(gm.sent) == 2
    q = store.read("Outreach Queue")
    assert all(r["Status"] == "SENT" and r["Gmail Message ID"] for r in q)


def test_two_senders_same_attempt_only_one_sends(tmp_path):
    store, ledger = make(tmp_path)
    run(store, ledger)
    store.data["Settings"][0]["Value"] = "TRUE"
    store.save()
    gm = FakeGmail()
    rows = [r for r in store.read("Outreach Queue") if r["Status"] == "READY"]
    p1 = P.Pipeline(store, ledger, Env(), gmail=gm, now=NOW)
    p2 = P.Pipeline(store, ledger, Env(), gmail=gm, now=NOW)
    out1 = p1._send_one(rows[0], "me@x.com", "Me")
    out2 = p2._send_one(rows[0], "me@x.com", "Me")
    assert out1["Status"] == "SENT" and out2["Status"] == "SENT"
    assert len(gm.sent) == 1  # the second saw the ledger record and did not resend


def test_timeout_after_submit_reconciles_against_sent(tmp_path):
    store, ledger = make(tmp_path)
    run(store, ledger)
    store.data["Settings"][0]["Value"] = "TRUE"
    store.save()
    gm = FakeGmail(timeout_first=True)
    st = run(store, ledger, gmail=gm)
    assert len(gm.sent) == 2 and st.sent == 2  # timed-out message found in Sent, not resent


def test_daily_cap(tmp_path):
    store, ledger = make(tmp_path, cap=1)
    run(store, ledger)
    store.data["Settings"][0]["Value"] = "TRUE"
    store.save()
    gm = FakeGmail()
    st = run(store, ledger, gmail=gm)
    assert st.sent == 1
    st2 = run(store, ledger, gmail=gm, now=NOW + timedelta(hours=3))  # 20:30 IST, same day
    assert st2.sent == 0  # same IST day, cap shared by both runs


def test_suppression_blocks_send(tmp_path):
    store, ledger = make(tmp_path)
    store.data["Suppression"] = [{"Value": "glowco.in", "Type": "DO_NOT_CONTACT"}]
    store.save()
    run(store, ledger)
    q = {r["Recipient"]: r for r in store.read("Outreach Queue")}
    assert q["hello@glowco.in"]["Status"] == "SKIPPED"


def test_rendered_email_links_and_placeholders():
    f = Facts(first_name="Asha", requirement="needing a freelance video editor for Instagram Reels", deliverable="short-form reels", sources=["x"])
    mail = compose(f, "Talking-head content", BANK[1], "talking-head reel with captions")
    assert '<a href="https://creativecut.in">Creative Cut</a>' in mail.html
    assert '<a href="https://www.youtube.com/watch?v=-dcbuUzgirI">Watch a similar talking-head reel with captions</a>' in mail.html
    assert check_rendered(mail, lambda u: True) == []
    bad = compose(Facts(requirement="[specific requirement]", deliverable="x"), "Default first email", None, "")
    probs = check_rendered(bad, lambda u: True)
    assert any("placeholder" in p for p in probs) and any("sample" in p for p in probs)


def test_normalize_dedup_key():
    o = normalize("linkedin_posts", li_post("99", GOOD))[0]
    assert o.key == "linkedin:99"


def test_playability_generic_antibot_is_inconclusive_not_failure(monkeypatch):
    import lead_engine.samples as S

    class R:
        def __init__(self, code, j=None):
            self.status_code, self._j = code, j or {}

        def json(self):
            return self._j

    class H:
        def __init__(self, reason):
            self.reason = reason

        def get(self, *a, **k):
            return R(200)

        def post(self, *a, **k):
            return R(200, {"playabilityStatus": {"status": "UNPLAYABLE" if "reload" in self.reason else "LOGIN_REQUIRED", "reason": self.reason}})

    for reason, ok in [("The page needs to be reloaded.", True), ("Sign in to confirm you’re not a bot", True), ("Sign in to confirm your age", False), ("Video unavailable", False)]:
        S._verify_cache.clear()
        monkeypatch.setattr(S, "http", lambda h=H(reason): h)
        assert REAL_VERIFY("abcdefghijk")[0] is ok, reason


def test_schedule_sync_creates_patches_and_verifies():
    from lead_engine.config import Settings
    from lead_engine.scheduler import sync

    class Resp:
        def __init__(self, code, j=None):
            self.status_code, self._j = code, j or {}

        def json(self):
            return self._j

        def raise_for_status(self):
            assert self.status_code < 400

    class FakeScheduler:
        def __init__(self):
            self.jobs, self.calls = {}, []

        def get(self, url, **k):
            name = url.split("/v1/", 1)[1]
            return Resp(200, self.jobs[name]) if name in self.jobs else Resp(404)

        def post(self, url, json=None, **k):
            self.calls.append("create")
            self.jobs[json["name"]] = json
            return Resp(200, json)

        def patch(self, url, json=None, **k):
            self.calls.append("patch")
            self.jobs[url.split("/v1/", 1)[1]] = json
            return Resp(200, json)

    env = Env(gcp_project="p", gcp_region="asia-south1", scheduler_sa="s@p.iam.gserviceaccount.com")
    fake = FakeScheduler()
    s = Settings.defaults()
    rep = sync(s, env, session=fake)
    assert fake.calls == ["create", "create"] and all("VERIFIED" in r for r in rep)
    assert {j["schedule"] for j in fake.jobs.values()} == {"0 9 * * *", "0 16 * * *"}
    assert {j["timeZone"] for j in fake.jobs.values()} == {"Asia/Kolkata"}
    s["RUN_TIME_2"] = "17:30"  # edited in the Sheet
    rep = sync(s, env, session=fake)
    assert fake.calls[-1] == "patch" and any("30 17 * * *" in r and "VERIFIED" in r for r in rep)
    assert any("unchanged" in r for r in rep)
