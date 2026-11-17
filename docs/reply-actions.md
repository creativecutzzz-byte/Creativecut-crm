# Reply actions (docs/guide.md, Step 8)

Every human reply stops the sequence: in one transaction the lead is set to `replied`
(or `unsubscribed`) and every remaining step for that lead is set to `skipped`.

| Intent | What the system does |
| --- | --- |
| interested, question | Stop the sequence, post an alert (ALERT_WEBHOOK_URL) so a person answers quickly. |
| not_now | Stop the sequence and set `revisit_at` 75 days out. |
| not_interested | Stop the sequence. No further emails. |
| wrong_person, referral | Stop the sequence. A named referral with an email becomes a new lead (`uploaded`, `referred_by` set) and goes through normal verification and qualification. |
| unsubscribe | Stop the sequence and add the address to the suppression list. |

Before the model is called, a deterministic opt-out check (stop, unsubscribe, remove me,
do not contact, a bare "no") sends the reply straight to `unsubscribe`.

Bounces (mailer-daemon / postmaster / delivery-status reports): the lead becomes `bounced`,
hard bounces go to the suppression list, and a `bounce` event feeds the guard.

Auto-replies (Auto-Submitted other than `no`, X-Autoreply, Precedence auto_reply/bulk/junk,
"Out of office" subjects) are saved with `is_auto = true`, not classified, and do not stop
the sequence.
