"""One scheduled run: track -> discover -> qualify -> research -> personalise -> send."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import timedelta

from . import research as R
from .apify import Apify, ApifyError
from .compose import check_rendered, choose_variation, compose
from .config import Env, Settings
from .facts import extract_facts
from .gmail import Gmail, GmailError, GmailTimeout, build_mime
from .ledger import Ledger, attempt_id
from .qualify import assess
from .samples import load_bank, pick_sample, verify_playable
from .sheets import BaseStore, human_edited_status
from .sources import SPECS, Opportunity, build_input, normalize, reddit_urls_from
from .util import IST, canonical_url, domain_of, http, iso, now_utc, short_hash

log = logging.getLogger("lead_engine")
SEND_TERMINAL = {"SENT", "REPLIED", "BOUNCED", "OPTED_OUT"}
INTERMEDIARY = re.compile(r"(our\s+client|on\s+behalf\s+of|for\s+an?\s+[\w-]+[- ]based\s+(company|client|brand|agency)|for\s+a\s+boutique|client\s+of\s+ours|staffing\s+partner)", re.I)


@dataclass
class RunStats:
    found: int = 0
    qualified: int = 0
    ready: int = 0
    sent: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    cost: float = 0.0
    notes: list[str] = field(default_factory=list)


def lead_id_for(key: str) -> str:
    return f"L-{short_hash(key, n=10)}"


class Pipeline:
    def __init__(self, store: BaseStore, ledger: Ledger, env: Env, apify: Apify | None = None, gmail: Gmail | None = None,
                 trigger: str = "manual", now=None, offline_items: dict[str, list[dict]] | None = None):
        self.store, self.ledger, self.env = store, ledger, env
        self.apify = apify or Apify(env.apify_token)
        self.gmail = gmail
        self.trigger = trigger
        self.now = now or now_utc()
        self.offline = offline_items  # {source: [dataset items]} to replay datasets without paying again
        self.run_id = f"R-{self.now.astimezone(IST):%Y%m%d-%H%M}-{short_hash(str(self.now.timestamp()), n=4)}"
        self.stats = RunStats()
        self.settings: Settings = Settings.defaults()
        self._url_ok: dict[str, bool] = {}

    # ------------------------------------------------------------------ main
    def run(self) -> RunStats:
        self.settings = self.store.settings()
        live = self.settings.flag("SENDING_ENABLED") and self.gmail is not None
        self.mode = "LIVE" if live else "DRY_RUN"
        if not self.ledger.acquire_lock("run", ttl_s=3 * 3600):
            self._log_summary("SKIPPED", "another run holds the lock; nothing done")
            return self.stats
        started = iso(self.now)
        try:
            if self.gmail:
                self._safe(self.track, "tracking")
            opps = self._safe(self.discover, "discovery") or []
            self._safe(lambda: self.process(opps), "processing")
            if live:
                self._safe(self.send_ready, "sending")
            else:
                self.stats.notes.append(f"DRY_RUN: {self.stats.ready} READY email(s) not sent")
            if self.env.gcp_project and self.offline is None:
                from .scheduler import sync
                report = self._safe(lambda: sync(self.settings, self.env), "schedule sync")
                if report:
                    self.stats.notes.append("schedule: " + "; ".join(report))
        finally:
            self.ledger.release_lock("run")
            self._log_summary("SUCCEEDED" if not self.stats.errors else "COMPLETED_WITH_ERRORS", "; ".join(self.stats.notes), started)
        return self.stats

    def _safe(self, fn, label):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001  log and continue with independent work
            log.exception("%s failed", label)
            self.stats.errors.append(f"{label}: {e}")
            return None

    # -------------------------------------------------------------- tracking
    def track(self):
        sender = self.settings.get("SENDER_EMAIL", "")
        rows = self.store.read("Outreach Queue")
        updates, supp = [], []
        for r in rows:
            if r.get("Status") not in ("SENT", "REPLIED") or not r.get("Gmail Thread ID"):
                continue
            try:
                state, detail = self.gmail.classify_thread(r["Gmail Thread ID"], sender)
            except Exception as e:  # noqa: BLE001
                self.stats.errors.append(f"track {r['Attempt ID']}: {e}")
                continue
            if state != r.get("Status") and state != "SENT":
                updates.append({**r, "Status": state, "Last Error": detail if state == "BOUNCED" else r.get("Last Error", "")})
                if state in ("BOUNCED", "OPTED_OUT"):
                    supp.append({"Value": r["Recipient"].lower(), "Type": "HARD_BOUNCE" if state == "BOUNCED" else "OPT_OUT",
                                 "Company": "", "Reason": detail[:150], "Source": f"Gmail thread {r['Gmail Thread ID']}", "Added At": iso(self.now), "Added By": "worker"})
                rec = self.ledger.get(r["Attempt ID"]) or {}
                self.ledger.put(r["Attempt ID"], {**rec, "outcome": state})
        if updates:
            for u in updates:
                u.pop("_row", None)
            self.store.upsert("Outreach Queue", "Attempt ID", updates)
            lead_upd = [{"Lead ID": u["Lead ID"], "Status": {"OPTED_OUT": "SKIPPED"}.get(u["Status"], u["Status"]), "Last Checked": iso(self.now)} for u in updates]
            self.store.upsert("Leads", "Lead ID", lead_upd)
        if supp:
            existing = {s.get("Value", "").lower() for s in self.store.read("Suppression")}
            self.store.append("Suppression", [s for s in supp if s["Value"] not in existing])
        self.stats.notes.append(f"tracking: {len(updates)} status change(s)")

    # ------------------------------------------------------------- discovery
    def _budget_ok(self, cap: float) -> bool:
        limit = self.settings.num("MONTHLY_APIFY_BUDGET_USD", 4.5)
        try:
            used, plan = self.apify.monthly_usage()
        except Exception:  # noqa: BLE001
            return True
        if used + cap > min(limit, plan or limit):
            self.stats.notes.append(f"Apify monthly budget guard: used ${used:.2f} of ${limit:.2f}")
            return False
        return True

    def _run_source(self, name: str, window: int, reddit_urls=None) -> list[Opportunity]:
        spec = SPECS[name]
        cap = self.settings.num(f"SOURCE_{name}_MAX_USD", 0.04)
        max_items = int(self.settings.num(f"SOURCE_{name}_MAX_ITEMS", 10))
        run_input, expected = build_input(name, window, max_items, cap, reddit_urls)
        key = f"{self.run_id}/{name}"
        row = {"Run ID": key, "Started": iso(now_utc()), "Trigger": self.trigger, "Mode": self.mode, "Source": spec.label}
        if expected == 0:
            self.store.upsert("Run Log", "Run ID", [{**row, "Apify Status": "SKIPPED", "Notes": "no input (cap or nothing to fetch)"}])
            return []
        if self.offline is not None:
            items = self.offline.get(name, [])
            res_status, run_id, ds, cost = "REPLAYED", "", "", 0.0
        else:
            if not self._budget_ok(cap):
                self.store.upsert("Run Log", "Run ID", [{**row, "Apify Status": "SKIPPED", "Notes": "monthly budget guard"}])
                return []
            def started(rid, did):
                self.store.upsert("Run Log", "Run ID", [{**row, "Apify Run ID": rid, "Dataset ID": did, "Apify Status": "RUNNING"}])
            try:
                res = self.apify.run(spec.actor_id, run_input, cap, on_started=started)
            except ApifyError as e:
                self.stats.errors.append(f"{name}: {e}")
                self.store.upsert("Run Log", "Run ID", [{**row, "Finished": iso(now_utc()), "Apify Status": "FAILED", "Errors": "1", "Notes": str(e)[:300]}])
                return []
            items, res_status, run_id, ds, cost = res.items, res.status, res.run_id, res.dataset_id, res.cost_usd or 0.0
        opps = [o for it in items for o in normalize(name, it)]
        self.stats.cost += cost
        self.store.upsert("Run Log", "Run ID", [{**row, "Finished": iso(now_utc()), "Apify Run ID": run_id, "Dataset ID": ds, "Apify Status": res_status,
                                                  "Rows Found": str(len(opps)), "Cost USD": f"{cost:.4f}",
                                                  "Notes": f"actor {spec.actor_id}; cap ${cap:.2f}; requested {expected}"}])
        return opps

    def resume_pending(self) -> list[Opportunity]:
        """Finish Apify runs a previous execution started but never fetched (same run ID)."""
        out = []
        for r in self.store.read("Run Log"):
            if r.get("Apify Status") == "RUNNING" and r.get("Apify Run ID"):
                name = next((n for n, s in SPECS.items() if s.label == r.get("Source")), None)
                if not name:
                    continue
                try:
                    res = self.apify.resume(r["Apify Run ID"], timeout_s=300)
                except Exception as e:  # noqa: BLE001
                    self.stats.errors.append(f"resume {r['Apify Run ID']}: {e}")
                    continue
                opps = [o for it in res.items for o in normalize(name, it)]
                r.pop("_row", None)
                self.store.upsert("Run Log", "Run ID", [{**r, "Finished": iso(now_utc()), "Apify Status": f"{res.status} (resumed)", "Rows Found": str(len(opps)), "Cost USD": f"{res.cost_usd or 0:.4f}"}])
                out += opps
        return out

    def discover(self) -> list[Opportunity]:
        window = int(self.settings.num("EXTENDED_WINDOW_DAYS", 30))  # fetch once; qualify 14d first, then 30d
        active = self.settings.sources()
        opps = [] if self.offline is not None else self.resume_pending()
        for name in ("linkedin_posts", "linkedin_jobs", "google_hiring"):
            if name in active:
                opps += self._run_source(name, window)
        if "reddit_threads" in active:
            known = {r.get("Opportunity Key") for r in self.store.read("Leads")}
            urls = [u for u in reddit_urls_from(opps) if canonical_url(u) not in known]
            if urls:
                threads = self._run_source("reddit_threads", window, urls)
                got = {canonical_url(t.url) for t in threads}
                opps = [o for o in opps if canonical_url(o.url) not in got] + threads
        return opps

    # ------------------------------------------------------------ processing
    def _url_verified(self, url: str) -> bool:
        if url in self._url_ok:
            return self._url_ok[url]
        if "youtube.com/watch?v=" in url:
            ok = verify_playable(url.split("v=", 1)[1][:11])[0]
        else:
            try:
                ok = http().get(url, timeout=15, allow_redirects=True).status_code == 200
            except Exception:  # noqa: BLE001
                ok = False
        self._url_ok[url] = ok
        return ok

    def process(self, opps: list[Opportunity]):
        win1 = int(self.settings.num("SEARCH_WINDOW_DAYS", 14))
        win2 = int(self.settings.num("EXTENDED_WINDOW_DAYS", 30))
        min_q = int(self.settings.num("MIN_QUALIFIED_BEFORE_EXTEND", 3))
        leads_existing = {r.get("Opportunity Key"): r for r in self.store.read("Leads")}
        by_url = {canonical_url(r.get("Source URL", "")): r for r in leads_existing.values()}
        # 1. de-duplicate: original post ID / canonical URL, within the batch and against the Sheet
        uniq: dict[str, Opportunity] = {}
        for o in opps:
            k = o.key
            if k in uniq or k in leads_existing or canonical_url(o.url) in by_url:
                continue
            uniq[k] = o
        dup = len(opps) - len(uniq)
        self.stats.found += len(opps)
        # 2. qualify (14 days), extend to 30 days only when too few
        assessed = [(o, assess(o, win1, self.now)) for o in uniq.values()]
        keep = [(o, a, ("OPEN (≤%dd)" % win1) if o.posted_at else "UNKNOWN (no post date; check source)") for o, a in assessed if a.qualified]
        # Decide on the 30-day extension from everything fetched this run (known or new),
        # so re-running on the same input makes the same decision (duplicate-run safe).
        seen_keys, fresh_q = set(), 0
        for o in opps:
            if o.key not in seen_keys:
                seen_keys.add(o.key)
                fresh_q += assess(o, win1, self.now).qualified
        if fresh_q < min_q:
            for o, a in assessed:
                if a.qualified or a.reasons_excluded != [f"older than {win1} days"]:
                    continue
                a2 = assess(o, win2, self.now)
                if a2.qualified:
                    state = R.check_open(o.url)
                    keep.append((o, a2, f"{state} (re-checked, {int(a2.age_days or 0)}d old)"))
        self.stats.skipped += len(uniq) - len(keep) + dup
        self.stats.qualified += len(keep)
        self.stats.notes.append(f"{len(opps)} found, {dup} duplicate, {len(keep)} qualified")
        if not keep:
            return
        bank = load_bank(self.settings.get("SAMPLE_SITE") or "https://www.creativecut.in/work")
        lead_rows, queue_rows = [], []
        queue_existing = self.store.read("Outreach Queue")
        suppression = self.store.read("Suppression")
        for o, a, open_state in sorted(keep, key=lambda t: -t[1].score):
            try:
                lr, qr = self._build(o, a, open_state, bank, queue_existing + queue_rows, suppression)
                lead_rows.append(lr)
                if qr:
                    queue_rows.append(qr)
            except Exception as e:  # noqa: BLE001
                self.stats.errors.append(f"lead {o.url}: {e}")
        self.store.upsert("Leads", "Lead ID", lead_rows)
        if queue_rows:
            self.store.upsert("Outreach Queue", "Attempt ID", queue_rows)
        self.stats.ready += sum(1 for q in queue_rows if q["Status"] == "READY")

    def _build(self, o: Opportunity, a, open_state: str, bank, queue_rows, suppression):
        lid = lead_id_for(o.key)
        res = R.research(o)
        email, email_src, verify = "", "", "NOT_FOUND"
        for e, src in res.emails:
            v = R.verify_email(e)
            if v == "MX_OK" and R.is_relevant_business_email(e, src, o.url, res.website):
                email, email_src, verify = e, src, v
                break
            if not email:
                email, email_src, verify = e, src, v
        company = o.company or (domain_of(res.website).split(".")[0].title() if res.website else "")
        contact = o.author_name if not o.author_is_company else ""
        lead_status = "QUALIFIED"
        if open_state.startswith(("CLOSED",)):
            lead_status = "CLOSED"
        elif open_state.startswith("UNKNOWN"):
            lead_status = "NEEDS_REVIEW"
        lead = {
            "Lead ID": lid, "Opportunity Key": o.key, "Status": lead_status, "Company": company, "Contact Name": contact,
            "Market": a.market, "Niche": a.niche, "Website": res.website, "Source": SPECS[o.source].label, "Source URL": o.url,
            "Post Date": o.posted_at.astimezone(IST).strftime("%Y-%m-%d") if o.posted_at else "", "Exact Need": (o.title + " — " if o.title else "") + a.deliverable.replace("_", " "),
            "Post Excerpt": a.excerpt, "Brand Research Notes": " | ".join(res.notes)[:900], "Research Sources": "\n".join(dict.fromkeys(res.sources)),
            "Fit Reason": a.fit_reason, "Fit Score": str(a.score), "Engagement": a.engagement, "Contact Channel": res.channel,
            "Business Email": email, "Email Source": email_src, "Email Verification": verify if email else "NOT_FOUND",
            "Opportunity Open": open_state, "First Seen": iso(self.now), "Last Checked": iso(self.now), "Notes": "",
        }
        if not email or lead_status != "QUALIFIED":
            return lead, None
        # ---- outreach draft
        facts = extract_facts(o, a, self.env.anthropic_key, self.env.anthropic_model)
        variation = choose_variation(a.deliverable, a.niche)
        sample_deliv = "real_estate" if a.niche == "Real estate" and a.deliverable in ("short_form", "talking_head") else a.deliverable
        sample, label, how = pick_sample(bank, sample_deliv, vertical_hint=None)
        mail = compose(facts, variation, sample, label)
        problems = check_rendered(mail, self._url_verified)
        aid = attempt_id(lid, email)
        if INTERMEDIARY.search(f"{o.title} {o.text}"):
            problems.append("posted by a staffing intermediary for an unnamed client; email may not reach the hiring brand")
        status = "READY"
        if problems or facts.confidence == "low" or verify != "MX_OK" or not R.is_relevant_business_email(email, email_src, o.url, res.website):
            status = "NEEDS_REVIEW"
            if verify != "MX_OK":
                problems.append(f"email verification {verify}")
            if facts.confidence == "low":
                problems.append("opener detail could not be sourced confidently")
        # duplicate / suppression checks (recipient, domain, company)
        sup_vals = {s.get("Value", "").lower() for s in suppression}
        if email.lower() in sup_vals or domain_of(email) in sup_vals or (company and company.lower() in sup_vals):
            status, problems = "SKIPPED", ["suppression match"]
        for q in queue_rows:
            if q.get("Attempt ID") == aid:
                continue
            same_rcpt = q.get("Recipient", "").lower() == email.lower()
            if same_rcpt and q.get("Status") in SEND_TERMINAL | {"READY", "SENDING"}:
                status, problems = "SKIPPED", [f"duplicate recipient (already in {q.get('Attempt ID')})"]
                break
        if status == "SKIPPED":
            lead["Status"] = "SKIPPED"
            self.stats.skipped += 1
        else:
            lead["Status"] = "READY" if status == "READY" else "NEEDS_REVIEW"
        queue = {
            "Attempt ID": aid, "Lead ID": lid, "Touch": "FIRST", "Recipient": email, "Subject": mail.subject,
            "Email Preview": mail.text[:1500], "Variation": mail.variation,
            "Sample Title": (sample.caption if sample else ""), "Sample URL": (sample.watch_url if sample else ""),
            "Personalisation Sources": "\n".join(facts.sources + ([f"Sample {sample.video_id} embedded on {sample.page_url}; playable: {how}"] if sample else [])),
            "Status": status, "Planned Send": self._next_slot(), "Sent At": "", "Gmail Message ID": "", "Gmail Thread ID": "",
            "RFC Message-ID": "", "Last Error": "; ".join(problems)[:500], "Notes": "",
        }
        # keep the rendered HTML for the sender (ledger only, not the Sheet)
        self._html = getattr(self, "_html", {})
        self._html[aid] = mail.html
        return lead, queue

    def _next_slot(self) -> str:
        t1 = self.settings.get("RUN_TIME_1", "09:00")
        t2 = self.settings.get("RUN_TIME_2", "16:00")
        local = self.now.astimezone(IST)
        for day in (0, 1):
            for t in (t1, t2):
                h, m = (int(x) for x in t.split(":"))
                slot = (local + timedelta(days=day)).replace(hour=h, minute=m, second=0, microsecond=0)
                if slot > local:
                    return slot.strftime("%Y-%m-%d %H:%M")
        return ""

    # ---------------------------------------------------------------- sending
    def sent_today(self) -> int:
        today = self.now.astimezone(IST).strftime("%Y-%m-%d")
        return sum(1 for r in self.ledger.all() if r.get("touch") == "FIRST" and r.get("status") in ("SENT", "SENDING") and str(r.get("day")) == today)

    def send_ready(self):
        cap = int(self.settings.num("DAILY_SEND_CAP", 10))
        remaining = max(0, cap - self.sent_today())
        sender, name = self.settings.get("SENDER_EMAIL"), self.settings.get("SENDER_NAME", "Hemant, Creative Cut")
        rows = self.store.read("Outreach Queue")
        leads = {r["Lead ID"]: r for r in self.store.read("Leads")}
        sup = {s.get("Value", "").lower() for s in self.store.read("Suppression")}
        sent_rcpts = {r["Recipient"].lower() for r in rows if r.get("Status") in SEND_TERMINAL}
        sent_companies = {leads.get(r["Lead ID"], {}).get("Company", "").lower() for r in rows if r.get("Status") in SEND_TERMINAL} - {""}
        updates = []
        for r in rows:
            if r.get("Status") != "READY" or r.get("Touch") != "FIRST":
                continue
            lead = leads.get(r["Lead ID"], {})
            rcpt = r["Recipient"].lower()
            # eligibility re-checked at send time (a human may have edited the row)
            reason = None
            if lead.get("Status") in ("CLOSED", "SKIPPED", "REPLIED", "BOUNCED") and not human_edited_status(r):
                reason = f"lead status {lead.get('Status')}"
            elif not str(lead.get("Opportunity Open", "")).startswith("OPEN"):
                reason = "opportunity not confirmed open"
            elif lead.get("Email Verification") not in ("MX_OK", "MANUAL_OK"):
                reason = "email not verified"
            elif rcpt in sup or domain_of(rcpt) in sup or lead.get("Company", "").lower() in sup:
                reason = "suppression match"
            elif rcpt in sent_rcpts or (lead.get("Company", "").lower() in sent_companies):
                reason = "already contacted (recipient/company)"
            elif not r.get("Personalisation Sources"):
                reason = "personalisation not sourced"
            if reason:
                updates.append({**r, "Status": "SKIPPED", "Last Error": reason})
                self.stats.skipped += 1
                continue
            if remaining <= 0:
                self.stats.notes.append("daily cap reached")
                break
            outcome = self._send_one(r, sender, name)
            updates.append(outcome)
            if outcome["Status"] == "SENT":
                remaining -= 1
                self.stats.sent += 1
                sent_rcpts.add(rcpt)
                sent_companies.add(lead.get("Company", "").lower())
        for u in updates:
            u.pop("_row", None)
        if updates:
            self.store.upsert("Outreach Queue", "Attempt ID", updates)
            self.store.upsert("Leads", "Lead ID", [{"Lead ID": u["Lead ID"], "Status": u["Status"] if u["Status"] in ("SENT", "SKIPPED", "FAILED") else "READY", "Last Checked": iso(self.now)} for u in updates])

    def _send_one(self, row: dict, sender: str, sender_name: str) -> dict:
        aid = row["Attempt ID"]
        today = self.now.astimezone(IST).strftime("%Y-%m-%d")
        rec = self.ledger.get(aid)
        if rec and rec.get("status") == "SENT":
            return {**row, "Status": "SENT", "Sent At": rec.get("sent_at", ""), "Gmail Message ID": rec.get("gmail_id", ""), "Gmail Thread ID": rec.get("thread_id", ""), "RFC Message-ID": rec.get("rfc_id", "")}
        html_body = getattr(self, "_html", {}).get(aid) or self._html_from_preview(row)
        raw, rfc_id = build_mime(sender, sender_name, row["Recipient"], row["Subject"], row["Email Preview"], html_body, aid)
        if rec and rec.get("status") == "SENDING":
            # A previous run may have submitted it: reconcile before any new send.
            found = self.gmail.find_sent(rec["rfc_id"])
            if found:
                done = {**rec, "status": "SENT", "gmail_id": found["id"], "thread_id": found["threadId"], "sent_at": rec.get("sent_at") or iso(self.now)}
                self.ledger.put(aid, done)
                return {**row, "Status": "SENT", "Sent At": done["sent_at"], "Gmail Message ID": found["id"], "Gmail Thread ID": found["threadId"], "RFC Message-ID": rec["rfc_id"], "Last Error": "reconciled from Sent"}
            raw, rfc_id = build_mime(sender, sender_name, row["Recipient"], row["Subject"], row["Email Preview"], html_body, aid)
            self.ledger.put(aid, {**rec, "rfc_id": rfc_id, "retry_at": iso(self.now)})
        else:
            claimed = self.ledger.claim(aid, {"attempt_id": aid, "lead_id": row["Lead ID"], "recipient": row["Recipient"], "touch": "FIRST",
                                              "status": "SENDING", "rfc_id": rfc_id, "day": today, "run_id": self.run_id, "claimed_at": iso(self.now)})
            if not claimed:
                return {**row, "Last Error": "claimed by another run"}
        try:
            res = self.gmail.send(raw)
        except GmailTimeout as e:
            found = self.gmail.find_sent(rfc_id)
            if found:
                res = found
            else:
                self.stats.errors.append(f"send {aid}: timeout, left SENDING for reconciliation")
                return {**row, "Status": "READY", "Last Error": f"Gmail timeout ({e}); will reconcile against Sent next run"}
        except GmailError as e:
            self.ledger.put(aid, {**(self.ledger.get(aid) or {}), "status": "FAILED", "error": str(e)[:300]})
            self.stats.errors.append(f"send {aid}: {e}")
            return {**row, "Status": "FAILED", "Last Error": str(e)[:300]}
        sent_at = iso(now_utc())
        self.ledger.put(aid, {**(self.ledger.get(aid) or {}), "status": "SENT", "gmail_id": res["id"], "thread_id": res["threadId"], "sent_at": sent_at, "rfc_id": rfc_id})
        return {**row, "Status": "SENT", "Sent At": sent_at, "Gmail Message ID": res["id"], "Gmail Thread ID": res["threadId"], "RFC Message-ID": rfc_id, "Last Error": ""}

    @staticmethod
    def _html_from_preview(row: dict) -> str:
        """Rebuild HTML when the run that drafted the row is not the one sending it."""
        import html as h
        import re

        text = row.get("Email Preview", "")
        paras = []
        for p in text.split("\n\n"):
            p = h.escape(p)
            p = re.sub(r"Watch a similar ([^()]+?) \((https://www\.youtube\.com/watch\?v=[\w-]{11})\)", r'<a href="\2">Watch a similar \1</a>', p)
            p = p.replace("Creative Cut (https://creativecut.in)", '<a href="https://creativecut.in">Creative Cut</a>').replace("\n", "<br>")
            paras.append(f"<p>{p}</p>")
        return "\n".join(paras)

    # ---------------------------------------------------------------- logging
    def _log_summary(self, status: str, notes: str, started: str = ""):
        s = self.stats
        self.store.upsert("Run Log", "Run ID", [{
            "Run ID": self.run_id, "Started": started or iso(self.now), "Finished": iso(now_utc()), "Trigger": self.trigger, "Mode": getattr(self, "mode", "DRY_RUN"),
            "Source": "ALL (summary)", "Apify Status": status, "Rows Found": str(s.found), "Qualified": str(s.qualified), "Ready": str(s.ready),
            "Sent": str(s.sent), "Skipped": str(s.skipped), "Errors": str(len(s.errors)), "Cost USD": f"{s.cost:.4f}",
            "Notes": (notes + (" | errors: " + " / ".join(s.errors) if s.errors else ""))[:1500],
        }])
