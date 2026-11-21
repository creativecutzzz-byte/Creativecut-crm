#!/usr/bin/env bash
# Deploy the Creative Cut lead engine as a Cloud Run Job + two Cloud Scheduler
# triggers (Asia/Kolkata). Run from lead-engine/ in Cloud Shell or any machine
# with gcloud logged in as a project Owner.
#
#   PROJECT=my-project SHEET_ID=1wxg9... ./deploy/deploy.sh
#
# Idempotent: safe to re-run after code changes.
set -euo pipefail

: "${PROJECT:?set PROJECT}"
: "${SHEET_ID:?set SHEET_ID (Google Sheet ID)}"
REGION="${REGION:-asia-south1}"
JOB="${JOB:-creativecut-lead-engine}"
BUCKET="${BUCKET:-${PROJECT}-cc-lead-ledger}"
RUN_SA="cc-lead-engine@${PROJECT}.iam.gserviceaccount.com"
SCHED_SA="cc-lead-scheduler@${PROJECT}.iam.gserviceaccount.com"
G="gcloud --project ${PROJECT} --quiet"

echo "== APIs"
$G services enable run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  sheets.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com storage.googleapis.com gmail.googleapis.com

echo "== Service accounts"
$G iam service-accounts describe "$RUN_SA" >/dev/null 2>&1 || $G iam service-accounts create cc-lead-engine --display-name "Creative Cut lead engine (runtime)"
$G iam service-accounts describe "$SCHED_SA" >/dev/null 2>&1 || $G iam service-accounts create cc-lead-scheduler --display-name "Creative Cut lead engine (scheduler invoker)"

echo "== Secrets (values are never echoed)"
ensure_secret() {
  local name="$1" prompt="$2" optional="${3:-}"
  if ! $G secrets describe "$name" >/dev/null 2>&1; then
    $G secrets create "$name" --replication-policy automatic
  fi
  if [ -z "$($G secrets versions list "$name" --filter=state=enabled --format='value(name)' --limit=1)" ]; then
    if [ -n "$optional" ]; then read -r -s -p "$prompt (Enter to skip): " v; else read -r -s -p "$prompt: " v; fi; echo
    if [ -n "$v" ]; then printf '%s' "$v" | $G secrets versions add "$name" --data-file=-; fi
  fi
  $G secrets add-iam-policy-binding "$name" --member "serviceAccount:${RUN_SA}" --role roles/secretmanager.secretAccessor >/dev/null
}
ensure_secret APIFY_TOKEN "Apify API token (console.apify.com > Settings > API & Integrations)"
ensure_secret GMAIL_OAUTH_CLIENT_ID "Gmail OAuth client ID (or run deploy/authorize_gmail.py --project first)"
ensure_secret GMAIL_OAUTH_CLIENT_SECRET "Gmail OAuth client secret"
ensure_secret GMAIL_OAUTH_REFRESH_TOKEN "Gmail refresh token (from deploy/authorize_gmail.py)"
ensure_secret ANTHROPIC_API_KEY "Anthropic API key for AI personalisation" optional

echo "== Ledger bucket (durable send records + run lock)"
gsutil ls -p "$PROJECT" "gs://${BUCKET}" >/dev/null 2>&1 || gsutil mb -p "$PROJECT" -l "$REGION" -b on "gs://${BUCKET}"
gsutil iam ch "serviceAccount:${RUN_SA}:roles/storage.objectAdmin" "gs://${BUCKET}"

echo "== Runtime SA may manage the two scheduler jobs (Settings tab is the source of truth)"
$G projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${RUN_SA}" --role roles/cloudscheduler.admin --condition=None >/dev/null
$G iam service-accounts add-iam-policy-binding "$SCHED_SA" --member "serviceAccount:${RUN_SA}" --role roles/iam.serviceAccountUser >/dev/null

echo "== Build + deploy Cloud Run Job"
SECRETS="APIFY_TOKEN=APIFY_TOKEN:latest,GMAIL_OAUTH_CLIENT_ID=GMAIL_OAUTH_CLIENT_ID:latest,GMAIL_OAUTH_CLIENT_SECRET=GMAIL_OAUTH_CLIENT_SECRET:latest,GMAIL_OAUTH_REFRESH_TOKEN=GMAIL_OAUTH_REFRESH_TOKEN:latest"
if [ -n "$($G secrets versions list ANTHROPIC_API_KEY --filter=state=enabled --format='value(name)' --limit=1 2>/dev/null)" ]; then
  SECRETS="${SECRETS},ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"
fi
$G run jobs deploy "$JOB" --source . --region "$REGION" --service-account "$RUN_SA" \
  --tasks 1 --parallelism 1 --max-retries 1 --task-timeout 3600 --memory 512Mi \
  --set-env-vars "LEADS_SHEET_ID=${SHEET_ID},LEDGER_BUCKET=${BUCKET},GOOGLE_CLOUD_PROJECT=${PROJECT},GCP_REGION=${REGION},CLOUD_RUN_JOB=${JOB},SCHEDULER_SERVICE_ACCOUNT=${SCHED_SA}" \
  --set-secrets "$SECRETS"
$G run jobs add-iam-policy-binding "$JOB" --region "$REGION" --member "serviceAccount:${SCHED_SA}" --role roles/run.invoker >/dev/null

echo
echo ">> Share the Google Sheet with ${RUN_SA} as Editor (Share button), then press Enter."
read -r _

echo "== Push RUN_TIME_1/RUN_TIME_2 from the Settings tab to Cloud Scheduler and verify"
$G run jobs execute "$JOB" --region "$REGION" --args "sync-schedule" --wait
for i in 1 2; do
  $G scheduler jobs describe "creativecut-leads-run-$i" --location "$REGION" --format 'value(name,schedule,timeZone,state)'
done
echo "Done. Sending stays off until Settings → SENDING_ENABLED = TRUE."
