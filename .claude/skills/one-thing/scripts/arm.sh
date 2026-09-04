#!/usr/bin/env bash
# Store a dispatch token for this session, when the cloud environment's
# variables are out of reach.
#
#   scripts/arm.sh            reads the token from stdin
#   echo "$TOKEN" | scripts/arm.sh
#
# The token arrives on stdin and never as an argument, so it stays out of shell
# history and out of any process listing. It is written to ~/.one-thing-token
# with owner-only permissions, outside the repository, and .gitignore does not
# come into it because the file is not in the repo at all.
#
# WHAT THIS COSTS. A token pasted into a Claude Code session is in that
# session's transcript, and in a cloud session the file lives only as long as
# the VM. The environment variable is the better home for it; this exists so a
# person who cannot reach that dialog is not blocked. Revoke the token at
# github.com/settings/personal-access-tokens if you would rather not have
# pasted it.
set -euo pipefail

file="${ONE_THING_TOKEN_FILE:-$HOME/.one-thing-token}"
token="$(cat)"
token="$(printf '%s' "$token" | tr -d ' \t\r\n')"

[ -n "$token" ] || { echo "Nothing on stdin. Pipe the token in: echo \"\$TOKEN\" | scripts/arm.sh" >&2; exit 2; }
case "$token" in
  github_pat_*|ghp_*|gho_*|ghu_*) ;;
  *) echo "That does not look like a GitHub token (expected github_pat_… or ghp_…). Nothing written." >&2; exit 2 ;;
esac

umask 077
printf '%s' "$token" > "$file"
chmod 600 "$file"
echo "Stored a ${#token}-character token in $file for this session."
echo "Check it: scripts/status.sh"
