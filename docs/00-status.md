# Current status

*Last updated 2026-09-03.*

> **The free offer was re-cut on 2026-08-31, after the team landed on its intent.** The page
> now leads with the 45-minute session; shortly after the call the lead gets a report of the
> **one big thing** we would build — what, why now, what we would refuse, what we could not
> see — with every claim traced to a source. The multi-section brief is retired. Two
> specimens set the shape: BetterRX (delivery-time prediction in the order screen, on the
> back of CMS HOPE's two-day symptom clock) and Cultivate Advisors (an advisor-facing memory
> over 2,000 engagements, against a $29/month white-label AI-coach market). The pipeline now
> generates that shape: stage 07 lays out three or four builds and picks one, the research report prints to PDF with
> a claim register, and the email draft is footnoted to it.
>
> **Scoring is retired from the live flow.** Revenue and stage are no longer asked. Every lead
> is researched, every lead sees the calendar, and the team decides from the alert. The model
> stays in `qualifier.ts` and `06` §5 as the record, not as a gate.
>
> **Flow:** lead lands → Slack alert → (auto-run, when `EXPOSURE_AUTORUN` is on) research
> runs → the report PDF and an email draft post to Slack → a person reviews both, edits the
> draft, sends. The visitor answers the questions, then books on the confirmation screen.
>
> **The site is deployed** (`sites/reality-check/`, Vercel, SeeSaw-owned) with the calendar
> wired (`PUBLIC_CAL_LINK`), Slack and Resend live, and one-click runs from Slack working.
> Still open: the logo, the OG image, a legal read of the privacy policy, and regenerating
> `/sample-brief` in the new one-big-thing format. `04-offer-project-plan.md` (the paid
> Roadmap) is unchanged and still awaits alignment.

| | |
|---|---|
| Audit + plan delivered | 2026-07-22 (v2, after a same-day refinement round) |
| Condensed version written for Jeff | 2026-08-05 |
| Committed to this repo | 2026-08-17 |
| **Status** | **Awaiting the positioning decision with Jeff. Everything else blocks on it.** |
| Not yet started | Case-study rebuilds, Roadmap offer page, Anthropic Select application, fractional growth hire |

**Two things to handle:**

1. **Re-pull the keyword data before spending on SEO.** The competitive and positioning
   findings hold, but the DataForSEO volumes, difficulties, and CPCs in the audit were pulled
   2026-07-22 and are now ~4 weeks stale.
2. **Decision #1 (positioning) is the critical path.** It has been open since Jul 22 and
   blocks all six other workstreams. If that conversation hasn't happened, that's the whole
   bottleneck — not the case studies.

**Source inputs behind all of this:** full crawl of seesawlabs.com, DataForSEO
keyword/traffic/backlink data (US), teardown of 5 competitor sites, and market research on
the 2025-26 AI shift in the agency market. Stated constraints: $10-25k/mo marketing budget,
open to a fractional marketing hire, historical leads from referrals + inbound + directories.

**Company context:** SeeSaw Labs is a product design and build studio — small FTE team plus
a contractor network, shipping software as a combined product + design + engineering team.
~$3.5M growing toward $5M. Strategic goals: escape the one-big-client concentration problem,
avoid absorbing endless small jobs, and diversify into owned SaaS products. Does staff aug,
actively trying to do less of it.

## Workstream state

