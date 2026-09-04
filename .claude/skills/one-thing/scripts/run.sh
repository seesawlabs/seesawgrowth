#!/usr/bin/env bash
# Start a research run on GitHub Actions for one company.
#
# COLD OUTREACH (the default, and the reason this skill exists):
#
#   run.sh --domain acme.com \
#          --to-name "Dana Whitfield" --to-role "COO" [--to-email dana@acme.com] \
#          --category "Specialty pharmacy serving hospice agencies in Texas" \
#          --why-now "Posted a VP of Operations role on 2026-08-30" \
#          --why-now-url https://acme.com/careers/vp-operations \
#          [--peers rival.com,other.com] [--known "…"] [--history "…"]
#
#   --why-now and --why-now-url are REQUIRED for cold outreach. The pipeline
#   reads the URL and keeps a verbatim quote only if the page supports the
#   note; that quote is the one thing the email may open with. A note without
#   a page is an opinion, and the run is refused.
#
#   --category is REQUIRED for cold outreach: one line, what they do and for
#   whom, in your words. It aims peer discovery, which is the make-or-break
#   stage, and a stranger's site rarely says it plainly.
#
# INBOUND LEAD (someone who filled in the form; usually the Slack link is
# simpler, but this works from a laptop too):
#
#   run.sh --lead --domain acme.com --to-name "…" --to-email … \
#          [--changed "…"] [--burn "…"] [--tried "…"]
source "$(dirname "$0")/common.sh"

mode="cold"
domain="" to_name="" to_role="" to_email="" category="" peers=""
why_now="" why_now_url="" known="" history="" changed="" burn="" tried=""
while [ $# -gt 0 ]; do
  case "$1" in
    --lead) mode="run"; shift ;;
    --cold) mode="cold"; shift ;;
    --domain) domain="$2"; shift 2 ;;
    --to-name|--name) to_name="$2"; shift 2 ;;
    --to-role|--role) to_role="$2"; shift 2 ;;
    --to-email|--email) to_email="$2"; shift 2 ;;
    --category) category="$2"; shift 2 ;;
    --peers) peers="$2"; shift 2 ;;
    --why-now) why_now="$2"; shift 2 ;;
    --why-now-url) why_now_url="$2"; shift 2 ;;
    --known) known="$2"; shift 2 ;;
    --history) history="$2"; shift 2 ;;
    --changed) changed="$2"; shift 2 ;;
    --burn) burn="$2"; shift 2 ;;
    --tried) tried="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

fail() { echo "$1" >&2; exit 2; }
[ -n "$domain" ] || fail "--domain is required (the company's website)."
domain="$(domain_of "$domain")"
[ -n "$to_name" ] || fail "--to-name is required (who the email is to)."

if [ "$mode" = "cold" ]; then
  [ -n "$to_role" ] || fail "--to-role is required for cold outreach (the recipient's title; it decides how the idea is framed)."
  [ -n "$category" ] || fail "--category is required for cold outreach (one line: what they do and for whom, in your words)."
  [ -n "$why_now" ] || fail "--why-now is required for cold outreach (the dated, specific thing you noticed)."
  [[ "$why_now_url" =~ ^https?:// ]] || fail "--why-now-url is required for cold outreach and must be a page (https://…). The pipeline verifies the note against it; no page, no run."
  [ -n "$to_email" ] || to_email="unknown@$domain"
  brief="OUTREACH: cold

WHAT CHANGED RECENTLY: $why_now

EVIDENCE: $why_now_url | $why_now"
  [ -n "$known" ] && brief="$brief

WHERE THE TEAM BURNS TIME: $known"
  [ -n "$history" ] && brief="$brief

ALREADY TRIED, EVALUATED OR RULED OUT: $history"
  name_for_pipeline="$to_name${to_role:+, $to_role}"
else
  [ -n "$to_email" ] || fail "--to-email is required for an inbound lead."
  brief=""
  add() { [ -n "$2" ] && brief="${brief:+$brief

}$1: $2"; return 0; }
  add "WHAT CHANGED RECENTLY" "$changed"
  add "WHERE THE TEAM BURNS TIME" "$burn"
  add "ALREADY TRIED, EVALUATED OR RULED OUT" "$tried"
  name_for_pipeline="$to_name"
fi

# company=domain tells the pipeline to derive the name from the homepage.
gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$REF" \
  -f "mode=$mode" \
  -f "domain=$domain" \
  -f "email=$to_email" \
  -f "name=$name_for_pipeline" \
  -f "company=$domain" \
  -f "category=$category" \
  -f "peers=$peers" \
  -f "trigger=${brief:0:6000}" \
  -f "runId=" \
  -f "notes="

sleep 6
id="$(latest_run_id)"
echo "Started $mode research for $domain."
echo "GitHub run: $id"
echo "https://github.com/$REPO/actions/runs/$id"
echo "About ten minutes and about \$2. Slack gets the report PDF and the email draft when it finishes."
echo "Then: scripts/fetch.sh $id && node scripts/review.mjs ~/one-thing/$domain/$id"
