"""Gmail via user OAuth (the Creative Cut inbox).

Scopes (minimum for the job):
- gmail.send      send first-touch emails and threaded follow-ups
- gmail.metadata  read headers/snippets only: reconcile against Sent by our
                  own Message-ID, and read replies/bounces in our threads.
                  No message bodies, no search queries.
"""

from __future__ import annotations

import base64
import re
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from .util import http, with_retries

SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.metadata"]
API = "https://gmail.googleapis.com/gmail/v1/users/me"
OPT_OUT = re.compile(r"(unsubscribe|remove me|no thanks|not interested|stop (emailing|contacting)|don'?t (email|contact)|do not (email|contact)|take me off)", re.I)
BOUNCE_FROM = re.compile(r"(mailer-daemon|postmaster|mail-daemon|no-reply-daemon|mail delivery (subsystem|system))", re.I)
# Bounce and auto-reply patterns adapted from OpenOutSend (Apache-2.0, github.com/eracle/OpenOutSend,
# openoutsend/emails/classify.py). Order matters: a bounce is auto-submitted and quotes our
# headers, so it is checked first; an out-of-office is not a reply and must not stop anything.
BOUNCE_SUBJECT = re.compile(r"(undeliverable|undelivered|delivery status notification|returned mail|delivery has failed|"
                            r"mail delivery failed|failure notice|delivery incomplete)", re.I)
AUTO_REPLY_SUBJECT = re.compile(r"(out of (the )?office|automatic reply|auto[- ]?reply|autoresponse|abwesenheit|on leave|on vacation)", re.I)


class GmailError(RuntimeError):
    pass


class GmailTimeout(GmailError):
    """The send call may or may not have been accepted. Reconcile before retrying."""


def build_mime(sender: str, sender_name: str, to: str, subject: str, text: str, html: str, attempt: str,
               thread_headers: dict | None = None) -> tuple[str, str]:
    m = EmailMessage()
    msg_id = make_msgid(idstring=attempt.replace("-", ""), domain="creativecut.in")
    m["From"] = formataddr((sender_name, sender))
    m["To"] = to
    m["Subject"] = subject
    m["Message-ID"] = msg_id
    m["X-CC-Attempt"] = attempt
    m["List-Unsubscribe"] = f"<mailto:{sender}?subject=unsubscribe>"
    if thread_headers:
        for k in ("In-Reply-To", "References"):
            if thread_headers.get(k):
                m[k] = thread_headers[k]
    m.set_content(text)
    m.add_alternative(html, subtype="html")
    raw = base64.urlsafe_b64encode(m.as_bytes()).decode()
    return raw, msg_id


class Gmail:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str):
        if not (client_id and client_secret and refresh_token):
            raise GmailError("Gmail OAuth not configured (GMAIL_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN)")
        self.cid, self.csec, self.rt = client_id, client_secret, refresh_token
        self._token = None

    def _auth(self) -> dict:
        if not self._token:
            r = http().post("https://oauth2.googleapis.com/token", data={
                "client_id": self.cid, "client_secret": self.csec, "refresh_token": self.rt, "grant_type": "refresh_token"}, timeout=30)
            if r.status_code != 200:
                raise GmailError(f"OAuth refresh failed: {r.text[:200]}")
            self._token = r.json()["access_token"]
        return {"Authorization": f"Bearer {self._token}"}

    def send(self, raw: str, thread_id: str | None = None, timeout: int = 30) -> dict:
        body = {"raw": raw}
        if thread_id:
            body["threadId"] = thread_id
        try:
            r = http().post(f"{API}/messages/send", json=body, headers=self._auth(), timeout=timeout)
        except Exception as e:  # noqa: BLE001  (timeout / connection reset after submit)
            raise GmailTimeout(str(e)) from e
        if r.status_code >= 500:
            raise GmailTimeout(f"HTTP {r.status_code}")
        if r.status_code >= 400:
            raise GmailError(f"HTTP {r.status_code}: {r.text[:300]}")
        return r.json()  # {id, threadId, labelIds}

    def find_sent(self, rfc_message_id: str, scan: int = 100) -> dict | None:
        """Look for our Message-ID among recent SENT messages (metadata scope)."""
        r = with_retries(lambda: http().get(f"{API}/messages", params={"labelIds": "SENT", "maxResults": str(scan)}, headers=self._auth(), timeout=30))
        r.raise_for_status()
        for m in r.json().get("messages", []):
            d = self.message(m["id"], ["Message-ID"])
            if any(h["value"].strip() == rfc_message_id for h in d.get("payload", {}).get("headers", [])):
                return {"id": m["id"], "threadId": m["threadId"]}
        return None

    def message(self, mid: str, headers: list[str]) -> dict:
        r = with_retries(lambda: http().get(f"{API}/messages/{mid}", params=[("format", "metadata")] + [("metadataHeaders", h) for h in headers], headers=self._auth(), timeout=30))
        r.raise_for_status()
        return r.json()

    def thread(self, tid: str) -> dict:
        r = with_retries(lambda: http().get(f"{API}/threads/{tid}", params=[("format", "metadata"), ("metadataHeaders", "From"), ("metadataHeaders", "Subject"), ("metadataHeaders", "Content-Type"), ("metadataHeaders", "Message-ID"), ("metadataHeaders", "Auto-Submitted"), ("metadataHeaders", "X-Autoreply"), ("metadataHeaders", "X-Autorespond")], headers=self._auth(), timeout=30))
        r.raise_for_status()
        return r.json()

    def classify_thread(self, tid: str, sender: str) -> tuple[str, str]:
        """Return (state, detail): SENT / REPLIED / OPTED_OUT / BOUNCED."""
        t = self.thread(tid)
        state, detail = "SENT", ""
        for m in t.get("messages", [])[1:]:
            hdr = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
            frm, ctype, snip = hdr.get("from", ""), hdr.get("content-type", ""), m.get("snippet", "")
            if sender.lower() in frm.lower():
                continue
            subj = hdr.get("subject", "")
            if BOUNCE_FROM.search(frm) or "report-type=delivery-status" in ctype or BOUNCE_SUBJECT.search(subj):
                return "BOUNCED", snip[:200]
            auto = hdr.get("auto-submitted", "").lower()
            if (auto and auto != "no") or AUTO_REPLY_SUBJECT.search(subj) or hdr.get("x-autoreply") or hdr.get("x-autorespond"):
                continue  # out-of-office / auto-reply: not a human answer
            if OPT_OUT.search(snip) or OPT_OUT.search(subj):
                return "OPTED_OUT", snip[:200]
            state, detail = "REPLIED", snip[:200]
        return state, detail


def first_message_headers(thread: dict) -> dict:
    msgs = thread.get("messages", [])
    if not msgs:
        return {}
    hdr = {h["name"]: h["value"] for h in msgs[-1].get("payload", {}).get("headers", [])}
    mid = hdr.get("Message-ID") or hdr.get("Message-Id", "")
    return {"In-Reply-To": mid, "References": mid}
