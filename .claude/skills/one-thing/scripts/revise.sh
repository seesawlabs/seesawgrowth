#!/usr/bin/env bash
# Re-run the analysis and the verdict against a reviewer's notes, reusing the
# research. Costs cents, takes about two minutes, posts fresh documents to Slack.
#   revise.sh --domain acme.com --run <pipeline runId> --notes "…"
# The pipeline runId is the timestamp-shaped folder name inside the artifact;
# review.mjs prints it.
source "$(dirname "$0")/common.sh"
domain="" run="" notes="" email="" name=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) domain="$2"; shift 2 ;;
    --run) run="$2"; shift 2 ;;
    --notes) notes="$2"; shift 2 ;;
    --email) email="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$domain" ] && [ -n "$run" ] && [ -n "$notes" ] || {
  echo "Usage: revise.sh --domain <domain> --run <pipeline runId> --notes \"…\" [--email …] [--name …]" >&2; exit 2; }
domain="$(domain_of "$domain")"

dispatch revise "$domain" "${email:-review@seesawlabs.com}" "${name:-Reviewer}" "$domain" \
  "" "" "" "$run" "$notes"
sleep 6
id="$(latest_run_id)"
echo "Revising $domain from run $run. GitHub run: $id"
run_url "$id"
