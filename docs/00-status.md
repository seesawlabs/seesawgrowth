# Current status

*Last updated 2026-09-08.*

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

## Tracked work

Execution is now tracked in GitHub issues, starting 2026-09-09:

| # | Issue | Blocks / depends |
|---|---|---|
| [#2](https://github.com/seesawlabs/seesawgrowth/issues/2) | Export LinkedIn connections and build the connection-mapping script | Prerequisite for every named-account issue |
| [#3](https://github.com/seesawlabs/seesawgrowth/issues/3) | Strive Health: run the account motion end to end (pilot) | Depends on #2 for the connection check; the template for every other Tier A account |
| [#4](https://github.com/seesawlabs/seesawgrowth/issues/4) | Price the borrowed-list channels: Arrowfly, NRAA, NASP | Independent — pricing is not publishing, so it does not wait on Decision #1 |
| [#5](https://github.com/seesawlabs/seesawgrowth/issues/5) | Assured Senior Living: conversation with Francis and Brian | Independent and warm — the only door needing no cold opener |
| [#6](https://github.com/seesawlabs/seesawgrowth/issues/6) | Revelstoke Frontier: Max Delahanty and Wade Lowder | Depends on #2 for the connection check; one relationship reaching a dozen ICP companies |
| [#7](https://github.com/seesawlabs/seesawgrowth/issues/7) | Prime Health: join, and get on the 2027 Innovation Challenge judge list | Independent — timing-sensitive, the 2026 window has closed |
| [#8](https://github.com/seesawlabs/seesawgrowth/issues/8) | Re-verify the design-partner list in `03` — the Fuego UX drift probably isn't isolated | Independent — Slide UX is #5 in the `03` top ten and needs checking first |

### The Tier A ten — one issue each

Every account in `11` §2 Tier A now has its own issue. All depend on [#2](https://github.com/seesawlabs/seesawgrowth/issues/2) for the connection check; [#3](https://github.com/seesawlabs/seesawgrowth/issues/3) is the pilot whose five steps the rest reuse.

| # | Account | The angle |
|---|---|---|
| [#3](https://github.com/seesawlabs/seesawgrowth/issues/3) | Strive Health | Closest match to the Rendevor proof. Pilot of the repeatable motion |
| [#10](https://github.com/seesawlabs/seesawgrowth/issues/10) | Care Synergy | Shared back office over seven affiliates — one engagement reaches all. Qualify budget hard |
| [#11](https://github.com/seesawlabs/seesawgrowth/issues/11) | DispatchHealth | The 2026-07-31 B2B pivot — a platform being repositioned as a product |
| [#12](https://github.com/seesawlabs/seesawgrowth/issues/12) | SonderMind | Two doors: the FDA TEMPO app, or the 16k-provider network |
| [#13](https://github.com/seesawlabs/seesawgrowth/issues/13) | Carina Health Network | Innovaccer across 400 sites in March — the textbook adjacent-workflow opener |
| [#14](https://github.com/seesawlabs/seesawgrowth/issues/14) | Colorado Access | Prior auth. Where the HPS 5x number needs no translation |
| [#15](https://github.com/seesawlabs/seesawgrowth/issues/15) | Swisslog Healthcare | Dual-use. Verify where the roadmap is owned before spending pursuit time |
| [#16](https://github.com/seesawlabs/seesawgrowth/issues/16) | InnovAge | PACE, public company. Slower procurement — plan for it |
| [#17](https://github.com/seesawlabs/seesawgrowth/issues/17) | nVoq | Dual-use, partner read preferred. Warm and local |
| [#18](https://github.com/seesawlabs/seesawgrowth/issues/18) | The Care Team | Route through Revelstoke ([#6](https://github.com/seesawlabs/seesawgrowth/issues/6)), not the front door |

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
| Colorado ABM list (`11-colorado-targeting-report.md`) | Calvin | **Written 2026-09-08 with Firecrawl, Exa, Perplexity and DataForSEO. 24 named accounts, Colorado referral partners, and an outreach angle the Texas list doesn't have: SB 26-189 replaced the Colorado AI Act on 2026-05-14 and its ADMT duties (notice, 30-day adverse-outcome explanation, meaningful human review) land 2027-01-01 as interface work. Top door is Revelstoke Capital (Denver healthcare PE) whose Revelstoke Frontier AI programme launched 2026-06. Best hospice target is Care Synergy, a Denver shared-back-office network over seven affiliates, which only semantic search surfaced** |
| └ Partner-channel expansion | Calvin | **Added 2026-09-08 to `11` §3: marketing/brand agencies assessed and mostly rejected (wrong budget, wrong buyer, feeds the small-jobs problem) with Cactus the one exception, and partly competitive since it created Grit Digital Health. The recommended category instead is platform partner programmes — Innovaccer Gravity, already live at both Carina and Colorado Access, explicitly monetises partner IP through a marketplace, which is a product distribution channel rather than a referral one. Rocky Mountain implementation partners for Innovaccer, MatrixCare and Epic still need naming** |
| └ Correction to `03` | Calvin | **`03` §2 lists Fuego UX as a design/UX-only studio. As of 2026-09-08 their services page advertises development — they are competitive, not a referral partner. The same drift may affect other design-partner names in `03`; that list needs a re-verification pass by reading services pages rather than directory listings** |
| └ LinkedIn connection mapping | Calvin | **Blocked on Calvin's LinkedIn `Connections.csv` export (Settings → Data Privacy → Get a copy of your data). Scraping is off the table; the export is first-degree only, so second-degree paths need Sales Navigator or a manual pass. Script not yet written — see `11` §5** |
| Research MCP servers (`.mcp.json`) | Calvin | **Added 2026-09-08. Firecrawl, Exa, Perplexity and DataForSEO were configured as project MCP servers reading the API keys already present in the environment. Before this the keys were set but no server was declared, so every session silently fell back to plain web search. Config holds `${VAR}` references only, no secrets** |
| Content, events & programmes (`12-content-and-events-plan.md`) | Jeff + Calvin | **Written 2026-09-08. Recommends borrowed distribution over owned content. Top item is a sponsored Hospice News / HHCN webinar — their published averages are ~125 registrants for a product-focused session at 30-40% live attendance, and the registrant list feeds the LinkedIn motion in `11`. Second is judging the Prime Health Innovation Challenge rather than running a competition (2026 judge applications closed; target the 2027 April-October cycle). Roundtables co-hosted with Revelstoke or vcfo are the highest-conversion owned format. Booking and applications can start before Decision #1; publishing cannot** |
| └ Sector selection for borrowed lists | Calvin | **Added 2026-09-08 to `12` §2.4. The test is whether a list's audience owns care operations, not whether the sector is in the wedge. Dialysis is in the wedge but its obvious channels (ASN, NKF, RPA, Annual Dialysis Conference) are clinical — the operator channels are NRAA/Renal Healthcare Association and Renal Exchange. Specialty pharmacy operator channel is NASP. Wearables fail all filters; the defensible adjacent is remote-monitoring workflow sold through care-ops channels. Arrowfly (ex-Aging Media, ex-WTWH) owns four adjacent ICP titles — negotiate as a portfolio** |
| └ Giving away build hours | Calvin | **Recommended against in the stated form — selects for companies without budget and prices the pod down. Award the paid Roadmap (`04`) instead, inside Prime Health's competition rather than an in-house one. See `12` §5** |
| Assured meeting brief (`13`) | Calvin | **Written 2026-09-16 for a 09-17 meeting with Turner and LeGasse. Core frame: they run two businesses — private-pay AL/memory care where rate moves with inflation, and TBI supported living on Colorado's Medicaid BI waiver where HCPF sets the rate and efficiency is the only lever. One-big-thing hypothesis is the BI-waiver documentation and service-plan burden across 30+ scattered homes, with the payer mix as the fork. Also flags SB 26-189's 2027-01-01 ADMT duties, which no vendor is raising with operators. Hand-built: the `/one-thing` dispatch is blocked on token scope** |
| Assured one-thing report (`14`) | Calvin | **Written 2026-09-16 across all four research tools called directly, since the Actions dispatch is blocked. The one big thing: make the individualised care plan a living artifact that survives shift change, new hires and the distance between houses. Supersedes `13` §6 — their own pages put TBI at only two communities, so the BI-waiver burden is the acute case, not the main lever. Fork is knowledge-transfer versus compliance-evidence. Carries a hand-built claim register; every numeral tiered V/C/T/K or not stated** |
| └ `/one-thing` dispatch blocked | Calvin | **`SEESAW_DISPATCH_TOKEN` holds Actions: Read, not Read and write, so runs 403. A separate transport bug was found and fixed in the same pass — the curl path never sent `Content-Type: application/json`, so every token dispatch returned 415 and the token path had never worked. Fallback is the workflow's Run workflow form** |
| Ally Medical (warm, `03` §3) | Calvin + Jeff | **Added 2026-09-09, [#20](https://github.com/seesawlabs/seesawgrowth/issues/20). Calvin worked with CEO Emmanuel Colliot in Austin. Physician-owned freestanding ER operator, 8 Austin sites plus DFW and Houston, mid-expansion (Cedar Park 2026-06-30, Liberty Hill announced for winter). Recorded as a relationship-sourced account, not a wedge one — ER is acute and episodic and none of the four proof points maps. The transferable thread is billing and prior auth, which is the same shape as the HPS 5x win. First task is verifying whether technology decisions sit in Austin or at parent USA Emergency Centers — the Guardian Pharmacy trap** |
| Assured Senior Living (warm, `11` §3) | Calvin + Jeff | **Added 2026-09-08. Founders Brian Turner and Francis LeGasse Jr. are known to Calvin. 30+ residential homes across Denver metro — assisted living, memory care and TBI supportive living. Three asks in order: (1) their pharmacy, hospice and home-health partners, which map onto Guardian, Care Synergy, Bristol and InnovAge on the target list; (2) a slot on LeGasse's podcast — he is an AgeTech thought leader and NIC speaker, so this is borrowed distribution inside a friendship; (3) a small instrumented build published as the metric-led case study, since they are already a public reference for Serenity Engage. Do not lead with a pod pitch** |
| Referral systematization | Jeff | Not started — top 10 targets named |
| Founder LinkedIn | Jeff + Calvin | Not started — Colorado target list and three openers now drafted in `11` §4 |
| Austin events & exec dinners | Jeff | Not started — format, co-hosts and topics now specified in `12` §3.1. HHCN FUTURE (Austin, late Aug) and the Denver ASCN event are 2027 planning items; both 2026 editions have passed |
| Fractional growth hire | Jeff | Not started |
