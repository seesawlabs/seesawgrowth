# Assured Senior Living — meeting brief

*Prepared 2026-09-16 for a meeting with Brian Turner and Francis LeGasse Jr. Research
pulled 2026-09-16 with Firecrawl and Perplexity.*

> **Superseded in one place.** `14-assured-one-thing-report.md` runs the full research
> across all four tools and **replaces the one-big-thing hypothesis in §6 below.** Their own
> pages show TBI at only two communities, so the BI-waiver documentation burden is an acute
> case rather than the main lever. §1-§5 and §7 here still stand; read `14` for the build.

> **This is hand-built analysis, not a `/one-thing` pipeline run.** The dispatch is blocked
> on a token permission — see §8. The pipeline would add source-traced claim validation and
> a formal verdict; everything below is sourced and dated, but it has not been through
> `validateClaim()`. Treat the §6 hypothesis as a hypothesis to test in the room, not a
> finding.

## 1. The company, refreshed

Residential **small-home** operator across the Denver metro — Arvada, Castle Rock,
Centennial, Denver, Englewood, Lakewood, Littleton, Parker. Three lines: **assisted
living**, **memory care**, and **traumatic brain injury supportive living**. Founders and
managing partners **Brian Turner** (acquired the business December 2017) and **Francis
LeGasse Jr.**; Stephanie Wood is COO.

LeGasse's NIC speaker bio describes **30+ homes** and **1:4 staffing ratios**, and calls
Assured "Colorado's largest privately held residential assisted-living provider." That is
his own phrasing — treat it as self-description, not an audited figure.

**They are publishing actively.** Their blog carried posts on **2026-09-16**
("Personalized Senior Care Plans That Truly Fit Each Resident") and **2026-09-14**
("Family Education That Strengthens Care Collaboration"). Both themes — individualised
care planning, and family collaboration — are worth reading before you walk in. They are
telling you what is on their mind.

**Known technology:** Serenity Engage for family communication, with a published customer
success story. Lument (the ORIX seniors-housing lender) has featured the company. They are
demonstrably willing to be a public reference.

## 2. The industry, in numbers you can use

All figures national unless noted, and none specific to small-home operators.

