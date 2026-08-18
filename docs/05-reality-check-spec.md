# Spec — The AI Reality Check (the free offer)

*Drafted 2026-08-17 · Owner: Calvin · Companion to `04-offer-project-plan.md`*

One free offer, one motion. A 60-second qualifier, a one-hour scripted call, and a report
built from the transcript plus deep research, delivered in three business days.

This supersedes §6 of `04-offer-project-plan.md`, where the free tier was split into a
self-serve scorecard plus a call. The scorecard is deferred to v2 — see §10.

---

## 1. The offer

| | |
|---|---|
| **Name** | AI Reality Check |
| **Price** | Free |
| **Format** | 60-second qualifier → 1-hour call (recorded) → report in 3 business days |
| **Staffed by** | Two people: a product lead who runs the script, a designer who sketches live |
| **Cost to us** | ~3.5 senior hours ≈ **$525–700 per report** at loaded cost |
| **Cap** | **8 per month.** Above that, delivery quality or client work suffers |
| **Non-qualifiers** | Routed to monthly Office Hours, not rejected |
| **Leads to** | AI Production Roadmap — $25k, 3 weeks, credited against a pod |

At 8/month this is a **$4.2–5.6k/mo marketing line item.** Budget it as one deliberately; it
is the single largest cost in the acquisition plan.

---

## 2. The qualifier — five questions, 60 seconds

Lives on the booking page. Nothing gates the offer page itself; ads point at the offer.

1. **Company and revenue band** — `<$10M` · `$10–50M` · `$50–250M` · `$250M–1B` · `$1B+`
2. **Your role** — CTO / VP Eng · CEO / COO · Chief AI or Data Officer · Product · Other
3. **What have you already tried with AI?** — free text, required, 20-word minimum
4. **Timeline** — in motion now · this quarter · this year · just exploring
5. **Build engagements start at $50k** — acknowledgment checkbox

Question 3 is the one that matters. It identifies the burned buyer, it gives the call its
opening, and a vague answer is itself a signal.

### Routing logic

Score out of 10, then route automatically:

| Signal | Points |
|---|---|
| Revenue $50–250M or $250M–1B | 3 |
| Revenue $10–50M | 1 |
| Revenue `$1B+` | 2 *(fits, but long cycle)* |
| Revenue `<$10M` | 0 |
| Role is economic buyer (CTO, CEO/COO, CAIO) | 2 |
| Role is influencer (Product, VP) | 1 |
| Q3 describes a specific prior attempt | 2 |
| Q3 is vague or aspirational | 1 |
| Timeline now or this quarter | 2 |
| Timeline this year | 1 |
| Budget acknowledged | 1 |

- **7–10 → auto-book.** Scheduler shown immediately.
- **5–6 → manual review** within one business day. Calvin or Jeff decides.
- **0–4 → Office Hours** invitation plus the nurture sequence.

Never show a score or a rejection. Low scorers see a genuine invitation to Office Hours.

---

## 3. The call — one hour, scripted

Two people. The product lead runs the script; the designer sketches the workflow live and
shares it at the end. Consent to record is stated in the booking confirmation **and** verbally
in the first minute.

| Time | Block | What we're getting |
|---|---|---|
| 0:00–0:05 | **Frame and consent** | How the hour works, that we're recording to build their report, when they get it |
| 0:05–0:15 | **The stall story** | What they tried, what happened, when it stopped, who was involved |
| 0:15–0:30 | **The workflow** | End-to-end walkthrough. Who touches it, how often, what's manual, where it breaks. **Volume and time per unit — this is where every ROI number comes from** |
| 0:30–0:40 | **Data and systems** | Which systems hold the data, who owns access, PHI surface, existing integrations |
| 0:40–0:50 | **People and adoption** | Who would use this, what their day looks like, who sponsors the change, whether a tool has been rolled out and ignored before |
| 0:50–0:58 | **Constraints and decision** | Budget reality, timeline, who else decides, what happens if nothing changes |
| 0:58–1:00 | **Close** | Confirm the report date, name the one thing we'll dig into |

### Opening line

> "We're going to spend an hour on your situation, and in three days you'll get a written
> assessment you can forward to anyone. We record so we can build that — is that alright?
> Start wherever you want, but I'd like to hear about what you already tried."

### The questions that carry the most weight

- *"When did it stop moving, and what was the conversation when it did?"*
- *"Walk me through the process as it happens today, not as it's documented."*
- *"How many of these go through per week, and how long does one take?"* ← the ROI arithmetic
- *"Who would have to change how they work? What's their incentive to?"*
- *"Has a tool ever been rolled out here that people quietly stopped using?"*
- *"If nothing changes in twelve months, what does that cost you?"*

### The live sketch

The designer draws current-state and future-state workflow during blocks 3–5, shares screen
in the last two minutes, and the cleaned-up version goes in the report. It costs no extra
hours because it happens inside the call — and nobody else sends a designed artifact off a
free conversation.

---

## 4. What the call must capture — the extraction schema

The contract between the call and the report. If the transcript doesn't yield these, the
report can't be built and the product lead owes a follow-up email.

