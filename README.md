# SeeSaw Labs — Growth Plan

Working repository for SeeSaw Labs growth planning: the lead-generation audit, the
positioning / offer / proof recommendations, the decision brief written for Jeff, and the
targeting research behind them.

This is a **planning repo — documents, not code.** It exists so this context survives
between working sessions instead of living in a file that has to be re-uploaded each time.

## Status as of 2026-08-10

**Blocked on Decision #1 (positioning), open since 2026-07-22.** All six other workstreams
depend on it. If that conversation with Jeff hasn't happened, that is the whole bottleneck —
not the case studies. Full detail in [docs/00-status.md](docs/00-status.md).

Two standing caveats before acting on anything here:

1. **Re-pull the keyword data before spending on SEO.** The DataForSEO volumes,
   difficulties, and CPCs in the audit were pulled 2026-07-22 and are ~3 weeks stale. The
   competitive and positioning findings still hold.
2. **Nothing downstream has started** — case-study rebuilds, the Roadmap offer page, the
   Anthropic Select application, and the fractional growth hire are all not-yet-begun.

## The documents

| Doc | What it is | Dated |
|---|---|---|
| [docs/00-status.md](docs/00-status.md) | Living status — where this stands, what it's blocked on, source inputs, company context | 2026-08-10 |
| [docs/01-decision-brief.md](docs/01-decision-brief.md) | The 30-minute version: four decisions written for Jeff, ~7 min each | 2026-08-05 |
| [docs/02-audit-and-growth-plan.md](docs/02-audit-and-growth-plan.md) | The full audit & growth plan — 11 sections + evidence appendix | 2026-07-22 |
| [docs/03-targeting-report.md](docs/03-targeting-report.md) | Competitive density check, 50+ referral partners, 66-account ABM list, monthly playbook | 2026-07-22 |
| [docs/04-offer-project-plan.md](docs/04-offer-project-plan.md) | Project plan for the AI Production Roadmap offer — deliverables, production process, website flow, copy, unit economics, 8-week phasing | 2026-08-10 |
| [docs/05-reality-check-spec.md](docs/05-reality-check-spec.md) | Spec for the free AI Reality Check — qualifier, call script, extraction schema, report pipeline, guardrails, ad tests, 5-week build | 2026-08-11 |
| [docs/06-qualifier-spec.md](docs/06-qualifier-spec.md) | Build spec for the qualifier form — exact copy, fields, validation, scoring, gates, routing, the three outcome screens | 2026-08-11 |
| [docs/07-interview-guide.md](docs/07-interview-guide.md) | The one-hour call — prep, timeboxed blocks, question bank, technique, outlier branches, fit assessment, report variants | 2026-08-11 |

Read them in that order. `00` tells you what's live, `01` is the decision surface, `02` and
`03` are the evidence base you go to when a recommendation needs defending.

## The one-line thesis

> We don't have a traffic problem. We have a **positioning, offer, and proof** problem — and
> the flank in front of us is wide open.

The target is **$1.5M** (from $3.5M to $5M) ≈ **3 pods** at $45k/mo running 12 months ≈
**4–6 genuinely qualified opportunities per quarter.** Not 500 visitors a day. Every
recommendation in these docs is filtered through that.

## Rebuilding the single-file version

The docs were split out of one self-contained working file. To regenerate that file — for
uploading into a fresh session that can't clone this repo, or for sending to someone:

```bash
./scripts/bundle.sh                       # writes SeeSawLabsGrowthPlan-COMPLETE.md
./scripts/bundle.sh /path/to/output.md    # or name your own target
```

The `docs/` files are the source of truth. The bundle is generated output — never edit it
directly, and don't commit it.
