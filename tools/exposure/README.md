# AI Exposure Report — generation scripts

Scripts that build an **AI Exposure Report** for a company from public evidence:
where AI is creating opportunity for them, where it's a threat, and what we
couldn't determine without asking.

Built as repeatable scripts first, deliberately. The report format teaches us
what inputs it needs — not the other way round.

```bash
npm test           # 13 tests, no network, no credentials
npm run prototype  # assemble the fixture -> stdout + runs/
npm run report -- <domain>   # full pipeline (needs credentials)
```

## Where this sits in the ladder

| | Name | Answers |
|---|---|---|
| Free, automated | **AI Exposure Report** *(this)* | what's happening to you |
| Free, one hour | AI Reality Check | where you actually stand |
| $25k | AI Production Roadmap | what to build |

## The one rule the code enforces

`docs/` says never invent a metric. Here that's a build-time failure rather than
an editorial habit, because automation will otherwise erode it:

> **A numeral in a claim must either carry a source, or be a declared blank.**

Blanks are written `[checksPerMonth]` and declared in `missingVariables`. They
render *as blanks* in the report, followed by what we'd need from the reader:

> If that 6-step eligibility check runs `[checksPerMonth]` times a month at
> `[minutesEach]` minutes each, it consumes `[hoursPerYear]` hours a year.

The reader fills those in mentally and does the math themselves. That's more
persuasive than a number we invented, it's honest, and the blanks become the
agenda for the call. `validateClaim()` in `src/lib/claim.ts` is the enforcement
point; anything that fails is dropped from the report, not repaired.

The strictness is intentional: "shipped an assistant in March 2026" contains a
numeral and therefore needs a citation. That's the correct outcome.

## Evidence tiers

Every claim is graded by how we know it. All three can be personal — the axis is
evidence, not inside-vs-outside:

| Tier | Source | Needs |
|---|---|---|
| `observed` | the subject's own public surface | ≥1 source |
| `comparative` | a named peer | ≥1 source, and a peer name |
| `hypothesis` | inference | declared blanks; may have no source |

`angle` is orthogonal: `opportunity`, `threat`, or `context`. The same peer
launch is a threat in a category they compete in and an opportunity in one
nobody has entered.

## Coverage — when *not* to send

Research quality varies enormously by target. A company with docs, a changelog
and real careers pages yields a strong report; a 40-person shop with a five-page
brochure site does not. **Sending a thin report to a good prospect is worse than
sending nothing.**

So every run is scored against minimums in `COVERAGE_MINIMUMS`. Below threshold,
the run routes to "let's just talk" instead of sending. Those thresholds are
guesses until we've run this against real targets — expect to tune them.

## Pipeline

Each stage writes JSON into `runs/<domain>/<runId>/`, and later stages read
those files rather than calling earlier stages. Any stage can be re-run alone.

| Stage | Tool | Output | Where it breaks |
|---|---|---|---|
| 01 subject | Firecrawl | their surface: docs, careers, pricing, integrations | thin marketing sites yield little |
| 02 peers | **Exa find-similar** | 5–8 named peers | **make-or-break** — wrong list, worthless report |
| 03 peer evidence | Firecrawl + Perplexity | dated, sourced AI moves | Perplexity summarizes; keep the citation or drop the claim |
| 04 demand | DataForSEO | category demand, terms peers rank for | stale by default — stamp the pull date |
| 05 assemble | none | `report.md` | deterministic, no network, no model |

**Stage 01's highest-yield targets** are the ones that describe operations
rather than marketing: the help center (a published description of their manual
workflows), careers pages (what they're building and can't hire for),
integrations pages (their systems of record), and pricing pages (where the human
steps are).

Stage 05 is pure arrangement. The model's job is upstream — turning crawled
pages into sourced claims. It never writes a figure into the document.

### Caching

Every raw API response is cached to `cache/`, keyed by a hash of the request.
Re-running assembly never re-fetches, so iterating on the report costs nothing
after the first run. The cache doubles as the provenance trail when a claim is
challenged.

Pass `--refresh` to bypass reads for a stage whose freshness matters.

## Credentials

See `.env.example`. **Prefer setting these as environment variables on the
Claude Code environment** rather than pasting them into a chat — a transcript is
a bad place for a live key.

DataForSEO uses basic auth (login + password), not a single token.

`EXPOSURE_RUN_BUDGET_USD` caps per-run spend; the pipeline aborts rather than
exceeding it.

## Status

**Working and tested:** the claim model and validator, coverage scoring, the
cache, run artifacts, and stage 05 assembly. `npm test` covers all of it.

**Not built yet:** stages 01–04. They need credentials, and their request and
response shapes should be written against the live APIs rather than from
memory — guessing them is how you get code that looks right and isn't.

**Not decided yet:** whether reports send automatically. Ship with a human read
before every send; drop the gate after 20 consecutive reports with zero
fabricated figures. That review period is the long pole here, not the code.

## Robots and rate limits

This runs unattended, once per form submission. Respect `robots.txt` and
per-host rate limits from the start rather than retrofitting them — cheaper than
getting a crawler blocked.
