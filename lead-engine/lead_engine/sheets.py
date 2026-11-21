"""Google Sheet storage with upsert that preserves manual edits.

Rules:
- Rows are keyed (Leads: "Lead ID", Outreach Queue: "Attempt ID").
- Columns in MANUAL_COLUMNS are never overwritten once they hold a value.
- Status edits by a human are detected with the hidden "System Status"
  column: if Status != System Status, a person changed it, and the worker
  keeps (and obeys) the human value.
"""

from __future__ import annotations

import json
import os
from typing import Iterable

from .config import MANUAL_COLUMNS, TABS, Settings
from .util import with_retries

SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"


def col_letter(n: int) -> str:
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def human_edited_status(row: dict) -> bool:
    return bool(row.get("System Status")) and row.get("Status", "") != row.get("System Status", "")


def merge_row(tab: str, existing: dict | None, new: dict) -> dict:
    if not existing:
        out = dict(new)
        if "Status" in out:
            out["System Status"] = out.get("Status", "")
        return out
    out = dict(existing)
    manual = MANUAL_COLUMNS.get(tab, set())
    for k, v in new.items():
        if k in ("Status", "System Status"):
            continue
        if k in manual and str(existing.get(k, "")).strip():
            continue
        if v in (None, "") and str(existing.get(k, "")).strip():
            continue  # never blank out data we had
        out[k] = v
    if "Status" in new:
        if human_edited_status(existing):
            pass  # keep the human's Status and the old System Status
        else:
            out["Status"] = new["Status"]
            out["System Status"] = new["Status"]
    return out


class BaseStore:
    def read(self, tab: str) -> list[dict]:
        raise NotImplementedError

    def write_rows(self, tab: str, rows: list[dict], key: str) -> None:
        raise NotImplementedError

    def append(self, tab: str, rows: Iterable[dict]) -> None:
        raise NotImplementedError

    # ------------------------------------------------------------ helpers
    def settings(self) -> Settings:
        s = Settings.defaults()
        for r in self.read("Settings"):
            if r.get("Key"):
                s[r["Key"]] = r.get("Value", "")
        return s

    def upsert(self, tab: str, key: str, rows: list[dict]) -> list[dict]:
        existing = {r.get(key): r for r in self.read(tab) if r.get(key)}
        merged = [merge_row(tab, existing.get(r[key]), r) for r in rows]
        self.write_rows(tab, merged, key)
        return merged


class LocalStore(BaseStore):
    """JSON-file store with the same tab/column layout (tests, local dry runs, export)."""

    def __init__(self, path: str):
        self.path = path
        self.data: dict[str, list[dict]] = {t: [] for t in TABS}
        if os.path.exists(path):
            with open(path) as fh:
                self.data.update(json.load(fh))

    def save(self):
        os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
        with open(self.path, "w") as fh:
            json.dump(self.data, fh, indent=1, default=str)

    def read(self, tab):
        return [dict(r) for r in self.data.get(tab, [])]

    def write_rows(self, tab, rows, key):
        idx = {r.get(key): i for i, r in enumerate(self.data[tab])}
        for r in rows:
            if r.get(key) in idx:
                self.data[tab][idx[r[key]]] = r
            else:
                self.data[tab].append(r)
        self.save()

    def append(self, tab, rows):
        self.data[tab].extend(rows)
        self.save()

    def as_values(self, tab: str) -> list[list]:
        hdr = TABS[tab]
        return [hdr] + [[str(r.get(h, "")) for h in hdr] for r in self.data.get(tab, [])]


class GoogleSheetStore(BaseStore):
    """Sheets API v4 via Application Default Credentials (Cloud Run service account)."""

    def __init__(self, sheet_id: str, session=None):
        self.sheet_id = sheet_id
        if session is None:
            import google.auth
            from google.auth.transport.requests import AuthorizedSession

            creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/spreadsheets"])
            session = AuthorizedSession(creds)
        self.s = session
        self._cache: dict[str, tuple[list[str], list[dict]]] = {}

    def _get(self, rng: str) -> list[list]:
        r = with_retries(lambda: self.s.get(f"{SHEETS_API}/{self.sheet_id}/values/{rng}", params={"valueRenderOption": "FORMATTED_VALUE"}, timeout=60))
        r.raise_for_status()
        return r.json().get("values", [])

    def read(self, tab):
        vals = self._get(f"'{tab}'!A1:AZ")
        if not vals:
            self._cache[tab] = (TABS[tab], [])
            return []
        hdr = vals[0]
        rows = [{h: (row[i] if i < len(row) else "") for i, h in enumerate(hdr)} for row in vals[1:]]
        for i, r in enumerate(rows):
            r["_row"] = i + 2
        self._cache[tab] = (hdr, rows)
        return [dict(r) for r in rows]

    def write_rows(self, tab, rows, key):
        hdr, current = self._cache.get(tab) or (None, None)
        if hdr is None:
            self.read(tab)
            hdr, current = self._cache[tab]
        pos = {r.get(key): r["_row"] for r in current if r.get(key)}
        updates, appends = [], []
        for r in rows:
            values = [str(r.get(h, "")) for h in hdr]
            if r.get(key) in pos:
                n = pos[r[key]]
                updates.append({"range": f"'{tab}'!A{n}:{col_letter(len(hdr) - 1)}{n}", "values": [values]})
            else:
                appends.append(values)
        if updates:
            for i in range(0, len(updates), 200):
                body = {"valueInputOption": "RAW", "data": updates[i : i + 200]}
                r = with_retries(lambda: self.s.post(f"{SHEETS_API}/{self.sheet_id}/values:batchUpdate", json=body, timeout=60))
                r.raise_for_status()
        if appends:
            self._append_values(tab, appends)
        self._cache.pop(tab, None)

    def _append_values(self, tab, values):
        r = with_retries(lambda: self.s.post(
            f"{SHEETS_API}/{self.sheet_id}/values/'{tab}'!A1:append",
            params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
            json={"values": values}, timeout=60,
        ))
        r.raise_for_status()

    def append(self, tab, rows):
        hdr = self._cache.get(tab, (None,))[0] or TABS[tab]
        self._append_values(tab, [[str(r.get(h, "")) for h in hdr] for r in rows])
        self._cache.pop(tab, None)
