# Assured Senior Living — the one big thing

*Research run 2026-09-16 with Firecrawl (their own pages), Exa (peer discovery),
Perplexity (category evidence) and DataForSEO (market density). Claim register at §7.*

> **How this was produced.** The `/one-thing` GitHub Actions pipeline could not be
> dispatched — `SEESAW_DISPATCH_TOKEN` holds Actions: Read, not Read and write (`13` §8).
> The four research APIs were called directly instead, so the evidence is the same; what is
> missing is the pipeline's automated `validateClaim()` pass and its formal verdict. The
> claim register below was assembled by hand to the same rule: **every numeral carries a
> source and a tier, or it is not stated.** **Tiers.** `V` Verified — read by us on their
> own pages. `C` Cited — third party. `T` Tool data. `K` Category evidence. Only `V` claims
> may open a message.

## 1. What changed, and what they are telling you

**They published on the exact subject of this report, today.** `V1` A blog post dated
**2026-09-16**, *"Personalized Senior Care Plans That Truly Fit Each Resident"*, argues
that rigid plans "fail to account for a resident's subtle changes or evolving
preferences," that assessments are "the vital foundation," and that families participate
throughout. Two days earlier, `V2` **2026-09-14**, *"Family Education That Strengthens
Care Collaboration."*

That is not marketing filler to skim past. Twice in one week they have published on
**keeping an individualised plan current, and keeping families inside it.** When a company
tells you what is on its mind, the useful move is to take it literally.

**The TBI line is narrower than it looks.** `V3` Their brain-injury page (updated
2026-08-12) lists TBI support at exactly **two** communities — Castle Rock and Arvada —
not across the portfolio. `V4` They frame it as "long-term assisted living for traumatic
brain injury… always individualized, never one-size-fits-all," and `V5` the Arvada page
describes a "supportive living program [that] provides strategies tailored to individual
needs."

This **corrects the hypothesis in `13` §6.** That brief proposed the BI-waiver
documentation burden as the one big thing. On the evidence it is real but it is *two
houses out of thirty-plus* — an acute case, not the main lever. §3 replaces it.

## 2. The shape of the business

`C1` 30+ homes and 1:4 staffing ratios, per LeGasse's own NIC bio — his phrasing, not
audited. `V6` Eight metro cities: Arvada, Castle Rock, Centennial, Denver, Englewood,
Lakewood, Littleton, Parker. `C2` The houses are individually numbered — directory
listings exist for Assured Senior Living 5, 9, 11, 22 and 26 — which corroborates a
portfolio in that range rather than a handful.

`C3` One directory lists a Castle Rock house at **"Starting at 9,000/mo."** Against `K1` a
national median assisted-living cost of **$70,800/yr (~$5,900/mo)**, that is a decisive
premium position. They are not competing on price, which means they are competing on the
thing §3 is about.

`T1` Within 50 miles of Denver there are **410 assisted-living facilities** and **158
retirement homes** listed. It is a dense market, and a premium small-home operator's
defence in a dense market is the quality of the individual experience.

## 3. The one big thing

**Make the individualised care plan a living operational artifact that survives the shift
change, the new hire and the twenty miles between houses.**

Their entire differentiation — `V4` "individualized, never one-size-fits-all", `C1` 1:4
ratios, `C3` a $9,000/mo price point — rests on one fragile assumption: that what is known
about a resident actually reaches the person standing in front of them at 6am on a Sunday.

Four things make that assumption fragile here, and they compound:

1. **The plan is a document; the care is a house.** Thirty-plus scattered small homes have
   no shared floor, no shift huddle across sites, no charge nurse walking the building.
   Knowledge that moves by proximity in a 120-unit campus has nothing to move through
   here.
2. **The knowledge keeps leaving.** `K2` Frontline turnover runs **47.1%** for
   resident/personal care assistants and **41.8%** for CNAs nationally. Roughly half the
   people holding a resident's routines in their heads turn over in a year.
3. **Colorado makes every hour expensive.** `K3` Colorado CNA wages were **$23.39/hr** in
   2024 against a national assisted-living median of **$18.71** — among the highest in the
   country. At 1:4, labour is not a cost line to trim, it is the product. The only honest
   efficiency is *time handed back to caregivers*, and time spent reconstructing what
   someone already knew is the purest waste in the model.
4. **They already said the plans go stale.** `V1` "Rigid plans often fail to account for a
   resident's subtle changes or evolving preferences" — their words, published today.

