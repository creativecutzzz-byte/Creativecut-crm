"""Durable send ledger: one record per outreach attempt.

The attempt ID is deterministic (lead + recipient + touch), so retries and
overlapping runs compute the same ID. `claim()` creates the record only if it
does not exist (GCS `ifGenerationMatch=0`, or O_EXCL locally), so exactly one
run can move an attempt to SENDING. A record left in SENDING (crash or Gmail
timeout after submit) is reconciled against the Sent folder before any new
send is attempted.

A run lock uses the same primitive so two overlapping job executions cannot
both send.
"""

from __future__ import annotations

import json
import os
import time
from urllib.parse import quote

from .util import now_utc, short_hash, with_retries

GCS = "https://storage.googleapis.com"


def attempt_id(lead_id: str, recipient: str, touch: str = "FIRST") -> str:
    return f"A-{short_hash(lead_id, recipient.lower(), touch, n=12)}"


class Ledger:
    def get(self, aid: str) -> dict | None: ...
    def claim(self, aid: str, record: dict) -> bool: ...
    def put(self, aid: str, record: dict) -> None: ...
    def all(self) -> list[dict]: ...
    def acquire_lock(self, name: str, ttl_s: int) -> bool: ...
    def release_lock(self, name: str) -> None: ...


class LocalLedger(Ledger):
    def __init__(self, root: str):
        self.root = root
        os.makedirs(os.path.join(root, "attempts"), exist_ok=True)

    def _p(self, aid):
        return os.path.join(self.root, "attempts", f"{aid}.json")

    def get(self, aid):
        try:
            with open(self._p(aid)) as fh:
                return json.load(fh)
        except FileNotFoundError:
            return None

    def claim(self, aid, record):
        try:
            fd = os.open(self._p(aid), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            return False
        with os.fdopen(fd, "w") as fh:
            json.dump(record, fh)
        return True

    def put(self, aid, record):
        tmp = self._p(aid) + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(record, fh)
        os.replace(tmp, self._p(aid))

    def all(self):
        d = os.path.join(self.root, "attempts")
        out = []
        for f in os.listdir(d):
            if f.endswith(".json"):
                with open(os.path.join(d, f)) as fh:
                    out.append(json.load(fh))
        return out

    def acquire_lock(self, name, ttl_s):
        p = os.path.join(self.root, f"{name}.lock")
        if os.path.exists(p) and time.time() - os.path.getmtime(p) > ttl_s:
            os.remove(p)  # stale lock from a crashed run
        try:
            os.close(os.open(p, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            return True
        except FileExistsError:
            return False

    def release_lock(self, name):
        try:
            os.remove(os.path.join(self.root, f"{name}.lock"))
        except FileNotFoundError:
            pass


class GcsLedger(Ledger):
    def __init__(self, bucket: str, session=None):
        self.bucket = bucket
        if session is None:
            import google.auth
            from google.auth.transport.requests import AuthorizedSession

            creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/devstorage.read_write"])
            session = AuthorizedSession(creds)
        self.s = session

    def _name(self, aid):
        return f"attempts/{aid}.json"

    def _read(self, name):
        r = with_retries(lambda: self.s.get(f"{GCS}/storage/v1/b/{self.bucket}/o/{quote(name, safe='')}", params={"alt": "media"}, timeout=30))
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()

    def _write(self, name, record, if_generation_match: int | None = None):
        params = {"uploadType": "media", "name": name}
        if if_generation_match is not None:
            params["ifGenerationMatch"] = str(if_generation_match)
        r = self.s.post(f"{GCS}/upload/storage/v1/b/{self.bucket}/o", params=params, data=json.dumps(record), headers={"Content-Type": "application/json"}, timeout=30)
        if r.status_code == 412:
            return False
        r.raise_for_status()
        return True

    def get(self, aid):
        return self._read(self._name(aid))

    def claim(self, aid, record):
        return self._write(self._name(aid), record, if_generation_match=0)

    def put(self, aid, record):
        with_retries(lambda: self._write(self._name(aid), record))

    def all(self):
        out, token = [], None
        while True:
            params = {"prefix": "attempts/"}
            if token:
                params["pageToken"] = token
            r = self.s.get(f"{GCS}/storage/v1/b/{self.bucket}/o", params=params, timeout=30)
            r.raise_for_status()
            j = r.json()
            for it in j.get("items", []):
                rec = self._read(it["name"])
                if rec:
                    out.append(rec)
            token = j.get("nextPageToken")
            if not token:
                return out

    def acquire_lock(self, name, ttl_s):
        lock = f"locks/{name}"
        if self._write(lock, {"at": now_utc().isoformat()}, if_generation_match=0):
            return True
        cur = self._read(lock) or {}
        try:
            from datetime import datetime

            age = (now_utc() - datetime.fromisoformat(cur.get("at"))).total_seconds()
        except Exception:  # noqa: BLE001
            age = ttl_s + 1
        if age > ttl_s:
            self.release_lock(name)
            return self._write(lock, {"at": now_utc().isoformat()}, if_generation_match=0)
        return False

    def release_lock(self, name):
        self.s.delete(f"{GCS}/storage/v1/b/{self.bucket}/o/{quote('locks/' + name, safe='')}", timeout=30)
