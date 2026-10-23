# 5. Cold email and DM sequences

The full, ready-to-send text lives in the CRM under **Sales kit**, and in `assets/content.js`. Each email is filled in automatically with the lead's details when you click **Write** on a follow-up.

## Sequence A: Cold email to podcast founders (5 steps, 18 days)
| Day | Email | Job |
|---|---|---|
| 0 | **Observation**: subject "clips from {{channel}}" | Prove you watched their show; offer 2 free clips |
| 3 | **Proof**: a reply in the same thread | Link to your portfolio; explain what makes a good clip |
| 7 | **Sample**: "made this from your episode" | **Attach a real clip.** Your highest-converting step. |
| 12 | **Cost of doing nothing**: "one question" | Make them count the hours they spend on editing now |
| 18 | **Breakup**: "closing the loop" | Polite exit; often gets the most replies |

## Sequence B: LinkedIn / X DMs (3 steps)
1. **Day 0:** a question about their show; no pitch.
2. **Day 2, only after they answer:** offer free sample clips.
3. **Day 6:** send the clips and your booking link.
Connect first, engage with 2 of their posts, then DM.

## Personalization rules
- The `{{personalization}}` line is **one specific sentence about a specific moment** in a recent episode. The CRM warns you before you send if it's empty.
- Mention their show by name, never "your podcast".
- Keep emails **under 120 words**, with one question and one call to action.
- Subject lines: 2–5 words, lowercase, nothing that reads like marketing.
- Before sending, replace every `[BRACKETED]` placeholder. The CRM flags any that are left.

## Writing your own personalization lines (examples)
- *"Your take with Sarah Lin on why agencies should kill retainers, at about 14:20, is a perfect 40-second clip. It has a hook, a twist and a takeaway."*
- *"Saw episode 48 on hiring your first SDR. The 'hire for coachability, not experience' line would do well on LinkedIn."*
- *"Your podcast has 60+ episodes but the YouTube Shorts tab is empty. That's a lot of good material sitting unwatched."*

## What happens automatically
- Enrolling a lead creates all 5 follow-ups on the right dates and moves the lead to **Contacted**.
- When they reply, move the lead to **Replied**. The remaining sequence steps are cancelled and a "reply within 1 hour" task appears.
- If you mark a lead **Lost**, a re-engagement email is scheduled for 90 days later.

## Benchmarks
- Reply rate: **5–10%** is good for well-targeted cold email; **15%+** for sample-led emails.
- If your reply rate is under 3% after 200 sends: first check deliverability (are emails landing in spam?), then targeting, then the personalization line, and only then the copy.
