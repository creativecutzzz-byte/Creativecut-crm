"""Secrets: environment variable first, then Google Secret Manager (ADC).

The app stores keys pasted in Settings → Connections, and Gmail tokens from
Google sign-in, in Secret Manager. The worker reads them at the start of each
run, so a new key takes effect on the next run without redeploying.
"""

from __future__ import annotations

import base64
import os

from .util import with_retries

_cache: dict[str, str | None] = {}


def get_secret(name: str, project: str = "") -> str:
    if os.getenv(name):
        return os.environ[name]
    if name in _cache:
        return _cache[name] or ""
    value = None
    if project:
        try:
            import google.auth
            from google.auth.transport.requests import AuthorizedSession

            creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            s = AuthorizedSession(creds)
            r = with_retries(lambda: s.get(f"https://secretmanager.googleapis.com/v1/projects/{project}/secrets/{name}/versions/latest:access", timeout=20))
            if r.status_code == 200:
                value = base64.b64decode(r.json()["payload"]["data"]).decode()
        except Exception:  # noqa: BLE001  missing secret == not connected
            value = None
    _cache[name] = value
    return value or ""
