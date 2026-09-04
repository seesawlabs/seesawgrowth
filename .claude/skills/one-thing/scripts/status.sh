#!/usr/bin/env bash
# Status of a run (default: the newest analysis run).
#   status.sh [run-id]
source "$(dirname "$0")/common.sh"
id="${1:-$(latest_run_id)}"
run="$(rest GET "repos/$REPO/actions/runs/$id")"
printf 'Run %s\n' "$(run_url "$id")"
printf 'Status: %s  Conclusion: %s\n' \
  "$(printf '%s' "$run" | jget status)" \
  "$(printf '%s' "$run" | jget conclusion)"
printf 'Started: %s  Updated: %s\n\n' \
  "$(printf '%s' "$run" | jget run_started_at)" \
  "$(printf '%s' "$run" | jget updated_at)"

# Steps that are not finished-and-fine: what a person actually wants to see.
rest GET "repos/$REPO/actions/runs/$id/jobs" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const jobs = (JSON.parse(s || "{}").jobs ?? []);
  for (const job of jobs) {
    for (const step of job.steps ?? []) {
      const fine = step.status === "completed" && (step.conclusion === "success" || step.conclusion === "skipped");
      if (!fine) console.log(`  step ${step.name}: ${step.status} ${step.conclusion ?? ""}`.trimEnd());
    }
  }
  if (!jobs.length) console.log("  (no job yet: the run is queued)");
});'

echo
if [ "$TRANSPORT" = gh ]; then
  echo "Failed step log: gh run view $id --repo $REPO --log-failed"
else
  echo "Failed step log: open $(run_url "$id") and read the red step."
fi
