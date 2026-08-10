# Context for Claude sessions

## What this repo is

SeeSaw Labs growth planning. **Documents, not code** — there is nothing to build, test, or
lint here. Work in this repo means writing, revising, and researching against the plan in
`docs/`.

Read in this order before doing anything substantive:

1. `docs/00-status.md` — what's live, what's blocked, what hasn't started
2. `docs/01-decision-brief.md` — the four decisions on the table
3. `docs/02-audit-and-growth-plan.md` — full audit, the evidence base
4. `docs/03-targeting-report.md` — competitive density, referral partners, ABM list

## The frame everything is filtered through

$3.5M → $5M is a **$1.5M gap ≈ 3 pods at $45k/mo ≈ 4–6 genuinely qualified opportunities
per quarter.** This is not a volume game. Recommendations that optimize traffic, impressions,
or lead count over qualified-opportunity count are off-strategy — say so rather than
producing them.

The recommended position: **design-led AI product studio with a care-operations wedge**
(pharmacy/medication workflows, post-acute/hospice, dialysis/renal, care management).
Healthcare-first in *proof and content*, not healthcare-only in sales.

## Current blocker

**Decision #1 (positioning) has been open since 2026-07-22 and blocks all six other
workstreams.** Don't propose downstream work as if the positioning were settled. If asked to
move forward anyway, flag the dependency once, then proceed under a stated assumption.

## Conventions

- **Never invent a metric.** The proof problem is that the case studies are nearly
  metric-free — fabricating numbers would be the worst possible failure here. The hard
  numbers we actually own are HPS's "5x faster medication approvals" and Kountable's "$8MM
  Series B." Everything else needs sourcing or an explicit `Est.` hedge.
- **Flag stale data.** The DataForSEO figures in `02` are dated 2026-07-22. Any SEO
  recommendation that depends on volume, difficulty, or CPC needs a re-pull first. Date
  every new data pull inline.
- **Keep `docs/00-status.md` current.** It is the living doc. When a decision lands or a
  workstream starts, update it in the same commit as the work.
- **Preserve the hard-wrapped prose style** (~90 chars) in `docs/`. Tables run long; that's
  fine.
- `docs/` is the source of truth. `scripts/bundle.sh` regenerates the single-file version for
  uploading elsewhere — generated output, gitignored, never edited by hand.

## Named people

- **Jeff** — founder. Owns the relationship half: referrals, LinkedIn, Austin events, first
  sales calls. Decision #1 is a joint call with Calvin.
- **Calvin** (calvin@seesawlabs.com) — owns the product half: positioning, website, case
  studies, the offer as a product, Anthropic Select track, internal AI-ops story.

## Working branch

Development happens on `claude/seesaw-labs-growth-u5ou0b`.
