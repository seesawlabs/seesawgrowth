# Program outline — the Reality Check, as discrete projects

*Drafted 2026-08-11 · Owner: Calvin · For team alignment*

Eleven projects. Each has one owner, one output, and a done-when you can argue about.

---

## The reorder

**The report template has to be locked before the interview guide is final.** The report defines
what the call must capture — that's why there's an extraction schema sitting between them. Write
the guide first and you'll run calls that don't collect what the report needs.

So the sequence starts: questionnaire → **report** → interview guide.

## The five gaps

| Missing | Why it matters |
|---|---|
| **The stack decision** | Scheduler, CRM, email, attribution. Everything in the build track waits on it, and accounts take a day to provision |
| **The report *pipeline*** | "Create an ideal report" is a template. Producing reports 2 through 8 without each costing what the first one cost is a separate, mostly technical build |
| **What happens after the report** | The report lands and then… nothing is defined. Proposal templates, credit terms, follow-up cadence. This is where the money actually is |
| **The dry run** | Running it once end to end before selling it. Also produces the internal AI-ops case study |
| **Demand** | Nothing in the original five creates a single lead. The funnel converts demand; it doesn't create it |

Plus one small but load-bearing thing: **Office Hours has to exist**, because it's the destination
for roughly a third of everyone who fills in the form.

---

## The eleven

Two tracks run in parallel and converge at the dry run. Sequential numbering, but the
`After` column shows what can overlap.

### Track A — decisions (Week 1)

**1 · Lock the questionnaire**
Already spec'd and prototyped; this is a review and a sign-off, not a design exercise.
· **Owner** Calvin · **After** — · **½ day**
· **Output** Final question set, options, scoring weights, gates, thresholds, the three outcome screens
· **Done when** Nobody on the team has an open objection to a question or a threshold

**2 · Lock the report template**
Re-cut the existing AI Tools Assessment deck at the right buyer altitude. Ten sections, plus the
*Not-viable-yet* and *Enterprise/small-first* variants.
· **Owner** Calvin + designer · **After** — · **3 days**
· **Output** Designed template, section by section, with a filled-in worked example
· **Done when** A stranger could look at a filled one and know what the client should do next

**3 · Agree the interview guide**
Written. Needs a walkthrough with whoever will actually run calls.
· **Owner** Calvin · **After** 2 · **½ day**
· **Output** Signed-off guide + the call companion
· **Done when** The two people running calls have read it and rehearsed the open out loud

**4 · Decide the stack and open accounts**
· **Owner** Calvin + fractional · **After** — · **½ day**
· **Output** Scheduler, CRM, transactional email, analytics chosen; accounts live; access granted
· **Done when** Someone other than Calvin can log into all of them

### Track B — the front door (Weeks 2–3)

**5 · Design site content and flow**
· **Owner** Calvin (copy) + designer · **After** 1 · **2 days**
· **Output** `/ai-reality-check` copy and design, `/office-hours`, the confirmation page, the CTA, the nav entry point
· **Done when** Copy is reviewed and the design is approved *before* anything gets wired

**6 · Build the pages, form, and scheduler**
Astro pages, the three-step form, the routing endpoint, scheduler configured collective with a
two-day minimum notice.
· **Owner** Engineer + fractional · **After** 4, 5 · **3 days**
· **Output** A working funnel on a staging URL, all 20 test cases passing
· **Done when** A stranger can qualify in 60 seconds, book, and get a confirmation email — with nobody touching it by hand

**7 · Stand up CRM, email, and attribution**
· **Owner** Fractional · **After** 4 · **2 days**
· **Output** Pipeline stages, custom properties, five email sequences, UTM and referral capture, the SLA-breach view, a dashboard
· **Done when** A test submission produces a complete CRM record with a source attached

### Track C — delivery (Weeks 2–4)

**8 · Build the report production pipeline**
The most technical project here, and the one most likely to be underestimated.
· **Owner** AI engineer + Calvin · **After** 2 · **4 days**
· **Output** Transcription, extraction against the schema, the Megamine research playbook, opportunity scoring, the ROI calculator, template assembly, the human review gate
· **Done when** A transcript in produces a 90%-complete draft report out, and every number shows its derivation

**9 · Define what happens after the report**
· **Owner** Calvin + Jeff · **After** 2 · **1 day**
· **Output** Roadmap proposal template, pod proposal template, credit terms written into a SOW, the follow-up cadence for each fit band, the *Not-viable-yet* follow-up
· **Done when** A proposal can go out within 48 hours of a readout without anyone writing prose

### Track D — prove it, then fill it (Weeks 4–5)

**10 · Dry run, end to end**
Run the whole thing on SeeSaw's own AI operations. One piece of work, two outputs — a tested
pipeline and the internal AI-ops case study the audit already asked for.
· **Owner** The delivery pair · **After** 3, 6, 7, 8, 9 · **2 days**
· **Output** One complete report, a retro, real hour counts, template and rubric fixes
· **Done when** We know what it actually costs to produce one, and we've fixed what broke

**11 · Launch and turn on demand**
· **Owner** Jeff (demand) + Calvin (launch) · **After** 10 · **2 days, then ongoing**
· **Output** Go live · Office Hours #1 scheduled and hosted · referral one-pager rewritten around the named offer · ten partner touches · LinkedIn cadence begins · retargeting on
· **Done when** Five Reality Checks are booked from a named source, and Office Hours #1 has happened

> **Ads are not in project 11.** They wait for the calibration gate at ten completed reports.
> Modelled outcomes for the same spend range from 1.6 to 12.5 roadmaps a year depending on which
> conversion rates hold — spending before we know is buying data at the worst price.

---

## Sequence

| Week | Projects |
|---|---|
| **1** · Aug 11–15 | 1 · 3 · 4, and start 2 |
| **2** · Aug 18–22 | 2 finishes · 5 · start 8 |
| **3** · Aug 25–29 | 6 · 7 · 8 continues |
| **4** · Sep 1–5 | 8 finishes · 9 · 10 |
| **5** · Sep 8–12 | 11 |

**≈20.5 person-days.** Feasible across two to three people in five weeks — with the two caveats
below.

---

## Prerequisites — not projects, but they gate the projects

**Two named people with protected calendar capacity.** Projects 3, 10, and 11 all need a lead and
a sketcher who actually exist and aren't fully booked on client work. This is the single most
common way a plan like this quietly doesn't happen.

**The fractional growth hire.** Projects 6 and 7 are largely theirs. If that hire hasn't started
by Aug 22, decide now whether Week 3 slips or Calvin absorbs a reduced version.

**One owner for the manual-review SLA.** Still unassigned. It's likely the largest routing bucket,
and without a name, hot leads sit for a day.

---

## What this program deliberately does not include

None of these block on the positioning decision, and none of them are in scope here:

- The homepage rewrite and the 14-item services list
- The `/ai-consulting` rebuild
- The six case-study rebuilds
- The paid AI Production Roadmap page
- Paid advertising beyond retargeting

The Reality Check lives on a new URL. It does not need the front door to change first — which is
why this can start now with Decision #1 still open. The only positioning-dependent thing in the
whole program is a handful of `[WEDGE]`-marked copy lines.

---

## Where each project's detail lives

| Project | Doc |
|---|---|
| 1 | `06-qualifier-spec.md` |
| 2 · 8 | `05-reality-check-spec.md` §5–6 |
| 3 | `07-interview-guide.md` |
| 4 · 5 · 6 · 7 | `08-website-build-runbook.md` |
| 9 · 11 | `04-offer-project-plan.md` §2, §9 |
| 10 | `05-reality-check-spec.md` §5, §11 |
