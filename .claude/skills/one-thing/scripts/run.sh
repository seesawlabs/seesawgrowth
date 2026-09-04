#!/usr/bin/env bash
# Start a research run on GitHub Actions for one company.
#
#   run.sh --domain acme.com --name "Dana Whitfield" --email dana@acme.com \
#          [--changed "…"] [--burn "…"] [--tried "…"]
#
# The three answers are what the lead typed on the form (or what you know).
# They travel as one labelled brief in the workflow's `trigger` input, the same
# way the site sends them, so the analysis treats them the same way.
source "$(dirname "$0")/common.sh"

domain="" name="" email="" changed="" burn="" tried=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) domain="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    --email) email="$2"; shift 2 ;;
    --changed) changed="$2"; shift 2 ;;
    --burn) burn="$2"; shift 2 ;;
    --tried) tried="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$domain" ] && [ -n "$name" ] && [ -n "$email" ] || {
  echo "Usage: run.sh --domain <domain> --name <name> --email <email> [--changed …] [--burn …] [--tried …]" >&2
  exit 2
}
domain="$(domain_of "$domain")"

# The brief, in the exact shape sites/reality-check/src/lib/intake.ts builds it.
brief=""
add() { [ -n "$2" ] && brief="${brief:+$brief

}$1: $2"; return 0; }
add "WHAT CHANGED RECENTLY" "$changed"
add "WHERE THE TEAM BURNS TIME" "$burn"
add "ALREADY TRIED, EVALUATED OR RULED OUT" "$tried"

# company=domain tells the pipeline to derive the name from the homepage;
# category and peers are inferred from the crawl. Same as the site.
gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$REF" \
  -f mode=run \
  -f "domain=$domain" \
  -f "email=$email" \
  -f "name=$name" \
  -f "company=$domain" \
  -f "category=" \
  -f "peers=" \
  -f "trigger=${brief:0:6000}" \
  -f "runId=" \
  -f "notes="

# The dispatch API returns before the run exists. Give it a moment, then find it.
sleep 6
id="$(latest_run_id)"
url="https://github.com/$REPO/actions/runs/$id"
echo "Started research for $domain."
echo "GitHub run: $id"
echo "$url"
echo "About ten minutes and about \$2. Slack gets the report PDF and the email draft when it finishes."
echo "Then: scripts/fetch.sh $id && node scripts/review.mjs ~/one-thing/$domain/$id"
