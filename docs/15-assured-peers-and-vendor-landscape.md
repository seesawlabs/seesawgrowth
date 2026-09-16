# Assured — peer test and vendor landscape

*Research run 2026-09-16 with Exa (peer discovery), Firecrawl (vendor and peer pages),
Perplexity (category evidence). Companion to `14`.*

> **Headline: one of the four assumptions in `14` does not survive contact.** The claim that
> "nobody is building for this shape" is **too strong** and is corrected in §3. The
> correction makes the build case narrower, more specific and more defensible — it is a
> better answer, not a retreat.

## 1. The peer set

Four rings, from nearest to most instructive.

**Ring 1 — direct, in-market.** `P1` **Lighthouse Assisted Living** (Littleton /
Centennial, CO) runs small home-like assisted living in Assured's own metro, on
near-identical language: "a small home-like environment," "we take the time to know each
individual—their story, their needs." They also run a **family portal (CareFeed)** — the
same functional slot Assured fills with Serenity Engage.

**Ring 2 — out-of-market small-home senior operators.** `P2` **Larmax Homes** (MD) —
"personalized care at **industry leading staff ratios**." `P3` **Our House Senior Living**
(WI) — "Small home communities, big family feel." Also Dolan Memory Care Homes (MO),
SeniorCare Homes, Legato Living, Arthur's Senior Care, Village Care Homes.

**Ring 3 — the model at national scale.** `P4` **The Green House Project**: roughly
**350–400 homes across 30+ states** (sources vary — 359, 382 and "nearly 400" all appear),
typically 10–12 elders per home, operated by many sponsoring organisations rather than one
company.

**Ring 4 — the adjacent sector that runs this problem hardest.** IDD and behavioural
residential providers operate scattered homes at a scale no senior-living operator
approaches. `P5` **RHA Health Services** runs group homes, supported living, and
**host-home / alternative family living** across NC, TN, GA, UT and PA. `P6` **Benchmark
Human Services** runs 24/7 IDD residential and crisis homes. Sevita, Dungarvin and Mosaic
are the other names in this tier; **no verifiable home or headcount figures were
obtainable** for any of them, so none are given.

**This ring matters most.** If Assured's problem is real, an organisation running hundreds
of scattered homes must have confronted it — and either solved it or bought something. §3
is what happened when that was checked.

## 2. Which assumptions hold

| # | Assumption from `14` | Verdict |
|---|---|---|
| A1 | Scattered small homes create a knowledge-propagation problem that campus models do not have | **Holds.** Ring 4 is an entire sector organised around this constraint, with its own software category (§3) that exists for precisely this reason |
| A2 | Individualised care at high staffing ratios commands a premium | **Holds — but it is not differentiating** |
| A3 | Turnover breaks knowledge continuity | **Holds.** Category evidence in `14` K2: 47.1% RA/PCA, 41.8% CNA |
| A4 | Nobody is building software for this shape | **Partially false.** See §3 |

**A2 deserves a sentence, because it changes the conversation.** Every small-home operator
found says the same things: `P1` "know each individual," `P2` "industry leading staff
ratios," `P3` "big family feel." Individualised care at high ratios is **the segment
archetype, not Assured's differentiator.** So when Francis says "individualized, never
one-size-fits-all," the interesting question is not *whether* they mean it — everyone says
it — but **what they do operationally that makes it true at thirty-plus houses when their
peers say it at five.** That is a much better question than a compliment, and it heads
straight into the build.

## 3. The correction: it is not greenfield

`14` §3 said nobody builds for this shape. That is wrong, and the accurate picture is more
useful. **Two software worlds exist, and Assured sits in the seam between them.**

**World 1 — senior living platforms.** ALIS, Eldermark, August Health. Built around campus
operations, private-pay assisted living, marketing, census and CRM. `V-a` ALIS's
2026-08-04 Inspiren integration is a good example of where that world's energy goes: fall
safety and passive monitoring, which presumes fixed infrastructure per room.

**World 2 — HCBS / IDD provider platforms.** Built for scattered-site residential waiver
services, which is structurally Assured's operating shape:

- `S1` **Therap Services** — "the trusted documentation solution for human service
  providers and governments." **15,000+ providers, 20+ years, 70+ tools**, spanning EHR,
  **person-centred planning**, incident reporting and EVV, with state-specific support
  sites (RI, NM, DE, SC, NY, ND, NE, SD, TN).