**Why this is a build and not a purchase.** `K4` The mature ambient-documentation vendors
— Abridge, Ambience, Suki, Nabla, DeepScribe, Microsoft DAX — target health systems and
ambulatory clinicians, and the post-acute specialists target **OASIS and HOPE**, which are
home-health and hospice instruments. `K5` Evidence of ambient documentation deployed
inside mainstream assisted-living platforms is limited to pilots and vendor marketing.

> **Corrected 2026-09-16 by `15`.** An earlier version of this paragraph said nobody builds
> for this shape. That is too strong. A whole category serves scattered-site residential
> care — **Therap** (15,000+ providers), **iCareManager** (which markets to assisted living
> *and* IDD and advertises "Plans current 88%"), eVero, Sandata. The accurate claim is
> narrower and better: those platforms are built for **the organisation** — compliance,
> billing, audit — not for **the caregiver in the moment**. The build is a last-mile layer
> over a system of record, not a system of record. See `15` §3 and §5.

**The TBI line is the acute case of the same problem, not a different one.** `V3` Two
houses, the highest complexity, the most genuinely individualised plans, and — if the
payer is the Medicaid Brain Injury waiver — a compliance record attached. Build for the
hardest case and the rest of the portfolio inherits it. That is the right sequencing, and
it is the opposite of building a TBI-only tool.

## 4. What we would refuse to build

- **Fall-detection hardware across the portfolio.** `K6` It is the one mature AI category
  in senior living and it just moved — ALIS announced an Inspiren integration on
  **2026-08-04**, and SafelyYou sells on length-of-stay and NOI. But those ROI cases are
  built on large-campus maths, the independent evidence on reduced hospitalisations is
  thin, and per-room capex across thirty-plus scattered houses is a different problem
  entirely. At 1:4 staffing the marginal detection value is genuinely lower. If they want
  it, they should buy it, not build it.
- **Another family communication app.** `C4` They already run Serenity Engage and are a
  published reference for it. Rebuilding that would be competing with their own working
  tool.
- **Anything that adds a screen to a caregiver's shift.** At 1:4, a tool that costs
  caregiver minutes to feed is a tool that loses. Whatever gets built has to *return* time
  in its first week or it will be abandoned, correctly.

## 5. What we could not see

Stated as absence, not as fact.

- **The payer mix for the TBI line.** Their public pages carry **no** funding language at
  all — no mention of Medicaid, the Brain Injury waiver, private pay, insurance or rates
  on the TBI or Arvada pages. We could not determine it. This is the fork in §6.
- **What operations software they run.** No platform is named publicly. Whether it is
  ALIS, Eldermark, MatrixCare, something bespoke or paper changes the build substantially.
- **Occupancy, and whether the 30+ figure includes the TBI houses.**
- **Their actual staffing model** beyond the 1:4 claim — shift lengths, float pool, agency
  usage.
- **Whether the two blog posts reflect an internal initiative** or are routine content
  marketing. Worth asking directly; it costs nothing and the answer is diagnostic.

## 6. The fork

**What is the binding constraint on a care plan — getting it *known*, or getting it
*evidenced*?**

| If the answer is… | Then the build is… |
|---|---|
| **Knowledge transfer.** The plan exists and is decent; the failure is that a new or covering caregiver does not carry it. | A propagation layer. What this caregiver needs to know, for this resident, in this house, right now — arriving in the first minute of a shift, not buried in a record. Success is measured in time-to-competence for a new hire and in fewer avoidable incidents on covered shifts. |
| **Compliance evidence.** The care is good; proving it to a surveyor or a waiver reviewer is the expensive part. | A capture-and-audit layer. Structured capture at the point of care, service plans generated against requirements, incident reporting, an evidence trail that survives utilisation review. Success is measured in hours to prepare for a review. |

These are genuinely different products. **If the question does not produce a clear lean in
conversation, the hypothesis is wrong — drop it rather than defend it.** That is the test,
not a formality.

## 7. Claim register

