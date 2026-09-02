# The research pipeline — generation scripts

Scripts that research a company from public evidence and produce the two
documents the free offer promises (re-cut 2026-08-31, see `docs/00-status.md`):

- **The research report** (`research-report.html`, printed to `.pdf`): the
  three or four builds we weighed, the one we recommend and why it won, what we
  would refuse, the fork we could not see from outside, what comparable
  companies did, and a
  **claim register** where every claim carries an id, a source URL, the date we
  read it and how we know it. Every citation in the prose is an id that points
  at a row.
- **The email draft** (`email-draft.md`): the same recommendation in about
  three hundred words, footnoted to the register. A person edits and sends it.

Both come out of stage 07 over the validated claims and the stage 06 analysis.
Nothing is sent automatically; the workflow posts both to Slack.

```bash
npm test                        # no network, no credentials
npm run prototype               # assemble the fixture -> stdout + runs/
npm run report -- <domain>      # full pipeline, stages 01-07 (needs credentials)
npm run onething -- <domain>    # re-run stage 07 on an existing run (one model call)
npm run revise -- <domain> --notes "..."   # rewrite 06 and 07 against notes
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
| 06 analysis | Claude | `06-synthesis.json` | every figure checked against the claims it cites; the industry brief is judgement, not evidence |
| 07 the one thing | Claude | `07-one-thing.json`, `research-report.html/.pdf`, `email-draft.md` | three or four candidate builds, one picked and argued against the others; one refusal; one fork. Unsourced figures are redacted to a visible marker, never rendered |

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

### The evidence ledger

`evidence/<peer-domain>.json` holds every peer finding we have ever accepted,
and it is **committed**, unlike `cache/` and `runs/`.

It exists because stage 03 asks a live search index one question per peer, and
the answer moves. The same peer set returned two dated AI moves on one run and
none an hour later — coverage went 100% → 80%, which is the difference between
a brief we send and one we route to a call, decided by nothing that happened in
the world.

Every item in the ledger is a **dated past event with a citation**. A dated
event does not stop having happened because a search index ranked it lower
today, so findings accumulate: what was accepted once stays accepted, and a
re-run can add to a brief but never silently subtract from it. Findings are
keyed by source URL rather than by wording, so a re-run that describes the same
announcement differently recognises it instead of storing a near-duplicate —
and the reader keeps the sentence they already read.

This lowers no bar. Items enter only by passing every gate in stage 03:
attribution, an action verb, a citation, a source date, no year mismatch. When a
run leans on the ledger it says so in its notes, with the count.

Perplexity is also called at `temperature: 0`, which removes the half of the
variance that was ours. The index moving under us is the half the ledger covers.

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

**Decided 2026-08-31:** nothing is sent automatically. The research runs on
its own when a lead lands; the report PDF and the email draft post to Slack; a
person reads both and sends the email by hand. The web brief and its magic
link still exist for the long-form view, and `send` still works, but the
offer no longer uses it.

**Stage 07 status.** Tested against the Cultivate Advisors run of 2026-08-25
(one model call, about $0.16, the recommendation validated with no redactions).
Not yet run end to end from a fresh lead in GitHub Actions; that is the next
live test, at roughly $2.

## What a run costs

Measured, not estimated, except where the API refuses to say. Three services
report dollars per call and the ledger uses their figures; Firecrawl reports
credits only, so its line is always labelled an estimate at a configured rate.

A full run on a mid-size site costs roughly **$1.40–$2.10**: the research
stages are cents, and the three model calls (industry research with web
search, the analysis, the one thing) are the rest. Re-running the same domain
is free apart from the stages you pass `--refresh` to, and `onething` re-picks
the recommendation for about $0.16. `EXPOSURE_RUN_BUDGET_USD` caps a run and
the pipeline aborts rather than exceeding the cap.

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
  --no-synthesis       skip stage 06 (and therefore 07)
  --no-one-thing       skip stage 07
  --name "..."         the recipient, for the email draft's salutation
  --quiet              don't print the report to stdout
```

The PDF is printed through whatever Chrome the machine has (`CHROME_BIN`
overrides the search). No Chrome means no PDF and a note in the run; the HTML
and the email draft are still written.

A stage that cannot run degrades the report and says so, rather than aborting
the run — four good stages and one honest gap beats nothing. Stage 01 is the
exception: with no subject crawl there is no report.

## Robots and rate limits

This runs unattended, once per form submission. Respect `robots.txt` and
per-host rate limits from the start rather than retrofitting them — cheaper than
getting a crawler blocked.