```
stalled_initiative   what · when it stopped · stated reason · who owned it
target_workflow      steps[] · actors[] · volume_per_period · time_per_unit
                     · rework_or_error_rate · system_touchpoints[]
systems              named systems · data owner · access path · PHI exposure
compliance           HIPAA posture · BAAs in place · audit requirements
people               end_users[] · their_sponsor · prior_adoption_failures[]
constraints          budget_band · timeline · other_deciders[] · cost_of_inaction
verbatims            >= 3 direct quotes, attributed by role
```

`volume_per_period` and `time_per_unit` are mandatory. Without them there is no defensible
number on the financial slide, and an undefended number is worse than none.

---

## 5. The pipeline

1. **Transcribe** the recording.
2. **Extract** against the §4 schema — schema-constrained, so gaps surface as nulls rather
   than as invented content.
3. **Deep research in parallel** (Megamine): company profile and ownership, their public AI
   announcements, the vendor landscape in their sub-vertical, regulatory surface, comparable
   deployments, competitor AI moves.
4. **Generate and score opportunities** — value at stake × time to production × adoption risk.
5. **Compute the numbers** from `volume_per_period` and `time_per_unit`. Arithmetic shown
   inline, every figure labeled `Est.` with its source assumption.
6. **Assemble** into the report template.
7. **Human review — required.** Calvin reviews the first 20 personally. Check the
   three-specifics gate and re-derive every number.
8. **Send** within 3 business days.

### The ROI arithmetic pattern

Never a bare number. Always the derivation:

> **Est. $401k/yr in touch time**
> 2,400 prior authorizations/mo × 22 min each × $38/hr loaded × 12 months
> *Assumption: 22 minutes is Sarah's estimate on the call, not a measured figure.*

---

## 6. The report — ten sections

A re-cut of the existing AI Tools Assessment template at the right buyer altitude. Same
visual system; different vocabulary.

| # | Section | Contents |
|---|---|---|
| 1 | **Cover** | AI Reality Check · company · date · who prepared it |
| 2 | **What we heard** | Their stall story returned to them, with a verbatim quote. Proves we listened; starts the three-specifics count |
| 3 | **Where the value is** | The impact–effort matrix. Axes: *value at stake* × *time to production*. Quadrants: Start here · Phase two · Background · Park |
| 4 | **Where to start** | The ranked shortlist, 3–6 opportunities |
| 5 | **The opportunities in detail** | Per card: *value at stake · what it takes · adoption risk* |
| 6 | **Your first 30 days** | Four weeks. **At least one item requires nobody from SeeSaw** |
| 7 | **The path to production** | Three phases beyond 30 days. The pod bridge |
| 8 | **The numbers** | Est. annual value at stake · investment required · arithmetic shown inline |
| 9 | **What we couldn't determine** | The honest list of open questions. The closer |
| 10 | **Next steps** | Two: one they take alone, one with us |

### Altitude translation from the existing template

| Existing slide | Becomes | Why |
|---|---|---|
| "Hours you can reclaim every week" | Their own headline metric — approval turnaround, denial rate, days to discharge | A defaulted time-savings metric signals SMB productivity consulting |
| Impact–Effort Matrix | Nearly unchanged. Relabel axes and quadrants | Strongest slide in the template |
| Quick Wins | Where to start | — |
| Recommended Solutions · COST / SETUP / SAVES | Value at stake / What it takes / Adoption risk | COST-SETUP-SAVES is tool shopping. Adoption risk is our differentiator |
| Your 4-Day Quick Wins Plan | Your First 30 Days — four weeks | Same layout, buyer-appropriate horizon |
| What Comes After Quick Wins | The Path to Production | — |
| Total Monthly Tool Cost | Investment required | Tool cost is the wrong frame at $50k+ |
| Your Next Steps | Unchanged | — |

### Section 9 is the sales mechanism

The report ends by naming what an hour of conversation could not resolve — whether their data
actually supports the use case, whether end users will adopt it, whether the integration is
tractable. Honest, genuinely useful, and it makes the paid engagement obvious without a line
of pitch.

---

## 7. Free versus paid — hold this line

| | AI Reality Check (free) | AI Production Roadmap ($25k) |
|---|---|---|
| Input | One hour, their account of events | 6–10 interviews incl. actual end users, workflow observation |
| Verification | None — we take what we're told | Data inspected, systems reviewed, assumptions tested |
| Technical depth | Directional | Architecture blueprint, eval strategy, cost per transaction |
| Feasibility | Stated as open questions | Two-day technical spike resolves the riskiest one |
| Design | Live workflow sketch | Working clickable prototype |
| Delivery | Report in 3 days | Live 90-minute readout + board-ready deck |

> **"The Reality Check tells you where to look. The Roadmap tells you what to build — and
> proves it."**

---

## 8. Guardrails

**Three specifics minimum.** Every report contains at least three details obtainable only
from the call — a named system, a verbatim quote, the actual failure story. They gave us an
hour; a fill-in-the-blank deck back is worse than nothing. QA gate, not a guideline.