| id | Claim | Tier | Source, dated |
|---|---|---|---|
| V1 | Blog post "Personalized Senior Care Plans That Truly Fit Each Resident"; rigid plans "fail to account for a resident's subtle changes" | **V** | assuredassistedliving.com blog, published 2026-09-16, read 2026-09-16 |
| V2 | Blog post "Family Education That Strengthens Care Collaboration" | **V** | assuredassistedliving.com blog, published 2026-09-14 |
| V3 | TBI support offered at two communities: Castle Rock and Arvada | **V** | /care-options/brain-injury-supportive-living/, page updated 2026-08-12 |
| V4 | "long-term assisted living for traumatic brain injury… always individualized, never one-size-fits-all" | **V** | same page |
| V5 | "supportive living program provides strategies tailored to individual needs" | **V** | /communities/arvada/ |
| V6 | Eight metro cities served | **V** | /communities/ |
| V7 | No payer, funding, Medicaid or rate language on the TBI or Arvada pages | **V** | both pages, checked 2026-09-16 |
| C1 | 30+ homes; 1:4 staffing; "Colorado's largest privately held residential assisted-living provider" | C | LeGasse NIC speaker bio — his own phrasing, not audited |
| C2 | Houses individually numbered; listings for units 5, 9, 11, 22, 26 | C | seniorhomes.com, caring.com, retirenet.com, miradorliving.com directory listings |
| C3 | A Castle Rock house listed "Starting at 9,000/mo" | C | seniorhomes.com listing for Assured Senior Living 5 |
| C4 | Serenity Engage customer, with a published success story | C | Serenity Engage case study PDF |
| T1 | 410 assisted-living facilities and 158 retirement homes within 50mi of Denver | T | DataForSEO Business Listings, pulled 2026-09-16 |
| K1 | National median assisted living $70,800/yr (~$5,900/mo), up 10% in 2024 | K | Genworth/CareScout Cost of Care, 2025-03-04 |
| K2 | Turnover: resident/personal care assistants 47.1%, CNAs 41.8% | K | McKnight's Senior Living, 2024-04-25 |
| K3 | Colorado CNA $23.39/hr vs national AL median $18.71 (2024) | K | McKnight's Senior Living, 2025-01-29 |
| K4 | Ambient documentation vendors target health systems and OASIS/HOPE | K | Market overviews, 2026-04-26 and 2026-09-16 |
| K5 | Ambient documentation inside AL platforms limited to pilots and marketing | K | Same; absence noted, not asserted as "does not exist" |
| K6 | ALIS × Inspiren fall-safety integration announced 2026-08-04 | K | go-alis.com press release, 2026-08-04 |
| C-p | LeGasse is a podcast host, and a frequent guest elsewhere | C | His own LinkedIn headline; guest appearances on The Care Home Show, Scales of Success, CareSmartz360, AgingIN |
| R1 | MorningStar Senior Living: 38 properties, 5,000+ units, 11 states; Holly Park Centennial 2026-04-09; Parker 2026-03-09; assumed a former Balfour community in Longmont 2026-02-19; $305M three-community Denver portfolio to Morgan Stanley funds 2025-12-04 | C | wolfmediausa.com releases; morningstarseniorliving.com press page |
| R2 | Generations LLC manages eight northern Colorado communities acquired by NHI from Columbine Health Systems, effective 2026-05-01 | C | coloradobiz.com, 2026-05-06 |
| R3 | 12 Oaks Senior Living acquired Springbrooke, 145 units, Denver | C | 12oaks.com, 2026-08-01; Senior Housing News Dealbook, 2026-08-07 |
| R4 | Dial Senior Living engaged to manage Jackson Creek, 132 units, Monument CO | C | inlandgroup.com, 2026-03-11 |
| R5 | Oakmont Senior Living bought four Colorado communities from Bonaventure | C | wolfmediausa.com, 2026-04-13 |

**Figures deliberately not stated:** their occupancy, revenue, headcount, TBI census, and
the BI-waiver rate they bill. None could be sourced, and none is estimated here.

## 8. If they are a referral source rather than a customer

Raised 2026-09-16. **It changes the meeting more than it changes the analysis**, and it is
probably the right posture.

### Why a well-run operator is a weak customer and a strong judge

Assured has been founder-owned since December 2017, grew organically rather than by
acquisition, and runs `C1` 1:4 ratios. An operator like that has likely **already solved**
knowledge propagation locally — through tenure, culture, small teams and founders who know
residents by name. That makes the build less compelling *for them*, and makes their read
on **who has not solved it** considerably more valuable than their purchase order.

So the hypothesis in §3 stops being a pitch and becomes **a diagnostic instrument**. You
are not asking "would you buy this." You are asking "is this the real problem, and who has
it worst?" That is a better question to put to someone with thirty-plus houses of
experience, and — unlike a pitch — it is a question people enjoy answering.

### The fork changes meaning

In §6 the fork decides *which build for Assured*. Under the referral posture it decides
**which segment to sell to**:

- **Lean knowledge-transfer** → the buyer is private-pay memory care at scale, where the
  pain is continuity and family trust.
