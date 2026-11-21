"""Keep Cloud Scheduler in sync with the Settings tab (single source of truth).

RUN_TIME_1 / RUN_TIME_2 / TIMEZONE in the Sheet are pushed to two Cloud
Scheduler jobs that execute the Cloud Run Job. After every change the jobs
are read back and compared, so a change is only reported as applied when the
deployed scheduler actually holds it.
"""

from __future__ import annotations

import re

from .config import Env, Settings

API = "https://cloudscheduler.googleapis.com/v1"


def cron_for(hhmm: str) -> str:
    # Accept "09:00", "9:00" and "9:00:00" (how Sheets formats a time cell).
    m = re.fullmatch(r"\s*([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?\s*", str(hhmm or ""))
    if not m:
        raise ValueError(f"invalid run time '{hhmm}', use HH:MM")
    return f"{int(m.group(2))} {int(m.group(1))} * * *"


def desired_jobs(settings: Settings, env: Env) -> dict[str, dict]:
    tz = settings.get("TIMEZONE", "Asia/Kolkata") or "Asia/Kolkata"
    run_uri = f"https://run.googleapis.com/v2/projects/{env.gcp_project}/locations/{env.gcp_region}/jobs/{env.cloud_run_job}:run"
    out = {}
    for i, key in enumerate(("RUN_TIME_1", "RUN_TIME_2"), start=1):
        name = f"projects/{env.gcp_project}/locations/{env.gcp_region}/jobs/{env.scheduler_job_prefix}-run-{i}"
        out[name] = {
            "name": name,
            "description": f"Creative Cut lead engine run {i} ({settings.get(key)} {tz}). Managed from the Sheet Settings tab.",
            "schedule": cron_for(settings.get(key, "")),
            "timeZone": tz,
            "httpTarget": {
                "uri": run_uri,
                "httpMethod": "POST",
                "oauthToken": {"serviceAccountEmail": env.scheduler_sa, "scope": "https://www.googleapis.com/auth/cloud-platform"},
            },
        }
    return out


def sync(settings: Settings, env: Env, session=None) -> list[str]:
    """Create/patch both jobs, then verify by reading them back. Returns report lines."""
    if not env.gcp_project or not env.scheduler_sa:
        return ["schedule sync skipped: GOOGLE_CLOUD_PROJECT / SCHEDULER_SERVICE_ACCOUNT not set"]
    if session is None:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        session = AuthorizedSession(creds)
    report = []
    for name, job in desired_jobs(settings, env).items():
        cur = session.get(f"{API}/{name}", timeout=30)
        if cur.status_code == 404:
            parent = name.rsplit("/jobs/", 1)[0]
            r = session.post(f"{API}/{parent}/jobs", json=job, timeout=30)
            action = "created"
        else:
            cur.raise_for_status()
            c = cur.json()
            if c.get("schedule") == job["schedule"] and c.get("timeZone") == job["timeZone"] and c.get("httpTarget", {}).get("uri") == job["httpTarget"]["uri"]:
                report.append(f"{name.rsplit('/', 1)[1]}: unchanged ({job['schedule']} {job['timeZone']})")
                continue
            r = session.patch(f"{API}/{name}", params={"updateMask": "schedule,timeZone,description,httpTarget"}, json=job, timeout=30)
            action = "updated"
        r.raise_for_status()
        back = session.get(f"{API}/{name}", timeout=30).json()
        ok = back.get("schedule") == job["schedule"] and back.get("timeZone") == job["timeZone"]
        report.append(f"{name.rsplit('/', 1)[1]}: {action} -> {back.get('schedule')} {back.get('timeZone')} [{'VERIFIED' if ok else 'MISMATCH'}]")
        if not ok:
            raise RuntimeError(f"scheduler verification failed for {name}: {back}")
    return report
