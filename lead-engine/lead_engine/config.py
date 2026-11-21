"""Environment variables, Sheet schema and Settings defaults.

The Settings tab of the Google Sheet is the single source of truth for
operational settings (sending on/off, caps, run times, sources). Environment
variables only hold deployment wiring and secrets.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

SHEET_TITLE = "Creative Cut | Lead Generation & Outreach"
PLAYBOOK_DOC_ID = "15P2uFT-Q7LJ56D0t7Dwk8a_dx4YqF3niJDYxp71cvhY"
PLAYBOOK_URL = f"https://docs.google.com/document/d/{PLAYBOOK_DOC_ID}/edit"

# ---------------------------------------------------------------- sheet schema
LEAD_STATUSES = ["NEW", "QUALIFIED", "READY", "NEEDS_REVIEW", "SENT", "REPLIED", "BOUNCED", "SKIPPED", "FAILED", "CLOSED"]
QUEUE_STATUSES = ["DRAFT", "READY", "NEEDS_REVIEW", "SENDING", "SENT", "REPLIED", "BOUNCED", "OPTED_OUT", "SKIPPED", "FAILED"]
VERIFY_STATUSES = ["MX_OK", "NO_MX", "INVALID", "NOT_FOUND", "MANUAL_OK"]
SUPPRESSION_TYPES = ["OPT_OUT", "HARD_BOUNCE", "DO_NOT_CONTACT", "COMPANY"]

TABS: dict[str, list[str]] = {
    "Dashboard": ["Metric", "Value", "Notes"],
    "Leads": [
        "Lead ID", "Opportunity Key", "Status", "Company", "Contact Name", "Market", "Niche", "Website",
        "Source", "Source URL", "Post Date", "Exact Need", "Post Excerpt", "Brand Research Notes",
        "Research Sources", "Fit Reason", "Fit Score", "Engagement", "Contact Channel", "Business Email",
        "Email Source", "Email Verification", "Opportunity Open", "First Seen", "Last Checked", "Notes",
        "System Status",
    ],
    "Outreach Queue": [
        "Attempt ID", "Lead ID", "Touch", "Recipient", "Subject", "Email Preview", "Variation",
        "Sample Title", "Sample URL", "Personalisation Sources", "Status", "Planned Send", "Sent At",
        "Gmail Message ID", "Gmail Thread ID", "RFC Message-ID", "Last Error", "Notes", "System Status",
    ],
    "Suppression": ["Value", "Type", "Company", "Reason", "Source", "Added At", "Added By"],
    "Run Log": [
        "Run ID", "Started", "Finished", "Trigger", "Mode", "Source", "Apify Run ID", "Dataset ID",
        "Apify Status", "Rows Found", "Qualified", "Ready", "Sent", "Skipped", "Errors", "Cost USD", "Notes",
    ],
    "Settings": ["Key", "Value", "Description"],
}

# Columns a human owns. The worker never overwrites them once a row exists.
MANUAL_COLUMNS = {
    "Leads": {"Notes", "Contact Name", "Business Email", "Email Verification"},
    "Outreach Queue": {"Notes"},
}

SOURCES = ["linkedin_posts", "linkedin_jobs", "google_hiring", "reddit_threads"]

DEFAULT_SETTINGS: list[tuple[str, str, str]] = [
    ("SENDER_EMAIL", "creativecutzzz@gmail.com", "Authorised Creative Cut Gmail inbox used for sending."),
    ("SENDER_NAME", "Hemant, Creative Cut", "Display name on outgoing email."),
    ("SENDING_ENABLED", "FALSE", "TRUE = send eligible READY emails live. FALSE = DRY_RUN (draft + preview only)."),
    ("TEST_RECIPIENT", "creativecutzzz@gmail.com", "Self-test address for `selftest-gmail`."),
    ("DAILY_SEND_CAP", "10", "Max first-touch emails per IST day, shared by both runs."),
    ("FOLLOWUPS_ENABLED", "FALSE", "Automated follow-ups. Leave FALSE until enabled separately."),
    ("RUN_TIME_1", "09:00", "First daily run (HH:MM, Asia/Kolkata). `sync-schedule` pushes it to Cloud Scheduler."),
    ("RUN_TIME_2", "16:00", "Second daily run (HH:MM, Asia/Kolkata)."),
    ("TIMEZONE", "Asia/Kolkata", "Scheduler time zone."),
    ("ACTIVE_SOURCES", "linkedin_posts,linkedin_jobs,google_hiring,reddit_threads", "Comma list of enabled sources."),
    ("SEARCH_WINDOW_DAYS", "14", "Preferred recency window."),
    ("EXTENDED_WINDOW_DAYS", "30", "Fallback window when too few qualified leads are found."),
    ("MIN_QUALIFIED_BEFORE_EXTEND", "3", "Extend to the 30-day window when fewer qualified leads than this."),
    ("MONTHLY_APIFY_BUDGET_USD", "4.50", "Stop starting Actor runs when monthly Apify usage would pass this."),
    ("SOURCE_linkedin_posts_MAX_ITEMS", "15", "LinkedIn post search: max posts per run."),
    ("SOURCE_linkedin_posts_MAX_USD", "0.04", "LinkedIn post search: spend cap per run."),
    ("SOURCE_linkedin_jobs_MAX_ITEMS", "10", "LinkedIn jobs (contract/part-time): max jobs per run."),
    ("SOURCE_linkedin_jobs_MAX_USD", "0.04", "LinkedIn jobs: spend cap per run."),
    ("SOURCE_google_hiring_MAX_ITEMS", "4", "Google search (Reddit + hiring pages): max result pages per run."),
    ("SOURCE_google_hiring_MAX_USD", "0.02", "Google search: spend cap per run (Actor minimum cap is $0.50; input size enforces this)."),
    ("SOURCE_reddit_threads_MAX_ITEMS", "6", "Reddit thread details fetched per run (from Google results)."),
    ("SOURCE_reddit_threads_MAX_USD", "0.05", "Reddit thread details: spend cap per run."),
    ("PLAYBOOK_SOURCE", PLAYBOOK_URL, "Creative Cut Personalised Outreach Playbook (source of truth)."),
    ("SAMPLE_SITE", "https://www.creativecut.in/work", "Portfolio page whose embedded YouTube videos form the sample bank."),
]


# ---------------------------------------------------------------- environment
@dataclass
class Env:
    sheet_id: str = field(default_factory=lambda: os.getenv("LEADS_SHEET_ID", ""))
    apify_token: str = field(default_factory=lambda: os.getenv("APIFY_TOKEN", ""))
    gmail_client_id: str = field(default_factory=lambda: os.getenv("GMAIL_OAUTH_CLIENT_ID", ""))
    gmail_client_secret: str = field(default_factory=lambda: os.getenv("GMAIL_OAUTH_CLIENT_SECRET", ""))
    gmail_refresh_token: str = field(default_factory=lambda: os.getenv("GMAIL_OAUTH_REFRESH_TOKEN", ""))
    ledger_bucket: str = field(default_factory=lambda: os.getenv("LEDGER_BUCKET", ""))
    ledger_dir: str = field(default_factory=lambda: os.getenv("LEDGER_DIR", ".ledger"))
    anthropic_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    anthropic_model: str = field(default_factory=lambda: os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"))
    gcp_project: str = field(default_factory=lambda: os.getenv("GOOGLE_CLOUD_PROJECT", ""))
    gcp_region: str = field(default_factory=lambda: os.getenv("GCP_REGION", "asia-south1"))
    scheduler_job_prefix: str = field(default_factory=lambda: os.getenv("SCHEDULER_JOB_PREFIX", "creativecut-leads"))
    cloud_run_job: str = field(default_factory=lambda: os.getenv("CLOUD_RUN_JOB", "creativecut-lead-engine"))
    scheduler_sa: str = field(default_factory=lambda: os.getenv("SCHEDULER_SERVICE_ACCOUNT", ""))
    local_sheet_path: str = field(default_factory=lambda: os.getenv("LOCAL_SHEET_PATH", ""))


class Settings(dict):
    """Key/value settings read from the Settings tab with typed accessors."""

    def flag(self, key: str) -> bool:
        return str(self.get(key, "")).strip().upper() in {"TRUE", "YES", "1", "ON"}

    def num(self, key: str, default: float = 0) -> float:
        try:
            return float(str(self.get(key, default)).strip())
        except ValueError:
            return default

    def sources(self) -> list[str]:
        return [s.strip() for s in str(self.get("ACTIVE_SOURCES", "")).split(",") if s.strip() in SOURCES]

    @classmethod
    def defaults(cls) -> "Settings":
        return cls({k: v for k, v, _ in DEFAULT_SETTINGS})