- **Lean compliance-evidence** → the buyer is waiver-heavy residential, where the pain is
  proving it. Colorado's **Alternative Care Facility** construct is the mechanism by which
  assisted living takes Medicaid here, so mixed-payer operators are the ones carrying
  parallel documentation regimes.

Their answer segments the market. That is worth more than a yes.

### Who has this worse than they do — named, dated, and mostly local

The sharpest version of the thesis is not "many homes." It is **many homes that recently
arrived from somewhere else**, because acquired sites bring their own care-plan formats,
assessment tools, record systems and training norms. Colorado has had an unusually busy
eighteen months:

| Operator | Why they fit the thesis harder than Assured |
|---|---|
| **MorningStar Senior Living** (Denver HQ) | `R1` **38 properties, 5,000+ units, 11 states**, IL/AL/memory care — and four transactions in nine months: Holly Park in Centennial (2026-04-09), Parker (2026-03-09), **assumed management of a former Balfour community in Longmont** (2026-02-19), and a three-community Denver portfolio sold to Morgan Stanley funds for **$305M** with MorningStar staying on as operator (2025-12-04). Denver-based, roll-up shaped, repeatedly inheriting other operators' sites |
| **Generations LLC** | `R2` Contracted to manage **eight northern Colorado communities** acquired by NHI from Columbine Health Systems, effective 2026-05-01. Eight sites inheriting another operator's processes at once — the acutest integration case found |
| **12 Oaks Senior Living** (TX) | `R3` Acquired **Springbrooke**, a 145-unit IL/AL/memory care community in Denver (2026-08-01). An out-of-state manager absorbing a single large Colorado site |
| **Dial Senior Living** | `R4` Engaged to manage **Jackson Creek**, 132 units in Monument CO (2026-03-11) |
| **Oakmont Senior Living** | `R5` Bought **four Colorado communities** from Bonaventure (2026-04-13) |

**Stated carefully:** these are *structural* risk profiles drawn from public transactions.
No source says any of them has poor care-plan dissemination, and none is asserted to. What
is verifiable is portfolio heterogeneity and repeated management transitions, which is the
condition the thesis predicts.

**MorningStar is the standout** — Denver-headquartered, the right size band, and acquiring
steadily. It belongs on the `11` target list, and none of these five is there yet.

### What to actually ask for

"Do you know anyone who'd want this" produces nothing. Specific beats broad, in roughly
this order:

1. **His podcast guests.** `C-p` Francis is a podcast host per his own LinkedIn headline
   and a frequent guest elsewhere. **His guest list is a pre-qualified, already-warm list
   of operators who talk publicly about their problems.** This is the single best ask in
   the whole engagement and it has been under-used — ask who he has had on, and who he has
   been trying to get.
2. **NIC.** He is a listed speaker. It is the seniors-housing capital and operator
   conference, so the room is owners, operators and lenders.
3. **Peers who just grew.** Name the profile rather than the companies: *"who do you know
   that has taken on somebody else's homes in the last year?"* Let him supply the names —
   it is a better question than reading him a list, and his answer tells you whether the
   thesis reads as real to an operator.
4. **His vendors.** Whoever supplies his record system, plus Serenity Engage. **Vendors
   know exactly which of their customers are struggling**, and a warm operator reference
   into a vendor is a different conversation from a cold one.
5. **Capital.** Lument has featured the company; lenders and REITs see operator pain
   across whole portfolios.

### What success looks like tomorrow

Not "they lean toward a build." Two things:

1. **The hypothesis in §3 is confirmed or killed** by someone with thirty-plus houses of
   experience. A clear "no, that is not the problem — the problem is X" is a *better*
   outcome than a polite yes, and it costs nothing to get.
2. **Two or three named introductions**, at least one of them a podcast guest or a
   recently-acquisitive operator.

### What does not change

**Still do not pitch.** Now for a second and stronger reason: a referral source who feels
sold to stops referring. The build conversation can happen later and only if he raises it
— and §9 below still applies.

## 9. How to use this tomorrow

Lead with `V1`. *"You published on Tuesday that rigid care plans miss the subtle changes —
how does a plan actually reach the caregiver on a Sunday morning in Littleton?"* That
opens the whole thing, it is true and specific and about them, and it is their own
sentence.

Then work the fork in §6, in the segmentation sense of §8. Then the §7 questions in `13`,
plus the five asks in §8. **Do not pitch a build** — `11` §3 and issue #5 both say the
network and the proof are worth more here than the revenue.
