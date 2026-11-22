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


def make(tmp_path, live=False, cap=10, gmail=None, mode="AUTO", extra=None):
    store = LocalStore(str(tmp_path / "sheet.json"))
    store.data["Settings"] = [{"Key": "SENDING_ENABLED", "Value": "TRUE" if live else "FALSE"}, {"Key": "DAILY_SEND_CAP", "Value": str(cap)},
                              {"Key": "ACTIVE_SOURCES", "Value": "linkedin_posts"}, {"Key": "MIN_QUALIFIED_BEFORE_EXTEND", "Value": "0"},
                              {"Key": "AGENT_MODE", "Value": mode}, {"Key": "SENDER_1_DAILY_CAP", "Value": str(cap)}] + [{"Key": k, "Value": v} for k, v in (extra or {}).items()]
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


def _fake_scheduler():
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

        def get(self, url, params=None, **k):
            name = url.split("/v1/", 1)[1]
            if name.endswith("/jobs"):
                return Resp(200, {"jobs": list(self.jobs.values())})
            return Resp(200, self.jobs[name]) if name in self.jobs else Resp(404)

        def post(self, url, json=None, **k):
            name = url.split("/v1/", 1)[1]
            if name.endswith(":pause") or name.endswith(":resume"):
                job = name.rsplit(":", 1)[0]
                self.jobs[job]["state"] = "PAUSED" if name.endswith(":pause") else "ENABLED"
                self.calls.append(name.rsplit(":", 1)[1])
                return Resp(200, self.jobs[job])
            self.calls.append("create")
            self.jobs[json["name"]] = {**json, "state": "ENABLED"}
            return Resp(200, json)

        def patch(self, url, json=None, **k):
            self.calls.append("patch")
            name = url.split("/v1/", 1)[1]
            self.jobs[name] = {**self.jobs[name], **json}
            return Resp(200, json)

        def delete(self, url, **k):
            self.calls.append("delete")
            self.jobs.pop(url.split("/v1/", 1)[1], None)
            return Resp(200)

    return FakeScheduler()


def test_schedule_sync_multi_times_days_one_time_and_pause():
    from lead_engine.config import Settings
    from lead_engine.scheduler import sync

    env = Env(gcp_project="p", gcp_region="asia-south1", scheduler_sa="s@p.iam.gserviceaccount.com")
    fake = _fake_scheduler()
    s = Settings.defaults()
    rep = sync(s, env, session=fake)
    assert sorted(j["schedule"] for j in fake.jobs.values()) == ["0 16 * * *", "0 9 * * *"] and all("VERIFIED" in r for r in rep)
    assert {j["timeZone"] for j in fake.jobs.values()} == {"Asia/Kolkata"}
    # Weekdays only, three times, plus a one-time run; old 16:00 job removed.
    s.update({"SCHEDULE_TIMES": "09:00,13:30,18:00", "SCHEDULE_DAYS": "Mon,Tue,Wed,Thu,Fri", "SCHEDULE_ONE_TIME": "2026-11-25 10:15"})
    rep = sync(s, env, session=fake)
    crons = sorted(j["schedule"] for j in fake.jobs.values())
    assert crons == ["0 18 * * 1,2,3,4,5", "0 9 * * 1,2,3,4,5", "15 10 25 11 *", "30 13 * * 1,2,3,4,5"], crons
    assert any("removed" in r for r in rep)
    # Pause: every job is paused and verified.
    s["SCHEDULE_PAUSED"] = "TRUE"
    rep = sync(s, env, session=fake)
    assert {j["state"] for j in fake.jobs.values()} == {"PAUSED"} and all("VERIFIED" in r or "unchanged" in r for r in rep)


def test_review_mode_drafts_wait_and_only_approved_send(tmp_path):
    store, ledger = make(tmp_path, live=True, mode="REVIEW")
    gm = FakeGmail()
    run(store, ledger, gmail=gm)
    q = store.read("Outreach Queue")
    assert {r["Status"] for r in q} == {"AWAITING_APPROVAL"} and gm.sent == []
    # A person approves one draft in the app.
    approved = q[0]["Attempt ID"]
    for row in store.data["Outreach Queue"]:
        if row["Attempt ID"] == approved:
            row["Status"] = "APPROVED"
    store.save()
    st = run(store, ledger, gmail=gm, now=NOW + timedelta(hours=1))
    assert st.sent == 1 and len(gm.sent) == 1
    after = {r["Attempt ID"]: r["Status"] for r in store.read("Outreach Queue")}
    assert after[approved] == "SENT" and list(after.values()).count("AWAITING_APPROVAL") == 1


