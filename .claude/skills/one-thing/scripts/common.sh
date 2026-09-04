#!/usr/bin/env bash
# Shared bits for the /one-thing scripts. Sourced, not run.
#
# TWO TRANSPORTS, because two kinds of session need to start a run.
#
#   gh   a teammate's own machine, `gh auth login` done once. Their user
#        token, their permissions.
#   api  a Claude Code session — including one on the web, where there is no
#        gh binary to install and no browser flow to complete. Talks to the
#        REST API directly with a token from the environment.
#
# The session's own GITHUB_TOKEN is not enough: in a Claude Code session it is
# read-only for Actions (403 on the dispatch, proven 2026-09-04), which is
# correct for a token an agent carries by default and useless for starting a
# run. So the api transport wants a token of its own — fine-grained, this
# repository, Actions: read and write, the same scope the Vercel auto-run path
# uses — set in the *environment's* variables, next to FIRECRAWL_API_KEY and
# the rest. It is read here and never printed, logged or committed.
#
# SEESAW_DISPATCH_TOKEN is the name to use. GITHUB_DISPATCH_TOKEN is accepted
# because that is what the Vercel side calls it, but GitHub reserves the
# GITHUB_ prefix in its own settings, which sends anyone who tries to add it
# there into a validation error — so the unprefixed name is the one the docs
# give. GH_TOKEN is accepted last, since the gh CLI reads it too.
set -euo pipefail

REPO="${ONE_THING_REPO:-seesawlabs/seesawgrowth}"
WORKFLOW="analysis.yml"
# The branch the workflow file lives on. Must match DEFAULT_REF in
# sites/reality-check/src/lib/dispatch.ts.
REF="${ONE_THING_REF:-claude/seesaw-labs-growth-u5ou0b}"
HOME_DIR="${ONE_THING_HOME:-$HOME/one-thing}"
# Overridable so the transport can be exercised against a stub. Never point
# it anywhere but GitHub in real use.
API="${ONE_THING_API:-https://api.github.com}"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing '$1'. Install it and try again." >&2; exit 2; }
}
need node
need curl

api_token() { printf '%s' "${SEESAW_DISPATCH_TOKEN:-${GITHUB_DISPATCH_TOKEN:-${GH_TOKEN:-}}}"; }

have_gh() { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }

if have_gh; then
  TRANSPORT=gh
elif [ -n "$(api_token)" ]; then
  TRANSPORT=api
  need unzip
  # Which variable answered, so a 403 later is traceable to a choice. Never
  # the value.
  if [ -n "${SEESAW_DISPATCH_TOKEN:-}" ]; then TOKEN_FROM=SEESAW_DISPATCH_TOKEN
  elif [ -n "${GITHUB_DISPATCH_TOKEN:-}" ]; then TOKEN_FROM=GITHUB_DISPATCH_TOKEN
  else TOKEN_FROM=GH_TOKEN; fi
else
  cat >&2 <<'MSG'
No way to reach GitHub Actions from here. Either:

  1. On your own machine: install the GitHub CLI and run `gh auth login` with an
     account that has write access to seesawlabs/seesawgrowth. Nothing else.

  2. In a Claude Code session: set SEESAW_DISPATCH_TOKEN in the ENVIRONMENT's
     variables — the same place FIRECRAWL_API_KEY and the other keys live, not
     the repository's Actions settings. It wants a fine-grained GitHub token,
     this repository only, Repository permissions -> Actions: Read and write.

The session's default GITHUB_TOKEN cannot start a run: it is read-only for
Actions, so a dispatch with it returns 403.
MSG
  exit 2
fi

# rest <method> <path> [json body] -> response body on stdout
rest() {
  local method="$1" path="$2" body="${3:-}"
  if [ "$TRANSPORT" = gh ]; then
    if [ -n "$body" ]; then
      printf '%s' "$body" | gh api --method "$method" -H 'Accept: application/vnd.github+json' "$path" --input -
    else
      gh api --method "$method" -H 'Accept: application/vnd.github+json' "$path"
    fi
    return
  fi
  local out code
  out="$(curl -sS -w $'\n%{http_code}' -X "$method" \
    -H "Authorization: Bearer $(api_token)" \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    ${body:+-d "$body"} "$API/$path")"
  code="$(printf '%s' "$out" | tail -n1)"
  printf '%s' "$out" | sed '$d'
  case "$code" in
    2*) ;;
    403)
      cat >&2 <<MSG
GitHub refused $method $path with 403.

The token being used (from \$$TOKEN_FROM) cannot act on Actions for $REPO. In a
Claude Code session that is usually the default GH_TOKEN, which is present in
every session and is read-only for Actions. Set SEESAW_DISPATCH_TOKEN in the ENVIRONMENT's variables
— the same place FIRECRAWL_API_KEY lives, not the repository's Actions settings
— to a fine-grained GitHub token scoped to this repository with Repository
permissions -> Actions: Read and write.
MSG
      return 1 ;;
    404) echo "GitHub returned 404 for $method $path. Wrong repo, or the token cannot see it." >&2; return 1 ;;
    *) echo "GitHub API $method $path -> HTTP $code" >&2; return 1 ;;
  esac
}

# jget <dotted.path> — reads JSON on stdin. Numeric keys index arrays.
jget() {
  node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let v = JSON.parse(s || "null");
  for (const k of process.argv[1].split(".").filter(Boolean)) v = v?.[k];
  process.stdout.write(v == null ? "" : String(v));
});' "$1"
}

# Bare registrable host from whatever was pasted.
domain_of() {
  local d
  d="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#^www\.##; s#[/?#].*$##; s#:[0-9]+$##')"
  [ -n "$d" ] || { echo "Not a domain: $1" >&2; exit 2; }
  printf '%s' "$d"
}

# The dispatch body, built by node so a brief with newlines and quotes in it
# cannot break the JSON. Ten inputs, in the order analysis.yml declares them.
dispatch_body() {
  REF="$REF" node -e '
const [mode, domain, email, name, company, category, peers, trigger, runId, notes] = process.argv.slice(1);
process.stdout.write(
  JSON.stringify({ ref: process.env.REF, inputs: { mode, domain, email, name, company, category, peers, trigger, runId, notes } })
);' "$@"
}

# dispatch <mode> <domain> <email> <name> <company> <category> <peers> <trigger> <runId> <notes>
dispatch() {
  rest POST "repos/$REPO/actions/workflows/$WORKFLOW/dispatches" "$(dispatch_body "$@")" >/dev/null
}

# Newest run of this workflow. The dispatch returns no id, so it is read back.
latest_run_id() {
  rest GET "repos/$REPO/actions/workflows/$WORKFLOW/runs?per_page=1" | jget workflow_runs.0.id
}

run_field() { rest GET "repos/$REPO/actions/runs/$1" | jget "$2"; }

run_url() { echo "https://github.com/$REPO/actions/runs/$1"; }