| Workstream | Owner | State |
|---|---|---|
| Positioning & messaging hierarchy | Jeff + Calvin | **Open — blocks everything below** |
| Case-study rebuild (6, metric-led) | Calvin | Not started |
| Website rebuild (7 items) | Calvin | Not started |
| The offer as a product (Roadmap page + booking flow) | Calvin | **Plan drafted — awaiting team alignment** |
| The free offer (45-min session + the one-big-thing report) | Calvin | **Re-cut 2026-08-31. Page, intake and alert shipped; pipeline output being repointed to the two-doc shape** |
| └ Intake form | Calvin | **Re-cut 2026-09-02: name, work email, website, role, and three open questions (what changed, where time burns, what was tried or ruled out). Company, category and competitors are inferred from the site. Scoring retired — see `06` §5 note** |
| └ Interview guide | Calvin | **Written. Includes 8 outlier branches + fit rubric. Needs a pass against the one-big-thing agenda** |
| └ Website build (page, form, scheduler) | Calvin | **Deployed on Vercel (SeeSaw-owned), Astro. Calendar wired via Cal.com embed, single host** |
| └ Research pipeline (`tools/exposure`) | Calvin | **Runs end to end in GitHub Actions from a Slack click, auto-run, or a `cold` dispatch. Measured 2026-09-04: $1.78 local, $2.84 in Actions on a cold cache, 11–13 min. First cold Actions run: compassus.com, run #7, green, coverage 100%. A lead arriving through `/api/intake` end to end is still untested** |
| └ ─ Two-doc output (report PDF + email draft) | Calvin | **Built 2026-09-02, five rules added 2026-09-03 (see `tools/exposure/README.md`): email cites Verified claims only; buyer fit per peer; every cited URL re-fetched and photographed; the fork is a first-page field that must fork; a null verdict with its own template. Tested on the Cultivate run; first end-to-end run from a fresh lead still to do** |
| └ ─ `/one-thing` skill (run + review from any teammate's machine via `gh`) | Calvin | **Built 2026-09-04 in `.claude/skills/one-thing/`. Cold-outreach first, and from 2026-09-04 the required inputs are just the domain and the recipient's name and role; category and why-now are optional overrides. Drives the Actions runner in mode `cold`; keys stay in Actions secrets; `review.mjs` prints the send gate. Dispatch path not yet exercised by a teammate** |
| └ ─ Peer discovery at the right size | Calvin | **2026-09-04: `find-similar` cut after seven targets and zero surviving peers. Stage 01 now derives a footprint clause from their location pages (33 states for Compassus) and appends it to the category query, which pulled VITAS and LHC Group into a pool that had none. Measured: the phrasing that actually returns same-size operators names scale *and* ownership, which no crawl can know, so `--category` is now the recommended input for any multi-location target and stage 02 asks for it** |
| └ ─ Target evidence (stage 03b) + the LinkedIn messages | Calvin | **Built and run end to end in Actions 2026-09-04 (compassus.com, $2.84, 12m53s, coverage 100%). The pipeline finds the dated reason to write from the domain alone: their own news, press and blog pages (read by us, Verified, the only openers a message may use) plus a citation-resolved search and a date-filtered news index (Cited, call material). Stage 07 now writes the LinkedIn connection note (≤300 chars) and first message (300–900), validated on the pasted text with claim ids stripped; Slack posts them paste-ready. No dated Verified opener blocks the send. The audience is recorded in `00-meta.json` so the review gate and the Slack release see a cold run started from a URL alone** |
| └ ─ Landing page + intake (site root) | Calvin | **Leads with the session. `/reality-check`, `/book`, `/brief` and `/sample` are redirects** |
| └ ─ Public sample (`/sample-brief`) | Calvin | **Old multi-section format. Regenerate in the one-big-thing shape before linking it again** |
| └ ─ Emails | Calvin | **Ack rewritten for the new offer (booked-first variant). Resend live in Vercel** |
| └ ─ Magic link + report store | Calvin | **Vercel Blob in production; HMAC-named objects; used by the revise loop** |
| └ ─ Booking | Calvin | **Live. Cal.com single-host event on the confirmation screen** |
| └ Program breakdown (11 projects) | Calvin | **Outlined. Awaiting owner + capacity assignment** |
| Internal AI-ops case study | Calvin | Not started |
| Anthropic Select application | Calvin | Not started |
| Monthly targeting playbook | Calvin | Defined, not yet running as a cadence |
| Referral systematization | Jeff | Not started — top 10 targets named |
| Founder LinkedIn | Jeff + Calvin | Not started |
| Austin events & exec dinners | Jeff | Not started |
| Fractional growth hire | Jeff | Not started |