def test_three_senders_split_by_per_sender_limit(tmp_path):
    from lead_engine.senders import SenderSlot

    store, ledger = make(tmp_path, live=True, cap=10)
    a, b = FakeGmail(), FakeGmail()
    senders = [SenderSlot(1, "one@x.com", 1, a), SenderSlot(2, "two@x.com", 1, b), SenderSlot(3, "three@x.com", 5, None, "setup_required")]
    st = P.Pipeline(store, ledger, Env(), trigger="test", now=NOW, offline_items=ITEMS, senders=senders).run()
    assert st.sent == 2 and len(a.sent) == 1 and len(b.sent) == 1
    assert {r["Sender"] for r in store.read("Outreach Queue")} == {"one@x.com", "two@x.com"}


def test_send_window_holds_emails(tmp_path):
    # NOW is 17:30 IST; window 09:00-12:00 keeps drafts waiting.
    store, ledger = make(tmp_path, live=True, extra={"SEND_WINDOW": "09:00-12:00"})
    gm = FakeGmail()
    st = run(store, ledger, gmail=gm)
    assert st.sent == 0 and gm.sent == [] and any("send window" in n for n in st.notes)
    assert {r["Status"] for r in store.read("Outreach Queue")} == {"READY"}


def test_edited_email_links_and_placeholder_check(tmp_path):
    store, ledger = make(tmp_path, live=False)
    run(store, ledger)
    row = store.read("Outreach Queue")[0]
    row["Email Preview"] = "Hey Asha,\n\nLoved the launch. Here's our reel list (https://www.creativecut.in/work).\n\nHemant\nCreative Cut (https://creativecut.in)"
    html = P.Pipeline._html_from_preview(row)
    assert '<a href="https://www.creativecut.in/work">our reel list</a>' in html and '<a href="https://creativecut.in">Creative Cut</a>' in html
    p = P.Pipeline(store, ledger, Env(), now=NOW)
    assert p._edit_problems(row) == []
    row["Email Preview"] += "\n[your name]"
    assert any("placeholder" in x for x in p._edit_problems(row))


def test_run_stage_is_written_and_reset(tmp_path):
    store, ledger = make(tmp_path)
    stages = []
    orig = P.Pipeline._set

    def spy(self, values):
        if "RUN_STAGE" in values:
            stages.append(values["RUN_STAGE"])
        orig(self, values)

    P.Pipeline._set = spy
    try:
        run(store, ledger)
    finally:
        P.Pipeline._set = orig
    assert "Checking contact details" in stages and "Writing drafts" in stages and stages[-1] == ""
    s = {r["Key"]: r["Value"] for r in store.read("Settings")}
    assert s["RUN_STATE"] == "IDLE"


NO_EMAIL = {"linkedin_posts": [li_post("50", "We're hiring a freelance video editor for Instagram Reels for our D2C skincare brand Glowco. Paid per video.")]}


def test_enrichment_finds_email_and_marks_bad_key(tmp_path, monkeypatch):
    from lead_engine import enrich
    from lead_engine.research import Research

    monkeypatch.setattr(R, "research", lambda o: Research(website="https://glowco.in", channel="LinkedIn DM / comment" if "DM" in o.text else "See source", sources=[o.url]))
    monkeypatch.setattr(P, "get_secret", lambda name, project="": "key-123")
    calls = []

    def fake_apollo(key, company, domain):
        calls.append(("apollo", domain))
        return enrich.Found("hello@glowco.in", "Asha Rao", "Apollo (people/match)")

    monkeypatch.setattr(P, "apollo_lookup", fake_apollo)
    store, ledger = make(tmp_path, extra={"APOLLO_MAX_LOOKUPS_PER_RUN": "3", "API_APOLLO_HINT": "••••1234"})
    p = P.Pipeline(store, ledger, Env(), now=NOW, offline_items=NO_EMAIL)
    p.offline = None  # enrichment is skipped for replayed datasets; allow it here
    p.discover = lambda: [o for it in NO_EMAIL["linkedin_posts"] for o in normalize("linkedin_posts", it)]
    p.run()
    q = store.read("Outreach Queue")
    assert calls == [("apollo", "glowco.in")] and q[0]["Recipient"] == "hello@glowco.in"
    lead = store.read("Leads")[0]
    assert lead["Email Source"].startswith("Apollo")

    # A rejected key flips Apollo to "needs reconnecting" for the app.
    def bad(key, company, domain):
        raise enrich.AuthError("Apollo rejected the saved key (HTTP 401).")

    monkeypatch.setattr(P, "apollo_lookup", bad)
    store2, ledger2 = make(tmp_path / "b", extra={"APOLLO_MAX_LOOKUPS_PER_RUN": "3", "API_APOLLO_HINT": "••••1234", "VIBE_MAX_LOOKUPS_PER_RUN": "0"})
    p2 = P.Pipeline(store2, ledger2, Env(), now=NOW, offline_items=NO_EMAIL)
    p2.offline = None
    p2.discover = p.discover
    p2.run()
    s2 = {r["Key"]: r["Value"] for r in store2.read("Settings")}
    assert s2["API_APOLLO_STATUS"] == "needs_reconnect" and "401" in s2["API_APOLLO_ERROR"]


