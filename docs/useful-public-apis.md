# Public APIs worth using for Creative Cut

Shortlist taken from [public-apis/public-apis](https://github.com/public-apis/public-apis) (MIT), a list of
~2,500 third-party APIs. Nothing from that repo is installed or runs here — it is only a directory. Each
API below is a separate service with its own terms, limits and (for some) paid plans; check before use.
"No key" = usable without signing up.

## 1. More lead sources (people asking for editors)

| API | Key | Use for Creative Cut |
| --- | --- | --- |
| RemoteOK | No | Remote job board: freelance/contract video editor roles worldwide |
| Arbeitnow | No | Remote/EU job aggregator: freelance editor roles |
| Upwork | OAuth | Freelance gigs for video editing / motion design |
| Freelancer | OAuth | Same, on Freelancer.com |
| Vibeworker | apiKey | Upwork listings with client data + fit scores |
| Funding Signals | apiKey | Companies that just raised money (they need launch / product videos) |
| LeadMerlin | apiKey | Local businesses from Google Maps with owner names + checked emails (real estate, gyms, cafes) |
| Pick an Agency | No | 47,000+ marketing agencies by service/location → agency overflow outreach |
| Redlisten / Weir / RedditAPIs | apiKey | Reddit keyword alerts for "[hiring] video editor" without Apify cost |

## 2. Finding and checking emails (fewer bounces)

| API | Key | Use |
| --- | --- | --- |
| Kickbox | No | Verify an address before sending |
| Email Validator by LifeStep | No | Syntax + MX + disposable/role detection |
| Disify / Vetto | No | Block disposable / dead domains |
| Tomba email finder | apiKey | Find a work email from name + domain (alternative to BetterContact) |
| PeopleSearch | apiKey | People search with verified work emails |
| MailTester Ninja | apiKey | Live mailbox check, catch-all detection, free tier |

## 3. Deliverability of your own Gmail / domain

| API | Key | Use |
| --- | --- | --- |
| AGPC Domain Check | No | Grades SPF, DKIM, DMARC and MX for your sending domain |
| MailSenpai DNS Check | No | Same, tells you exactly which DNS records to add |
| Email Spam Tester | No | Send a draft, get a spam score and a fix plan before outreach |

## 4. Making lead rows and research richer

| API | Key | Use |
| --- | --- | --- |
| Logoapi | No | Company logo by domain → show brand logos in the Leads list |
| Company Enrichment | apiKey | Domain → company size, industry, HQ, socials |
| gstinapi | apiKey (free tier) | Verify an Indian client's GST number before invoicing |
| ShortsIntel / FastSocial Instagram Data | apiKey | A prospect's Reels/Shorts performance → personalise the pitch |

## 5. Tools for the editing work itself

| API | Key | Use |
| --- | --- | --- |
| ScaleReach | apiKey | Long video → vertical clips with captions + face-tracking (podcast repurposing) |
| Shotstack / JSON2Video | apiKey | Programmatic video rendering (templates, ads, slideshows) |
| TranscriptYT / Transcript Dock | apiKey | Transcripts + SRT/VTT captions from YouTube/TikTok/Instagram |
| FFmpeg Micro / VidSmaller | apiKey | Hosted transcode, trim, compress for client delivery |
| UGCdrop | No | Search real UGC clips (hooks, b-roll) for D2C ad edits |

## Best first picks
1. **Logoapi** (no key) — brand logos in the Lead Agent.
2. **Kickbox / LifeStep** (no key) — second email check before sending, fewer bounces.
3. **AGPC / MailSenpai** (no key) — check creativecut.in SPF/DKIM/DMARC once.
4. **RemoteOK + Arbeitnow** (no key) — two free lead sources next to Apify.
5. **Funding Signals** — freshly funded startups for SaaS explainer pitches.
