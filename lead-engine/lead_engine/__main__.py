"""CLI: python -m lead_engine <command>

Commands
  run              one full run (Cloud Run Job entrypoint)
  init-sheet       add tabs, headers, dropdowns, filters and dashboard to LEADS_SHEET_ID
  sync-schedule    push RUN_TIME_1/2 from Settings to Cloud Scheduler and verify
  selftest-gmail   send one rendered preview to Settings → TEST_RECIPIENT
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys

from .config import Env
from .gmail import Gmail, GmailError, build_mime
from .ledger import GcsLedger, LocalLedger
from .pipeline import Pipeline
from .sheets import GoogleSheetStore, LocalStore


def make_store(env: Env):
    if env.local_sheet_path:
        return LocalStore(env.local_sheet_path)
    if not env.sheet_id:
        sys.exit("LEADS_SHEET_ID (or LOCAL_SHEET_PATH) is required")
    return GoogleSheetStore(env.sheet_id)


def make_ledger(env: Env):
    return GcsLedger(env.ledger_bucket) if env.ledger_bucket else LocalLedger(env.ledger_dir)


def make_gmail(env: Env):
    try:
        return Gmail(env.gmail_client_id, env.gmail_client_secret, env.gmail_refresh_token)
    except GmailError as e:
        logging.warning("%s — running without Gmail (DRY_RUN, no tracking)", e)
        return None


def main(argv=None):
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    p = argparse.ArgumentParser(prog="lead_engine")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--trigger", default=os.getenv("RUN_TRIGGER", "scheduler"))
    r.add_argument("--replay", help="JSON file {source: [dataset items]} to replay instead of starting Actor runs")
    sub.add_parser("init-sheet")
    sub.add_parser("sync-schedule")
    st = sub.add_parser("selftest-gmail")
    st.add_argument("--attempt", help="Outreach Queue Attempt ID to send as the preview (default: first READY/NEEDS_REVIEW row)")
    a = p.parse_args(argv)
    env = Env()

    if a.cmd == "run":
        offline = json.load(open(a.replay)) if a.replay else None
        from .senders import load_senders

        store = make_store(env)
        senders = load_senders(store.settings(), env)
        stats = Pipeline(store, make_ledger(env), env, trigger=a.trigger, offline_items=offline, senders=senders).run()
        print(json.dumps(stats.__dict__, indent=1, default=str))
        return 0

    if a.cmd == "init-sheet":
        from .layout import layout_requests, rename_first_sheet

        store = GoogleSheetStore(env.sheet_id)
        resp = store.s.post(f"https://sheets.googleapis.com/v4/spreadsheets/{env.sheet_id}:batchUpdate", json={"requests": [rename_first_sheet()] + layout_requests()}, timeout=60)
        resp.raise_for_status()
        print("sheet initialised")
        return 0

    if a.cmd == "sync-schedule":
        from .scheduler import sync

        for line in sync(make_store(env).settings(), env):
            print(line)
        return 0

    if a.cmd == "selftest-gmail":
        store = make_store(env)
        s = store.settings()
        from .senders import load_senders

        slots = [x for x in load_senders(s, env) if x.gmail is not None]
        gm = slots[0].gmail if slots else make_gmail(env)
        if not gm:
            sys.exit("Gmail OAuth is not configured")
        rows = [q for q in store.read("Outreach Queue") if (not a.attempt or q["Attempt ID"] == a.attempt) and q.get("Status") in ("READY", "NEEDS_REVIEW", "DRAFT", "AWAITING_APPROVAL", "APPROVED")]
        if not rows:
            sys.exit("no draft to preview")
        q = rows[0]
        html = Pipeline._html_from_preview(q)
        raw, rfc = build_mime(slots[0].email if slots else s["SENDER_EMAIL"], s.get("SENDER_NAME", "Hemant, Creative Cut"), s["TEST_RECIPIENT"], f"[SELF-TEST] {q['Subject']}",
                              q["Email Preview"], html, f"SELFTEST-{q['Attempt ID']}")
        res = gm.send(raw)
        found = gm.find_sent(rfc)
        print(json.dumps({"sent_to": s["TEST_RECIPIENT"], "gmail_id": res["id"], "thread_id": res["threadId"], "reconciled_in_sent": bool(found)}))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