**Never invent a metric.** Every figure labeled `Est.` with its derivation shown. Section 8 is
where the temptation lives. One fabricated number caught by a CFO kills the document and the
paid offer behind it.

**Cap at 8 per month.** Beyond that, either report quality drops or client delivery does.

**Calvin reviews the first 20.** Non-delegable. The report quality *is* the product demo — a
generic AI-generated report tells an AI buyer exactly what our AI output is worth.

**Consent to record**, in the booking confirmation and verbally in the first minute.

---

## 9. Office Hours

Monthly, 60 minutes, 8–10 seats. Jeff hosts: one 20-minute teaching block, 40 minutes open.
Recorded and repurposed as content.

Three jobs: it gives sub-threshold leads somewhere real to go instead of a rejection, it
scales Jeff's expertise across ten people for the cost of one call, and it becomes a
recurring content and LinkedIn asset.

---

## 10. Paid acquisition — calibrate before scaling

**No Google search ads.** Modeled at ~$769 per completed assessment against $55–141 CPCs on
AI keywords, versus ~$92 on LinkedIn. Eight times the cost for the same outcome.

| Stage | When | Spend | What we learn |
|---|---|---|---|
| Retargeting only | Weeks 1–4 | ~$500/mo | Whether warm traffic converts on the offer page at all |
| LinkedIn to the named ABM list | Weeks 3–8 | ~$1,500/mo | Qualifier completion rate, book rate, fit rate on cold traffic |
| **Calibration gate** | After **10 completed Reality Checks** | — | Real conversion rates replace every modeled assumption |
| Scale | Post-gate | Sized from observed rates | — |

The reason for the gate: modeled outcomes for the same $60k of annual spend range from 1.6 to
12.5 roadmaps a year depending on which conversion rates hold. Spending before you know is
buying data at the worst available price. Both ends of that range are ROAS-positive, so this
is about sizing, not about whether to do it.

### Ad hooks to test

- **"Your AI pilot stalled. It probably wasn't the model."** ← lead with this
- "95% of enterprise AI pilots never reach production. Find out if yours will."
- `[WEDGE]` "Why prior-auth AI pilots stall — and how to tell if yours will."
- Retargeting: "Still thinking about it? One hour, and you keep the assessment."

**The promise is the report, not the call.** *"One hour with our team. You keep the
assessment."* The artifact converts; the call is the price of admission — and someone willing
to give an hour is more serious than someone who fills a form.

### Deferred: the self-serve scorecard

Not cancelled, re-sequenced. Build it after 20 reports exist, so the scoring is calibrated
against real cases instead of guessed. Running the human version first and automating from
its output is also the correct build order for an AI product — and it's the internal AI-ops
case study writing itself.

---

## 11. Build roadmap

| Week | Phase | Work | Owner |
|---|---|---|---|
| **1** · Aug 17–21 | Define | Qualifier questions + routing logic locked · call script v1 · extraction schema · report outline approved · recording tool and consent language chosen | Calvin |
| **2** · Aug 24–28 | The machine | Report template re-cut at new altitude · Megamine research playbook · extraction prompt + opportunity scoring · ROI calculator | Calvin · designer · AI engineer |
| **3** · Aug 31 – Sep 4 | The front door | Offer page · qualifier form · scheduler + routing · confirmation and nurture emails · Office Hours page · CRM stages | Fractional hire · designer |
| **4** · Sep 7–11 | Rehearse | Two dry-run calls with friendly past clients · full pipeline end to end · QA gate defined · fix what broke | Delivery pair |
| **5** · Sep 14–18 | Go live | First 5 Reality Checks from referrals · retargeting on · Office Hours #1 scheduled | Jeff · Calvin |
| **6–10** · Sep 21 – Oct 23 | Calibrate | LinkedIn ABM test · reach 10 completed reports · replace modeled rates with observed · size ad spend · decide on scorecard v2 | Fractional hire · Calvin |

### Owners

| Who | Owns |
|---|---|
| **Calvin** | The offer, call script, report template and copy, the first 20 report reviews |
| **Jeff** | Sourcing the first calls from referrals, running first calls, hosting Office Hours |
| **Designer** | Report template, live sketches on calls, offer page |
| **AI engineer** | Extraction, research pipeline, opportunity scoring, ROI calculator |
| **Fractional hire** | Form, scheduler, routing, emails, CRM, ad tests, reporting |

### Done when
A stranger can hit the offer page, qualify in 60 seconds, book, take the call, and receive a
report inside three business days — with no one assembling anything by hand except the review.

---

## 12. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | Who staffs the call? | **Two** — product lead runs the script, designer sketches live |
| 2 | Recording and transcription tool | Whatever integrates with the CRM; consent language is the real requirement |
| 3 | Report turnaround SLA | **3 business days.** Publish it — it's a differentiator |
| 4 | Monthly cap | **8** |
| 5 | Office Hours cadence and host | **Monthly, Jeff** |
| 6 | Report design | **Re-cut the existing template** at the altitudes in §6 rather than starting over |
| 7 | Who reviews the first 20 reports? | **Calvin. Non-delegable** |
