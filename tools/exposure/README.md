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
| 04 demand | DataForSEO Labs | category demand, terms peers rank for | stale by default — stamp *both* dates, ours and Google's |
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

**Working and tested:** the whole pipeline, stages 01–05, end to end. Every
API's request and response shape was written against a live probe rather than
from memory, and the probe dates are in each client's header comment.
`npm test` is 62 tests, no network, no credentials.

Run against three real targets on 2026-08-24 — a known account, a cold
prospect, and a deliberately thin one. Six defects that only a live run
exposes were found and fixed, each now pinned by a test:

| What broke | Why it mattered |
|---|---|
| `cacheKey` dropped every nested field | Six Perplexity prompts hashed to one key; five peers were served the first peer's answer, reported as a cache saving |
| `lib/budget.ts` could not be imported | Constructor parameter properties are rejected by node's strip-only mode, so the cost ledger had never executed |
| Absence of evidence rendered as a threat | "…do not show dated published AI/ML/automation initiatives" passed every gate: real peer, three real dated URLs, contains "automation" |
| A redirect broke homepage selection | `traditionshealth.com` 301s to `tct-cares.com`, so the category query fell through to contact-page boilerplate and peer discovery returned answering services |
| The geography filter used a ccTLD denylist | `bluewater.ky` was kept as a peer for a US distributor. Inverted to a generic-TLD allowlist |
| Product menus quoted as prose | "Tenaculum Hooks Uterine Sounds Forceps…" rendered as a description of a manual step |

**Known weaknesses, not yet fixed.** These are visible in the artifacts rather
than hidden, which is the point of logging every rejection:

- **`find-similar` has never contributed a peer.** Across all three targets it
  returned 45 results and 45 were filtered out. It is currently pure cost. Keep
  it one more batch of targets, then cut it if the pattern holds.
- **The off-category filter passes near-neighbours.** It rejects only *zero*
  lexical overlap, so a laundry service that supplies medical facilities
  survives a medical-supply search. Zero overlap is the only threshold that
  doesn't need tuning per category; a better filter needs a real signal, not a
  higher word count.
- **`systemsNamed` has false positives.** "Workday" matched on a page where it
  was almost certainly a careers-page footer, not a system of record.
- **DataForSEO volumes for long-tail clinical terms look inflated** — 201,000
  US searches a month for "manual vacuum aspirator" is not credible. We report
  what the API reports, with the source and both dates attached, but do not
  lead with a figure like that in front of a clinician.

**Not decided yet:** whether reports send automatically. Ship with a human read
before every send; drop the gate after 20 consecutive reports with zero
fabricated figures. That review period is the long pole here, not the code.

## What a run costs

Measured, not estimated, except where the API refuses to say. Three services
report dollars per call and the ledger uses their figures; Firecrawl reports
credits only, so its line is always labelled an estimate at a configured rate.

A full five-stage run on a mid-size site costs roughly **$0.15–$0.20**, and
re-running the same domain is free apart from the stages you pass `--refresh`
to. `EXPOSURE_RUN_BUDGET_USD` caps it and the pipeline aborts rather than
exceeding the cap.

## Flags

```
npm run report -- <domain> [flags]

  --refresh            bypass cache reads (still writes)
  --trigger "..."      what the prospect said is driving this
  --category "..."     override the derived category query — stage 02's input,
                       and the single highest-leverage override there is
  --budget <usd>       override EXPOSURE_RUN_BUDGET_USD
  --peers <n>          how many peers to research in stage 03
  --no-peer-crawl      skip crawling peers' own sites
  --quiet              don't print the report to stdout
```

A stage that cannot run degrades the report and says so, rather than aborting
the run — four good stages and one honest gap beats nothing. Stage 01 is the
exception: with no subject crawl there is no report.

## Robots and rate limits

This runs unattended, once per form submission. Respect `robots.txt` and
per-host rate limits from the start rather than retrofitting them — cheaper than
getting a crawler blocked.
