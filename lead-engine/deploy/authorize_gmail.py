"""One-time: authorise the Creative Cut Gmail inbox and store the refresh token.

Run on your own computer (it opens a browser):

    python deploy/authorize_gmail.py --client-id ... --client-secret ... [--project PROJECT]

Scopes requested: gmail.send + gmail.metadata (minimum for sending and
tracking replies/bounces/opt-outs). With --project, the token is written
straight to Secret Manager as GMAIL_OAUTH_REFRESH_TOKEN and never printed.
"""

from __future__ import annotations

import argparse
import http.server
import secrets
import subprocess
import threading
import urllib.parse
import webbrowser

import requests

SCOPES = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.metadata"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--client-id", required=True)
    ap.add_argument("--client-secret", required=True)
    ap.add_argument("--project", help="GCP project: store the token in Secret Manager")
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    redirect = f"http://127.0.0.1:{a.port}/"
    state = secrets.token_urlsafe(16)
    got: dict = {}
    done = threading.Event()

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(self.path).query))
            got.update(q)
            done.set()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Creative Cut Gmail connected. You can close this tab.")

        def log_message(self, *args):
            pass

    srv = http.server.HTTPServer(("127.0.0.1", a.port), H)
    threading.Thread(target=srv.handle_request, daemon=True).start()
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": a.client_id, "redirect_uri": redirect, "response_type": "code", "scope": SCOPES,
        "access_type": "offline", "prompt": "consent", "state": state, "login_hint": "creativecutzzz@gmail.com"})
    print("Opening browser for consent… If it does not open, visit:\n", url)
    webbrowser.open(url)
    done.wait(timeout=600)
    if got.get("state") != state or "code" not in got:
        raise SystemExit(f"authorisation failed: {got.get('error')}")
    tok = requests.post("https://oauth2.googleapis.com/token", data={
        "code": got["code"], "client_id": a.client_id, "client_secret": a.client_secret,
        "redirect_uri": redirect, "grant_type": "authorization_code"}, timeout=30).json()
    rt = tok.get("refresh_token")
    if not rt:
        raise SystemExit(f"no refresh token returned: {tok}")
    if a.project:
        for name, val in (("GMAIL_OAUTH_REFRESH_TOKEN", rt), ("GMAIL_OAUTH_CLIENT_ID", a.client_id), ("GMAIL_OAUTH_CLIENT_SECRET", a.client_secret)):
            subprocess.run(["gcloud", "secrets", "create", name, "--project", a.project, "--replication-policy", "automatic"], capture_output=True)
            subprocess.run(["gcloud", "secrets", "versions", "add", name, "--project", a.project, "--data-file=-"], input=val.encode(), check=True)
        print("Stored GMAIL_OAUTH_* in Secret Manager. Granted scopes:", tok.get("scope"))
    else:
        print("Refresh token obtained. Store it in your secret manager as GMAIL_OAUTH_REFRESH_TOKEN (not printed).")
        with open(".gmail_refresh_token", "w") as fh:
            fh.write(rt)
        print("Saved to ./.gmail_refresh_token — move it into Secret Manager and delete the file.")


if __name__ == "__main__":
    main()