def test_enrichment_never_runs_for_dm_only_posts(tmp_path, monkeypatch):
    from lead_engine.research import Research

    monkeypatch.setattr(R, "research", lambda o: Research(website="https://glowco.in", channel="Instagram DM", sources=[o.url]))
    monkeypatch.setattr(P, "get_secret", lambda name, project="": "key-123")
    monkeypatch.setattr(P, "apollo_lookup", lambda *a: (_ for _ in ()).throw(AssertionError("must not be called")))
    store, ledger = make(tmp_path, extra={"APOLLO_MAX_LOOKUPS_PER_RUN": "3"})
    p = P.Pipeline(store, ledger, Env(), now=NOW, offline_items=NO_EMAIL)
    p.offline = None
    p.discover = lambda: [o for it in NO_EMAIL["linkedin_posts"] for o in normalize("linkedin_posts", it)]
    p.run()
    assert store.read("Outreach Queue") == []


# ---------------------------------------------------------------- ideas adopted from OpenOutreach
def test_warmup_starts_at_floor_grows_when_clean_and_halves_on_bounces(tmp_path):
    from lead_engine.senders import SenderSlot

    store, ledger = make(tmp_path, live=True, cap=50, extra={"WARMUP_ENABLED": "TRUE", "SENDER_1_DAILY_CAP": "50"})
    p = P.Pipeline(store, ledger, Env(), now=NOW)
    p.settings = store.settings()
    slot = SenderSlot(1, "one@x.com", 50, object())
    p.senders = [slot]
    assert p._warm_allowance(slot) == 5  # new mailbox: floor
    yday = (NOW.astimezone(P.IST) - timedelta(days=1)).strftime("%Y-%m-%d")
    for i in range(5):  # yesterday it sent its whole allowance, no bounces
        ledger.claim(f"A-y{i}", {"touch": "FIRST", "status": "SENT", "sender": "one@x.com", "day": yday})
    store.data["Settings"] = [r for r in store.data["Settings"] if not r["Key"].startswith("SENDER_1_WARM")] + [{"Key": "SENDER_1_WARM_LIMIT", "Value": "5"}, {"Key": "SENDER_1_WARM_DATE", "Value": yday}]
    store.save()
    p.settings = store.settings()
    assert p._warm_allowance(slot) == 7  # ceil(5 * 1.25)
    # Bounce rate above 5% over the last week halves it.
    for i in range(10):
        ledger.claim(f"A-b{i}", {"touch": "FIRST", "status": "SENT", "sender": "one@x.com", "day": yday, "outcome": "BOUNCED" if i < 2 else "SENT"})
    p.settings["SENDER_1_WARM_LIMIT"], p.settings["SENDER_1_WARM_DATE"] = "8", yday
    assert p._warm_allowance(slot) == 4


def test_warmup_limits_sends_per_day(tmp_path):
    from lead_engine.senders import SenderSlot

    many = {"linkedin_posts": [li_post(str(100 + i), f"We're hiring a freelance video editor for Instagram Reels for our D2C brand. Paid. Email hi@brand{i}.in") for i in range(8)]}
    store, ledger = make(tmp_path, live=True, cap=50, extra={"WARMUP_ENABLED": "TRUE"})
    gm = FakeGmail()
    st = P.Pipeline(store, ledger, Env(), now=NOW, offline_items=many, senders=[SenderSlot(1, "one@x.com", 50, gm)]).run()
    assert st.sent == 5 and len(gm.sent) == 5  # warm-up floor on a fresh mailbox


def test_bettercontact_lookup_polls_and_keeps_only_usable_brand_emails(monkeypatch):
    from lead_engine import enrich

    calls = []

    class R:
        def __init__(self, code, j):
            self.status_code, self._j = code, j

        def json(self):
            return self._j

        def raise_for_status(self):
            assert self.status_code < 400

    polls = iter([{"status": "in progress"}, {"status": "terminated", "data": [{"contact_email_address": "Riya@Glowco.in", "contact_email_address_status": "deliverable", "contact_first_name": "Riya", "contact_last_name": "Kapoor"}]}])

    class H:
        def post(self, url, json=None, headers=None, **k):
            calls.append(("POST", url, headers["X-API-Key"], json))
            return R(201, {"request_id": "req1"})

        def get(self, url, headers=None, **k):
            calls.append(("GET", url))
            return R(200, next(polls))

    monkeypatch.setattr(enrich, "http", lambda: H())
    f = enrich.bettercontact_lookup("k", "Riya Kapoor", "Glowco", "glowco.in", sleep=lambda s: None)
    assert f and f.email == "riya@glowco.in" and f.source.startswith("BetterContact")
    assert calls[0][1].endswith("/api/v2/async") and calls[0][3]["data"][0]["first_name"] == "Riya" and calls[0][3]["enrich_email_address"] is True
    assert calls[-1][1].endswith("/async/req1")
    assert enrich.bettercontact_lookup("k", "Riya", "Glowco", "glowco.in") is None  # needs a full name


