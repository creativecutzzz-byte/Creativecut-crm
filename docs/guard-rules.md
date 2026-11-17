# Deliverability guard rules (docs/guide.md, Step 9)

Thresholds live in `config/guard.yaml`. They are starting points to tune, not Google rules.
`/api/cron/guard` runs every 5 minutes. On a breach it sets the mailbox or domain to `paused`
with a `paused_reason`, inserts an `events` row and posts to `ALERT_WEBHOOK_URL`.
**It never auto-resumes** — a person reviews the cause and resumes from the dashboard.

| Signal | Threshold | Automatic action |
| --- | --- | --- |
| Mailbox hard bounces | ≥ 2% of the last 100 sends (minimum 30 sends) | Pause the mailbox |
| Domain hard bounces | ≥ 2% of the last 200 sends | Pause the domain |
| Gmail quota or rate error | Any | Pause the mailbox for 24 hours (sender) |
| Authentication, suspension or suspicious-activity error | Any | Pause the mailbox and alert immediately (sender) |
| Negative replies (opt-outs and complaints) | ≥ 1% of the domain's last 300 sends | Pause the domain |
| Postmaster Tools spam rate | ≥ 0.1% | Halve the domain's daily cap (once a day) |
| Postmaster Tools spam rate | ≥ 0.3% | Pause the domain |
| Postmaster Tools domain reputation | Low or Bad | Pause the domain |
| Reply rate | Under half of its 7-day median across 150+ sends | Alert only |

Postmaster numbers are entered on the dashboard (or inserted into `outreach.postmaster`).
When a domain is paused its unsent first emails are picked up by other domains automatically;
follow-ups in existing threads wait for their mailbox.
