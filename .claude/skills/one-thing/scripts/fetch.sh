#!/usr/bin/env bash
# Download a finished run's artifact and point at the documents in it.
#   fetch.sh <run-id> [dest]
source "$(dirname "$0")/common.sh"
id="${1:-}"; [ -n "$id" ] || { echo "Usage: fetch.sh <run-id> [dest]" >&2; exit 2; }

state="$(run_field "$id" status) $(run_field "$id" conclusion)"
case "$state" in
  "completed success"|"completed failure"|"completed cancelled") ;;
  *) echo "Run $id is not finished yet ($state). Try scripts/status.sh $id" >&2; exit 3 ;;
esac

# The artifact is named analysis-<domain>-<run id>; read the domain off it.
artifacts="$(rest GET "repos/$REPO/actions/runs/$id/artifacts")"
name="$(printf '%s' "$artifacts" | jget artifacts.0.name)"
artifact_id="$(printf '%s' "$artifacts" | jget artifacts.0.id)"
[ -n "$name" ] || {
  echo "Run $id left no artifact (it may have failed before the pipeline wrote anything). See $(run_url "$id")" >&2
  exit 4
}
domain="${name#analysis-}"; domain="${domain%-$id}"

dest="${2:-$HOME_DIR/$domain/$id}"
mkdir -p "$dest"
if [ "$TRANSPORT" = gh ]; then
  gh run download "$id" --repo "$REPO" --name "$name" --dir "$dest" >/dev/null
else
  # The zip endpoint answers with a redirect to blob storage; -L follows it.
  zip="$dest/.artifact.zip"
  curl -sSL -H "Authorization: Bearer $(api_token)" -H 'Accept: application/vnd.github+json' \
    -o "$zip" "$API/repos/$REPO/actions/artifacts/$artifact_id/zip"
  unzip -o -q "$zip" -d "$dest" || { echo "The artifact did not unzip. Download it by hand from $(run_url "$id")" >&2; exit 5; }
  rm -f "$zip"
fi

echo "Downloaded to $dest"
find "$dest" -name 'research-report.pdf' -o -name 'email-draft.md' -o -name '07-one-thing.json' -o -name 'sources.json' | sort
echo
echo "Review: node $(dirname "$0")/review.mjs \"$dest\""
