#!/usr/bin/env bash
# Status of a run (default: the newest analysis run).
#   status.sh [run-id]
source "$(dirname "$0")/common.sh"
id="${1:-$(latest_run_id)}"
gh run view "$id" --repo "$REPO" --json status,conclusion,displayTitle,createdAt,updatedAt,url,jobs \
  --jq '"Run \(.url)\nStatus: \(.status)  Conclusion: \(.conclusion // "—")\nStarted: \(.createdAt)  Updated: \(.updatedAt)\n" + ([.jobs[].steps[]? | select(.status != "completed" or .conclusion != "success" and .conclusion != "skipped") | "  step \(.name): \(.status) \(.conclusion // "")"] | join("\n"))'
echo
echo "Failed step log: gh run view $id --repo $REPO --log-failed"
