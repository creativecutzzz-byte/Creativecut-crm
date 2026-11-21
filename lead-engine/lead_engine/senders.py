"""Up to three Gmail sender slots, each with its own daily limit."""

from __future__ import annotations

from dataclasses import dataclass

from .config import Env, Settings
from .gmail import Gmail, GmailError
from .secrets import get_secret


@dataclass
class SenderSlot:
    slot: int
    email: str
    cap: int
    gmail: object | None  # Gmail or a test double
    status: str = "connected"


def load_senders(settings: Settings, env: Env) -> list[SenderSlot]:
    out = []
    for n in (1, 2, 3):
        email = settings.get(f"SENDER_{n}_EMAIL", "") or (settings.get("SENDER_EMAIL", "") if n == 1 else "")
        if not email:
            continue
        token = get_secret(f"GMAIL_SENDER_{n}_REFRESH_TOKEN", env.gcp_project) or (env.gmail_refresh_token if n == 1 else "")
        cap = int(settings.num(f"SENDER_{n}_DAILY_CAP", settings.num("DAILY_SEND_CAP", 10) if n == 1 else 10))
        try:
            gm = Gmail(env.gmail_client_id, env.gmail_client_secret, token)
            out.append(SenderSlot(n, email, cap, gm))
        except GmailError:
            out.append(SenderSlot(n, email, cap, None, "setup_required"))
    return out
