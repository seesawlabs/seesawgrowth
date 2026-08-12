#!/usr/bin/env bash
# Regenerate the single self-contained working file from docs/.
#
# Use this when you need to hand the whole plan to something that can't clone the
# repo — a fresh chat session, an email attachment, a collaborator without access.
#
#   ./scripts/bundle.sh                       # -> SeeSawLabsGrowthPlan-COMPLETE.md
#   ./scripts/bundle.sh /path/to/output.md
#
# docs/ is the source of truth. The output is generated — never edit it by hand.

set -euo pipefail

cd "$(dirname "$0")/.."

out="${1:-SeeSawLabsGrowthPlan-COMPLETE.md}"

parts=(
  docs/00-status.md
  docs/01-decision-brief.md
  docs/02-audit-and-growth-plan.md
  docs/03-targeting-report.md
  docs/04-offer-project-plan.md
  docs/05-reality-check-spec.md
  docs/06-qualifier-spec.md
  docs/07-interview-guide.md
  docs/08-website-build-runbook.md
)

for p in "${parts[@]}"; do
  [ -f "$p" ] || { echo "bundle.sh: missing $p" >&2; exit 1; }
done

{
  cat <<HEADER
# SeeSaw Labs — Growth Plan: Complete Working File

**Self-contained.** Everything from the growth-planning work is inline below — nothing
references an external file, PDF, or link you need to go fetch. Upload this one file and
a new session has the full picture.

Generated $(date -u +%Y-%m-%d) from the seesawgrowth repo. Contains ${#parts[@]} documents:

1. **Current status** — where this stands and what it's blocked on
2. **The 30-minute version** (2026-08-05) — the four-decision brief written for Jeff
3. **The full audit & growth plan** (2026-07-22) — 11 sections + evidence appendix
4. **The targeting report** (2026-07-22) — competitive density check, 50+ referral partners, 66-account ABM list, monthly playbook
5. **The offer project plan** (2026-08-10) — AI Production Roadmap: deliverables, production process, website flow, copy, unit economics, 8-week phasing
6. **The Reality Check spec** (2026-08-11) — the free offer: qualifier, call script, extraction schema, report pipeline, guardrails, ad tests, 5-week build
7. **The qualifier form spec** (2026-08-11) — exact copy, fields, validation, scoring, gates, routing, the three outcome screens
8. **The interview guide** (2026-08-11) — the one-hour call: prep, timeboxed blocks, question bank, technique, outlier branches, fit assessment, report variants
9. **The website build runbook** (2026-08-11) — ten steps to ship the messaging, CTA, qualifier, and scheduler: stack choices, endpoint architecture, test matrix
HEADER

  for p in "${parts[@]}"; do
    printf '\n---\n---\n\n'
    cat "$p"
  done

  printf '\n---\n\n*End of file. Everything above is self-contained — no external references required.*\n'
} > "$out"

echo "wrote $out ($(wc -l < "$out" | tr -d ' ') lines)"
