# Current status

*Last updated 2026-08-18.*

> **In progress:** the offer work. `04-offer-project-plan.md` covers the paid AI Production
> Roadmap ($25k, 3 weeks); `05-reality-check-spec.md` covers the free AI Reality Check that
> feeds it. Neither blocks on the positioning decision — only their copy specificity does.
> Decisions pending: eight in `04` §10, seven in `05` §12.
>
> The free tier was redesigned 2026-08-17: collapsed from "self-serve scorecard + call" into a
> single one-hour call whose transcript plus deep research produces the report. §6 and §7 of
> `04` are superseded accordingly; the scorecard is deferred to v2.
>
> **The Reality Check site is deployed** (`sites/reality-check/`, on Vercel, SeeSaw-owned) and
> in walkthrough. Not launchable yet — the scheduler is unwired, so a qualified visitor reaches
> the auto-book screen and finds a placeholder. That plus the logo, the OG image, and a legal
> read of the privacy policy are the gap. Full list in the site README's pre-launch checklist.

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
| The free offer (analysis + 45-min session, sold as one package) | Calvin | **Built end to end. Deployed; awaiting env vars and the calendar** |
| └ Qualifier form | Calvin | **Now the single intake for the package. Scoring unchanged, still validated against 14 personas** |
| └ Interview guide | Calvin | **Written. Includes 8 outlier branches + fit rubric** |
| └ Website build (page, form, scheduler) | Calvin | **Built and deployed to Vercel (SeeSaw-owned). Stack landed: Astro. Scheduler not yet wired** |
| └ AI Opportunity Brief pipeline | Calvin | **Runs end to end. Named for the client, generated, released, served over a magic link** |
| └ ─ Brief generation (`tools/exposure`) | Calvin | **Working. ~$1.40 and 6–11 min a run. Stage 03 is non-deterministic — same peers, different evidence hours apart** |
| └ ─ Landing page + intake (site root) | Calvin | **One offer, one page. `/reality-check`, `/book`, `/brief` and `/sample` are redirects — see `docs/10-package-plan.md`** |
| └ ─ Public sample (`/sample-brief`) | Calvin | **We ran the brief on ourselves. 100% coverage, published unedited** |
| └ ─ Delivery emails | Calvin | **Written and wired. Nothing sends until `RESEND_TOKEN` is set in Vercel** |
| └ ─ Magic link + report store | Calvin | **Built and verified locally. Prod storage undecided — Vercel Blob is the proposal** |
| └ ─ Booking | Calvin | **Embedded on the confirmation for qualified leads only. Needs a 45-minute `PUBLIC_CAL_LINK`** |
| └ Program breakdown (11 projects) | Calvin | **Outlined. Awaiting owner + capacity assignment** |
| Internal AI-ops case study | Calvin | Not started |
| Anthropic Select application | Calvin | Not started |
| Monthly targeting playbook | Calvin | Defined, not yet running as a cadence |
| Referral systematization | Jeff | Not started — top 10 targets named |
| Founder LinkedIn | Jeff + Calvin | Not started |
| Austin events & exec dinners | Jeff | Not started |
| Fractional growth hire | Jeff | Not started |
