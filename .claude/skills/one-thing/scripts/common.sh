#!/usr/bin/env bash
# Shared bits for the /one-thing scripts. Sourced, not run.
set -euo pipefail

REPO="${ONE_THING_REPO:-seesawlabs/seesawgrowth}"
WORKFLOW="analysis.yml"
# The branch the workflow file lives on. Must match DEFAULT_REF in
# sites/reality-check/src/lib/dispatch.ts.
REF="${ONE_THING_REF:-claude/seesaw-labs-growth-u5ou0b}"
HOME_DIR="${ONE_THING_HOME:-$HOME/one-thing}"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing '$1'. Install it and try again." >&2; exit 2; }
}

need gh
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in. Run: gh auth login" >&2; exit 2; }

# Bare registrable host from whatever was pasted.
domain_of() {
  local d
  d="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#^www\.##; s#[/?#].*$##; s#:[0-9]+$##')"
  [ -n "$d" ] || { echo "Not a domain: $1" >&2; exit 2; }
  printf '%s' "$d"
}

# Newest run of the workflow, optionally filtered to one domain via its name.
latest_run_id() {
  gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId'
}