- `S2` **iCareManager** — **the direct counter-example**, and the one to look at hardest.
  It markets an EHR to **assisted living *and* IDD**, with Nursing & Assessments, Pharmacy
  eMAR, **Plans & Goals**, a **CareTracker** module, **Site Management**, and mobile time
  tracking — "50+ connected modules." Its own marketing dashboard advertises **"Plans
  current 88% · Notes completed 72% · Compliance checks 94%."**
- `S3` **eVero**, **Sandata** (EVV and IDD agency management), **CentralReach**
  (autism/IDD, Care360).

**Read `S2` carefully.** iCareManager is not adjacent to the thesis in `14` — it is
*selling the thesis*. "Plans current" as a headline metric is an admission that plan
currency is the recognised problem in this market. Someone got there first.

### What this changes, and what it does not

**Changes:** the pitch is no longer "nobody has built this." It is "records systems exist
and are mature; here is the part they do not do." Walking in with the greenfield version
would be wrong on the facts and Francis — an AgeTech-ecosystem person — would likely know
it.

**Does not change:** the underlying problem. Every platform in World 2 is built for **the
organisation** — compliance, billing, audit, state reporting. That is who buys, so that is
who they serve. None of them is built for **the caregiver in the moment**, which is where
`V1`'s "subtle changes" are either noticed or lost. A system of record answers *what was
documented*. It does not answer *what does the person walking into this house at 6am need
to know about this resident today*.

**So the build gets narrower and better:** not a record system, but a **last-mile layer
over whatever record system they run** — which also means the first question is which one
that is (§5).

## 4. The ambient vendors, and why none of them fit

Direct answer to the question: **none of Abridge, Ambience, Suki, Nabla, DeepScribe or
Microsoft Dragon Copilot supports an unlicensed direct care worker documenting activities
of daily living across a shift in a residential setting.** No product page, case study or
customer story naming that use case was found for any of the six. Stated as an absence
found, not as proof none exists.

| Vendor | What it does | User and setting | EHR | Price (third-party estimates — none publish) |
|---|---|---|---|---|
| **Abridge** | Ambient scribe; structured note traceable to audio timestamps; also revenue-cycle/coding grounding | Physicians and clinicians; outpatient, ED, inpatient | Epic's first "Pal" — embedded in Haiku and Hyperdrive; also athenahealth, Cerner, NextGen | `Est.` ~$2,500/clinician/yr (~$208/mo); planning ranges $200–800/provider/mo |
| **Ambience** | Ambient notes plus real-time coding and **CDI** checks before the chart | Physicians/APPs, "200+ specialties"; large health systems | Epic Hyperspace/Haiku, Oracle Cerner Millennium, athenahealth; in Epic's Toolbox | `Est.` ~$2,800–3,200/provider/yr scribe only; $4,000–5,000 full suite |
| **Suki** | Voice assistant — ambient documentation, dictation, commands | Physicians and clinicians; ambulatory and health systems | Bidirectional with Epic, Oracle Health, athenahealth, MEDITECH Expanse | Not established in sources |
| **Nabla** | Ambient scribe | Clinicians | Multiple | Not established in sources |
| **DeepScribe** | Ambient scribe, "ambient operating system" | Clinicians | Multiple | Not established in sources |
| **Microsoft Dragon Copilot** (ex-DAX) | Ambient documentation inside the Microsoft healthcare stack | Clinicians; health systems | Deep Microsoft/Nuance estate | Not established in sources |

### The mismatch is structural, not a feature gap

This is the part worth carrying into the meeting. These products are not "missing assisted
living support" — they are built on a different unit of work.

| | Ambient scribes assume | A small home actually has |
|---|---|---|
| **Unit of work** | A bounded *encounter* with a start and end | A *shift* — continuous, interruptible, 8–12 hours |
| **Who documents** | A licensed clinician | An unlicensed direct care worker |
| **Input** | A conversation about the body | A physical task done *to* and *with* a person |
| **Attention** | One patient at a time | Four residents at once, at 1:4 |
| **Output's purpose** | A chart note, and a billable code | Evidence of plan adherence, and a handover |
| **What good looks like** | A faithful record of what was said | The *next* caregiver knowing what changed |

