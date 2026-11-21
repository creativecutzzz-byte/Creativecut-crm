"""Apify API client: start an Actor run, persist its IDs, poll, fetch dataset.

Every run's ID and dataset ID are handed to `on_started` immediately so the
caller can write them to the Run Log before polling. If polling or fetching
fails, `resume()` continues with the same run ID instead of starting a new
(paid) run.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

from .util import http, with_retries

API = "https://api.apify.com/v2"
TERMINAL = {"SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"}


class ApifyError(RuntimeError):
    pass


@dataclass
class RunResult:
    run_id: str
    dataset_id: str
    status: str
    cost_usd: float | None
    items: list[dict]
    status_message: str = ""


class Apify:
    def __init__(self, token: str = ""):
        # Inside the managed sandbox the proxy injects credentials; in Cloud Run
        # APIFY_TOKEN comes from Secret Manager.
        self.headers = {"Authorization": f"Bearer {token or 'proxy-injected'}"}

    def _req(self, method: str, path: str, **kw):
        def go():
            r = http().request(method, API + path, headers=self.headers, timeout=60, **kw)
            if r.status_code >= 500 or r.status_code == 429:
                r.raise_for_status()
            return r

        r = with_retries(go)
        if r.status_code >= 400:
            try:
                err = r.json().get("error", {})
            except ValueError:
                err = {"message": r.text[:300]}
            raise ApifyError(f"{err.get('type', r.status_code)}: {err.get('message', '')}")
        return r.json()

    def monthly_usage(self) -> tuple[float, float]:
        d = self._req("GET", "/users/me/limits")["data"]
        return float(d["current"].get("monthlyUsageUsd", 0)), float(d["limits"].get("maxMonthlyUsageUsd", 0))

    def start(self, actor_id: str, run_input: dict, max_charge_usd: float, memory_mb: int | None = None) -> dict:
        params = {"maxTotalChargeUsd": f"{max_charge_usd:.2f}"}
        if memory_mb:
            params["memory"] = str(memory_mb)
        try:
            return self._req("POST", f"/acts/{actor_id.replace('/', '~')}/runs", params=params, json=run_input)["data"]
        except ApifyError as e:
            m = re.search(r"minimum of \$([\d.]+)", str(e))
            if "below-minimum" in str(e) and m:
                # The Actor enforces a minimum cap. Real spend stays bounded by
                # the input size the caller computed from the price table.
                params["maxTotalChargeUsd"] = m.group(1)
                return self._req("POST", f"/acts/{actor_id.replace('/', '~')}/runs", params=params, json=run_input)["data"]
            raise

    def wait(self, run_id: str, timeout_s: int = 900, poll_s: int = 10) -> dict:
        deadline = time.time() + timeout_s
        while True:
            d = self._req("GET", f"/actor-runs/{run_id}")["data"]
            if d["status"] in TERMINAL:
                return d
            if time.time() > deadline:
                raise ApifyError(f"run {run_id} still {d['status']} after {timeout_s}s")
            time.sleep(poll_s)

    def items(self, dataset_id: str, limit: int = 1000) -> list[dict]:
        return self._req("GET", f"/datasets/{dataset_id}/items", params={"clean": "1", "limit": str(limit)})

    def resume(self, run_id: str, timeout_s: int = 900) -> RunResult:
        d = self.wait(run_id, timeout_s)
        items = self.items(d["defaultDatasetId"]) if d["status"] in {"SUCCEEDED", "ABORTED", "TIMED-OUT"} else []
        return RunResult(run_id, d["defaultDatasetId"], d["status"], d.get("usageTotalUsd"), items, d.get("statusMessage") or "")

    def run(self, actor_id: str, run_input: dict, max_charge_usd: float, on_started=None, timeout_s: int = 900) -> RunResult:
        started = self.start(actor_id, run_input, max_charge_usd)
        if on_started:
            on_started(started["id"], started["defaultDatasetId"])
        last_err = None
        for _ in range(3):  # reuse the same run ID if polling/fetching fails
            try:
                return self.resume(started["id"], timeout_s)
            except Exception as e:  # noqa: BLE001
                last_err = e
                time.sleep(15)
        raise ApifyError(f"run {started['id']} could not be fetched: {last_err}")