| | |
|---|---|
| Assisted living occupancy | **87.9%**, Q1 2026 (NIC); senior housing overall 89.5% |
| AL base rent growth | **7.1–7.8%** in 2025, down from a **10.8%** peak in 2024 (Senior Housing News, 2025-04-23) |
| Memory care rent growth | **6.5–7.3%** in 2025, from **11.5%** in 2024 (same) |
| National median AL cost | **$70,800/yr (~$5,900/mo)**, up 10% in 2024 (Genworth/CareScout, 2025-03-04) |
| **Colorado CNA wage** | **$23.39/hr** in 2024 — among the highest in the country, against a national AL median of **$18.71** (McKnight's, 2025-01-29) |
| Frontline turnover | Resident/personal care assistants **47.1%**, CNAs **41.8%**, med aides **34.6%** (McKnight's, 2024-04-25) |

**The read:** demand and pricing power are strong, but the spread is tight and Colorado is
a high-wage state. Rate growth has roughly halved from its 2024 peak while wages stay
elevated. For a 1:4 staffing model the labour line is not a cost centre, it is the product
— which means efficiency gains have to come from *time given back to caregivers*, not from
thinning the roster.

## 3. The part most people miss: they run two different businesses

This is the most useful frame you can bring, and it is where the interesting problem
lives.

**Line A — private-pay assisted living and memory care.** Margin comes from rate and
occupancy. You can price against inflation. Documentation is governed by Colorado's
assisted living residence rules (6 CCR 1011-1 Chapter 7) and is comparatively light.

**Line B — TBI supportive living, funded largely through Colorado's Medicaid Brain Injury
(BI) HCBS waiver.** Completely different economics:

- **Eligibility:** 16+, brain injury before the 65th birthday, hospital or
  nursing-facility level of care, income under 300% of SSI, countable resources under
  $2,000 single / $3,000 married (HCPF, page updated 2026-02-16).
- **Covered residential services** include **Supported Living Program** and **Transitional
  Living Program** — statutorily mandated by C.R.S. §25.5-6-704(2)(b).
- **The rate is set by the state.** HCPF publishes fee schedules (the current one is the
  *EBD/CMHS/BI/CIH October 2025-2026 Rate Schedule v1.2*). **You cannot raise it.**
- The compliance load is much heavier: assessment, service planning, critical incident
  reporting, utilisation review.

**Why this matters.** In Line B, Colorado's high wages come straight out of margin with no
pricing lever to offset them. Efficiency and documentation accuracy are the *only* levers.
That is a structurally different problem from the one every senior-living vendor is
selling into.

**Three live Colorado changes worth raising** — all in flight, all hitting Line B:

- **Case Management Redesign** — HCPF's restructuring of HCBS case management.
- **Community First Choice / HCBS waiver rate alignment** (HCPF OM 25-040) — would
  restructure how personal care is delivered and paid.
- **2026 1915(c) waiver amendments** (HCPF IM 25-028), out for public notice.

`(verify)` the current status of each before the meeting if you want to lead with one;
these move quarterly.

## 4. AI in senior living: what is real, what is oversold

### Real and deployed

**Fall detection and passive monitoring is the only genuinely mature category.** And it
just moved:

- **ALIS × Inspiren integration announced 2026-08-04.** ALIS is a dominant assisted-living
  operations platform; Inspiren does AI fall safety and passive resident monitoring.
  Verified fall events now surface in the resident record in real time, so staff respond
  and document without leaving ALIS.
- **SafelyYou** sells AI fall reduction explicitly on length-of-stay and NOI.
- Vision-AI systems (e.g. VCare) are installed in AL and memory care rooms and common
  areas, auto-logging detected falls into the EHR.

**The honest caveat:** most outcome evidence is vendor-published. Independent data that
these tools reduce hospitalisations is thin.

### Oversold, and this is the gap

**Ambient AI documentation is not built for assisted living.** The mature vendors —
Abridge, Ambience, Suki, Nabla, DeepScribe, Microsoft DAX — target health systems and
ambulatory clinicians. The post-acute specialists (Lime Health, Andy, AutoMynd, Enzo
Scribe) target **OASIS and HOPE**, which are home health and hospice instruments.

**Nobody is building ambient documentation for what a caregiver in a small home actually
does** — ADL support, behaviour notes, med pass — let alone for BI-waiver service plans
and critical incident reporting. Evidence of ambient documentation deployed inside
mainstream AL platforms is limited to pilots and vendor marketing.

That is not a small gap. It is the centre of §6.

### Coming at them sideways, and nobody is telling them

**Colorado SB 26-189 takes effect 2027-01-01.** It replaced the Colorado AI Act on
2026-05-14 and narrows to *automated decision-making technology that materially influences
consequential decisions*. If Assured deploys AI that shapes a decision about a resident —
care level, admission, discharge, risk flagging — the duties are: **clear notice**, an
**explanation of an adverse outcome within 30 days**, **consumer access to and correction
of** the personal data used, and **meaningful human review by a designated trained person
with authority to override**.

Most operators have not connected this to the monitoring tools they are being sold. It is
a genuinely useful thing to raise, and it costs you nothing to be the one who does. **Do
not present it as legal advice** — much published commentary still describes the repealed,
broader SB 24-205, and it needs a real legal read.

## 5. What goes wrong with these deployments

Worth knowing so you can ask about it rather than pitch past it: per-room hardware across
**30+ scattered homes** is a very different capital and installation problem from one
120-unit campus, and the ROI cases vendors publish are built on large-campus NOI maths. A
small-home operator at 1:4 staffing may already catch what a camera would catch — which
makes the value question honest rather than rhetorical.

## 6. The one big thing — hypothesis, to test in the room

**The BI-waiver documentation and service-plan burden, across scattered small homes.**

Why this and not fall detection or family communication:

1. **It is the only line where efficiency is the sole lever.** Private-pay rates can move
   with inflation; the HCPF fee schedule cannot.
2. **No vendor will ever build it.** Ambient tools chase health systems and OASIS/HOPE. AL
   platforms chase private-pay operations. BI-waiver supported living in one state is too
   small a market for any of them — which is exactly why it is a build, not a buy.
3. **Errors are expensive.** Utilisation review and critical incident reporting are
   compliance-critical; this is not a convenience problem.
4. **Thirty-plus scattered sites multiply it.** Every coordination cost is paid 30 times.
5. **It is differentiating for them.** Very few operators run TBI supported living at all.

### The fork — the question whose answer changes what you would build

**How much of the TBI census is BI-waiver Medicaid versus privately funded?**

- **Mostly waiver** → the build is the documentation and service-plan layer: structured
  capture at the point of care, service-plan generation against waiver requirements,
  incident reporting, and an audit trail that survives utilisation review.
- **Mostly private or other funding** → the compliance driver disappears and the real
  problem is cross-site staffing coordination and family communication. Different build
  entirely.

If the fork does not fork in conversation, the hypothesis is wrong and you should drop it
rather than defend it.

## 7. Questions worth asking

**On the business**
1. How does the TBI line break down by payer, and how has that mix moved?
2. Where does a house manager's time actually go on a bad day?
3. What does onboarding a new caregiver cost you in weeks to competence, at 1:4?
4. What breaks first when you add home number 31?

**On compliance**
5. What does preparing for a BI-waiver utilisation review look like now?
6. How is Case Management Redesign landing for you?
7. Where does documentation get reconstructed after the fact rather than captured in the
   moment?

**On technology**
8. What is Serenity Engage doing well, and where does it stop?
9. Who has pitched you fall detection, and what made you say no?
10. What did you buy that did not stick, and why?

**The one to close on**
11. If you could hand every caregiver back an hour a shift, where would you want that hour
    to go?

## 8. Two housekeeping notes

**The `/one-thing` run did not fire.** The dispatch hit HTTP 415 — a genuine bug, now
fixed: the curl transport never set `Content-Type: application/json`, so the token path
had never worked. With the fix the same call returns 403, which is the honest error for a
token scoped **Actions: Read** rather than **Read and write**. Two ways forward:

- Update `SEESAW_DISPATCH_TOKEN` to Actions: Read and write, and it will run from any
  session.
- Or fire it yourself now from the workflow's own **Run workflow** form: mode `cold`,
  domain `assuredassistedliving.com`, email `unknown@assuredassistedliving.com`, name
  `Francis LeGasse Jr.`, company `assuredassistedliving.com`. Takes about ten minutes and
  posts to Slack.

**Ignore the outreach drafts if you do run it.** The pipeline writes cold-outreach
LinkedIn and email copy, which is wrong for a warm meeting with people you know. The
**report** is the part you want.

## 9. What not to do

Do not walk in with a build proposal. `11` §3 is explicit that the network and the proof
are worth more here than the revenue, and converting a friendship into a sales call is the
fastest way to lose both. The three asks that matter — the vendor rolodex, the podcast
slot, and whether they would be a named proof partner — are in issue #5. **Ask the
questions in §7 and let the build surface on its own terms, or not at all.**