An ambient scribe pointed at a caregiver's shift would produce hours of audio about
laundry, television and toileting, with no encounter boundary, no billing anchor, and
severe consent problems in a residence where people live.

**The frontier is moving this way, slowly.** `K-a` Mercy and Microsoft have piloted
ambient AI for **nursing** documentation with Dragon Copilot. That is the closest step
toward non-physician documentation — but still licensed nurses, still a health system,
still encounter-shaped. It suggests the direction, not an arrival.

## 5. What we would build instead

Three constraints from the above: it must **not** be a record system (World 2 exists and
is mature), it must **not** cost caregiver minutes (at 1:4 that is fatal), and it must
ride on whatever they already run rather than replace it.

That leaves a thin layer with three jobs:

1. **The first minute of a shift.** Not "open the record." Instead: *what changed about
   the four people in this house since you were last here, and what does that mean for the
   next eight hours* — pushed, on a phone, in under sixty seconds. This is the piece that
   fights turnover directly, and it is a design problem before it is an engineering one.
2. **Capture that costs seconds, not minutes.** Voice or two taps, at the moment of
   noticing, writing back into their system of record. `V1`'s "subtle changes" are lost
   because capturing them today competes with the resident in front of you.
3. **Plan currency as a visible state.** `S2` proves the market recognises the metric; the
   gap is that a dashboard number does not tell a house manager *which* plan is stale and
   *why it matters this week*.

**Sequencing:** build it for the two TBI houses first. Highest complexity, most genuinely
individualised plans, and — if the payer is the Brain Injury waiver — a compliance record
attached. Prove it where it is hardest, then let the other twenty-eight inherit it.

**The question this raises, which now goes at the top of the list:** *what system of
record do you actually run?* If it is iCareManager, much of layer 3 may already exist and
the build is layers 1 and 2 only. If it is paper or spreadsheets across thirty houses,
that is a different and larger conversation. `14` §5 already records that we could not
determine this.

## 6. Claim register

| id | Claim | Tier | Source |
|---|---|---|---|
| P1 | Lighthouse Assisted Living, Littleton/Centennial CO; "small home-like environment"; "know each individual"; runs a CareFeed family portal | V | lighthouseassistedliving.com, read 2026-09-16 |
| P2 | Larmax Homes: "personalized care at industry leading staff ratios" | V | larmaxhomes.com, read 2026-09-16 |
| P3 | Our House Senior Living: "Small home communities, big family feel" | V | ourhousesl.com, read 2026-09-16 |
| P4 | Green House Project: ~350–400 homes, 30+ states, 10–12 elders per home | C | thegreenhouseproject.org (2024-02-13, dir. 2026-07-11); Wikipedia. Sources conflict: 359 / 382 / "nearly 400" |
| P5 | RHA Health Services: group homes, supported living, host-home/AFL across NC, TN, GA, UT, PA | C | rhahealthservices.org, pages dated 2024-11-12 and 2026-09-04 |
| P6 | Benchmark Human Services: 24/7 IDD residential and crisis homes | C | benchmarkhs.com, 2025-12-02 and 2023-04-11 |
| S1 | Therap: 15,000+ providers, 20+ years, 70+ tools; EHR, person-centred planning, EVV | V | therapservices.net, read 2026-09-16 |
| S2 | iCareManager: EHR for assisted living and IDD; Plans & Goals, CareTracker, Site Management, eMAR; "50+ connected modules"; markets "Plans current 88% · Notes completed 72% · Compliance checks 94%" | V | icaremanager.com/assisted-living-services, read 2026-09-16 |
| S3 | eVero, Sandata, CentralReach serve IDD/HCBS providers | C | Vendor sites |
| V-a | ALIS × Inspiren fall-safety integration | C | go-alis.com, 2026-08-04 |
| K-a | Mercy and Microsoft piloted ambient AI nursing documentation with Dragon Copilot | C | Trade coverage, 2025-12 |
| — | Vendor pricing in §4 | C | **Third-party estimates only. None of the six publishes list pricing. Do not quote these to anyone as fact.** |

**Not established:** home counts and headcounts for Sevita, Dungarvin, Mosaic, RHA and
Benchmark; pricing for Suki, Nabla and DeepScribe; whether any peer in §1 runs Therap,
iCareManager or anything else. None estimated.
