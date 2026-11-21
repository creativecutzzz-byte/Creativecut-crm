"""Keep Cloud Scheduler in sync with the schedule in the Settings tab.

The app's Schedule page writes SCHEDULE_TIMES / SCHEDULE_DAYS / SCHEDULE_ONE_TIME
/ SCHEDULE_PAUSED (and syncs Cloud Scheduler itself when it can). Every run
also re-applies them here and reads the jobs back, so a change is only
reported as applied when the deployed scheduler actually holds it.
Mirrors cronJobs() in src/lib/agent/schedule.ts.
"""

from __future__ import annotations

import re
from datetime import datetime

from .config import Env, Settings

API = "https://cloudscheduler.googleapis.com/v1"
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DOW = {"Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6}


def parse_time(t: str) -> tuple[int, int] | None:
    m = re.fullmatch(r"\s*([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?\s*", str(t or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None


def cron_for(hhmm: str) -> str:
    p = parse_time(hhmm)
    if not p:
        raise ValueError(f"invalid run time '{hhmm}', use HH:MM")
    return f"{p[1]} {p[0]} * * *"


def schedule_from(s: Settings) -> dict:
    times_raw = s.get("SCHEDULE_TIMES") or ",".join(x for x in (s.get("RUN_TIME_1", ""), s.get("RUN_TIME_2", "")) if x)
    times = sorted({f"{p[0]:02d}:{p[1]:02d}" for p in (parse_time(t) for t in str(times_raw).split(",")) if p})
    days = [d for d in WEEKDAYS if d in str(s.get("SCHEDULE_DAYS") or ",".join(WEEKDAYS)).split(",")]
    return {"times": times, "days": days, "one_time": str(s.get("SCHEDULE_ONE_TIME") or "").strip(), "paused": s.flag("SCHEDULE_PAUSED"),
            "timezone": s.get("TIMEZONE") or "Asia/Kolkata"}


def cron_jobs(sched: dict) -> list[tuple[str, str]]:
    dows = ",".join(str(DOW[d]) for d in sched["days"])
    jobs = [(f"t{t.replace(':', '')}", f"{int(t[3:])} {int(t[:2])} * * {'*' if len(sched['days']) == 7 else dows}") for t in sched["times"] if sched["days"]]
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})", sched["one_time"])
    if m:
        jobs.append(("once", f"{int(m.group(5))} {int(m.group(4))} {int(m.group(3))} {int(m.group(2))} *"))
    return jobs


def one_time_passed(sched: dict, now_ist: datetime) -> bool:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})", sched["one_time"])
    if not m:
        return False
    when = now_ist.replace(year=int(m.group(1)), month=int(m.group(2)), day=int(m.group(3)), hour=int(m.group(4)), minute=int(m.group(5)), second=0, microsecond=0)
    return when <= now_ist


def sync(settings: Settings, env: Env, session=None) -> list[str]:
    """Create/patch/delete jobs to match the schedule, then verify by reading them back."""
    if not env.gcp_project or not env.scheduler_sa:
        return ["schedule sync skipped: GOOGLE_CLOUD_PROJECT / SCHEDULER_SERVICE_ACCOUNT not set"]
    if session is None:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        session = AuthorizedSession(creds)
    sched = schedule_from(settings)
    parent = f"projects/{env.gcp_project}/locations/{env.gcp_region}"
    run_uri = f"https://run.googleapis.com/v2/{parent}/jobs/{env.cloud_run_job}:run"
    want = {f"{parent}/jobs/{env.scheduler_job_prefix}-{jid}": cron for jid, cron in cron_jobs(sched)}
    listing = session.get(f"{API}/{parent}/jobs", params={"pageSize": "100"}, timeout=30)
    listing.raise_for_status()
    existing = {j["name"]: j for j in listing.json().get("jobs", []) if j["name"].rsplit("/", 1)[1].startswith(f"{env.scheduler_job_prefix}-")}
    report = []
    for name in existing:
        if name not in want:
            session.delete(f"{API}/{name}", timeout=30).raise_for_status()
            report.append(f"{name.rsplit('/', 1)[1]}: removed")
    target = {"uri": run_uri, "httpMethod": "POST", "oauthToken": {"serviceAccountEmail": env.scheduler_sa, "scope": "https://www.googleapis.com/auth/cloud-platform"}}
    want_state = "PAUSED" if sched["paused"] else "ENABLED"
    for name, cron in want.items():
        job = {"name": name, "schedule": cron, "timeZone": sched["timezone"], "httpTarget": target,
               "description": "Creative Cut Lead Agent: Start research (managed from the agent's Schedule page)"}
        cur = existing.get(name)
        if cur is None:
            r = session.post(f"{API}/{parent}/jobs", json=job, timeout=30)
            action = "created"
        elif cur.get("schedule") == cron and cur.get("timeZone") == sched["timezone"] and cur.get("httpTarget", {}).get("uri") == run_uri and cur.get("state") == want_state:
            report.append(f"{name.rsplit('/', 1)[1]}: unchanged ({cron} {sched['timezone']} {want_state})")
            continue
        else:
            r = session.patch(f"{API}/{name}", params={"updateMask": "schedule,timeZone,description,httpTarget"}, json=job, timeout=30)
            action = "updated"
        r.raise_for_status()
        session.post(f"{API}/{name}:{'pause' if sched['paused'] else 'resume'}", json={}, timeout=30).raise_for_status()
        back = session.get(f"{API}/{name}", timeout=30).json()
        ok = back.get("schedule") == cron and back.get("timeZone") == sched["timezone"] and back.get("state", want_state) == want_state
        report.append(f"{name.rsplit('/', 1)[1]}: {action} -> {back.get('schedule')} {back.get('timeZone')} {back.get('state', '')} [{'VERIFIED' if ok else 'MISMATCH'}]")
        if not ok:
            raise RuntimeError(f"scheduler verification failed for {name}: {back}")
    return report
