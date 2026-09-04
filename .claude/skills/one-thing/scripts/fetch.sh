#!/usr/bin/env bash
# Download a finished run's artifact and point at the documents in it.
#   fetch.sh <run-id> [dest]
source "$(dirname "$0")/common.sh"
id="${1:-}"; [ -n "$id" ] || { echo "Usage: fetch.sh <run-id> [dest]" >&2; exit 2; }

status="$(gh run view "$id" --repo "$REPO" --json status,conclusion --jq '.status + " " + (.conclusion // "")')"
case "$status" in
  "completed success"|"completed failure"|"completed cancelled") ;;
  *) echo "Run $id is not finished yet ($status). Try scripts/status.sh $id" >&2; exit 3 ;;
esac

# The artifact is named analysis-<domain>-<run id>; read the domain off it.
name="$(gh api "repos/$REPO/actions/runs/$id/artifacts" --jq '.artifacts[0].name')"
[ -n "$name" ] && [ "$name" != "null" ] || { echo "Run $id left no artifact (it may have failed before the pipeline wrote anything). See: gh run view $id --repo $REPO --log-failed" >&2; exit 4; }
domain="${name#analysis-}"; domain="${domain%-$id}"

dest="${2:-$HOME_DIR/$domain/$id}"
mkdir -p "$dest"
gh run download "$id" --repo "$REPO" --name "$name" --dir "$dest" >/dev/null

echo "Downloaded to $dest"
find "$dest" -name 'research-report.pdf' -o -name 'email-draft.md' -o -name '07-one-thing.json' -o -name 'sources.json' | sort
echo
echo "Review: node $(dirname "$0")/review.mjs \"$dest\""