def test_auto_replies_are_not_replies_and_bounce_subjects_are_bounces():
    from lead_engine.gmail import Gmail

    def thread(*msgs):
        return {"messages": [{"payload": {"headers": [{"name": "From", "value": "me@x.com"}]}}] + [
            {"snippet": sn, "payload": {"headers": [{"name": k, "value": v} for k, v in hdr.items()]}} for hdr, sn in msgs]}

    g = Gmail.__new__(Gmail)
    g.thread = lambda tid: thread(({"From": "Asha <asha@brand.in>", "Subject": "Automatic reply: Edits for your reels", "Auto-Submitted": "auto-replied"}, "I'm out of office until Monday"))
    assert g.classify_thread("t", "me@x.com")[0] == "SENT"
    g.thread = lambda tid: thread(({"From": "Mail Delivery Subsystem <x@googlemail.com>", "Subject": "Delivery Status Notification (Failure)"}, "Address not found"))
    assert g.classify_thread("t", "me@x.com")[0] == "BOUNCED"
    g.thread = lambda tid: thread(({"From": "Asha <asha@brand.in>", "Subject": "Re: Edits for your reels"}, "Sounds good, send rates"))
    assert g.classify_thread("t", "me@x.com")[0] == "REPLIED"


def test_protected_region_review_skip_and_postal_address(tmp_path):
    eu = {"linkedin_posts": [li_post("200", "We're hiring a freelance video editor for Instagram Reels for our D2C brand in Berlin. Paid. Email hi@brandeu.de")]}
    store, ledger = make(tmp_path, extra={"SENDER_POSTAL_ADDRESS": "Creative Cut, Noida, UP 201301, India"})
    P.Pipeline(store, ledger, Env(), now=NOW, offline_items=eu).run()
    q = store.read("Outreach Queue")[0]
    assert q["Status"] == "NEEDS_REVIEW" and "GDPR" in q["Last Error"] and "Noida, UP 201301" in q["Email Preview"]
    store2, ledger2 = make(tmp_path / "skip", extra={"PROTECTED_REGIONS_POLICY": "SKIP"})
    P.Pipeline(store2, ledger2, Env(), now=NOW, offline_items=eu).run()
    assert store2.read("Outreach Queue")[0]["Status"] == "SKIPPED"
    store3, ledger3 = make(tmp_path / "allow", extra={"PROTECTED_REGIONS_POLICY": "ALLOW"})
    P.Pipeline(store3, ledger3, Env(), now=NOW, offline_items=eu).run()
    assert store3.read("Outreach Queue")[0]["Status"] == "READY"


def test_free_sources_keep_only_editing_roles(monkeypatch):
    from lead_engine import free_sources as F

    class R:
        def __init__(self, j):
            self._j = j

        def json(self):
            return self._j

        def raise_for_status(self):
            pass

    data = {"remoteok": [{"legal": "x"}, {"id": 1, "position": "Freelance Video Editor", "company": "Glow", "date": NOW.isoformat(), "url": "https://remoteok.com/1", "description": "Part-time reels"},
                         {"id": 2, "position": "Backend Engineer", "company": "X", "date": NOW.isoformat(), "url": "https://remoteok.com/2"}],
            "arbeitnow": {"data": [{"slug": "motion-1", "title": "Motion Designer (Freelance)", "company_name": "Studio", "url": "https://arbeitnow.com/m1", "created_at": int(NOW.timestamp()), "job_types": ["freelance"]}]}}

    class H:
        def get(self, url, **k):
            return R(data["remoteok"] if "remoteok" in url else data["arbeitnow"])

    monkeypatch.setattr(F, "http", lambda: H())
    ro, an = F.remoteok(), F.arbeitnow()
    assert [o.title for o in ro] == ["Freelance Video Editor"] and ro[0].key == "remoteok:1"
    assert an[0].company == "Studio" and an[0].posted_at is not None


def test_disposable_domains_fail_verification(monkeypatch):
    import lead_engine.research as RR

    import importlib

    real = importlib.reload(RR)  # undo the fixture's stub
    real._mx_cache.update({"tempbox.io": True, "brand.in": True})
    monkeypatch.setattr(real, "is_disposable", lambda d: d == "tempbox.io")
    assert real.verify_email("x@tempbox.io") == "INVALID" and real.verify_email("hi@brand.in") == "MX_OK"
