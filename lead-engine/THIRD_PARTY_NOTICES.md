# Third-party notices

Parts of this lead engine are adapted from the OpenOutreach project by eracle, licensed under the
Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0):

| Here | Adapted from | What was taken |
| --- | --- | --- |
| `lead_engine/enrich.py` → BetterContact | [OpenOutFind](https://github.com/eracle/OpenOutFind) `openoutfind/enrichment/bettercontact.py` | API endpoints, `X-API-Key` header, async submit/poll flow, usable email statuses, `credits_left` parsing |
| `lead_engine/pipeline.py` → `_warm_allowance` | [OpenOutSend](https://github.com/eracle/OpenOutSend) `openoutsend/emails/warmth.py` | Warm-up rules: floor of 5/day, growth ×1.25 when clean, halve above 5% bounces |
| `lead_engine/gmail.py` → bounce / auto-reply patterns | [OpenOutSend](https://github.com/eracle/OpenOutSend) `openoutsend/emails/classify.py` | Bounce subjects, daemon senders, auto-reply subjects, bounce-first ordering |
| EU/EEA/UK/CH handling, postal address in footer | [OpenOutreach](https://github.com/eracle/OpenOutreach) `LEGAL_NOTICE.md` | Protected-region list and CAN-SPAM postal-address guidance |
| `.claude/skills/creative-cut-lead-engine/SKILL.md` | OpenOutreach `skills/find-leads/SKILL.md` | The idea of a project skill that tells agents which verbs spend or send |

The code was rewritten for this project; changes are described in each file's comments.
Deliberately **not** adopted: the central contacts store (hub.openoutreach.app), which shares
contacts you find with other operators; the mandatory "Sent with OpenOutreach" line; the newsletter
opt-in and affiliate links; and the SMTP app-password sender (this project uses Gmail OAuth).
