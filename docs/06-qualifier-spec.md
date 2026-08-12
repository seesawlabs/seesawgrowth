# Spec — The qualifier form

*Drafted 2026-08-11 · Owner: Calvin · Build spec for `/ai-reality-check`*

The booking-page form for the free AI Reality Check. Supersedes §2 of
`05-reality-check-spec.md`, which sketched this at outline level.

Nothing gates the offer page itself — ads and referrals point straight at it. Friction lives
here, on the booking step, where it's earned.

---

## 1. At a glance

| | |
|---|---|
| Steps | 3 |
| Questions | 5 + contact |
| Target time | **60 seconds** |
| Required fields | 7 |
| Outcome | Auto-book · manual review · Office Hours |
| Score shown to user | **Never** |

Three steps rather than one page: a five-field page reads as long, and one-question-per-screen
reads as slow. Three chunks each with an obvious job tests best for this length.

Ordering is deliberate — three fast taps first, the free-text question fourth once they're
invested, contact last. The alternative (contact first, to capture abandoners) trades a
meaningful completion-rate hit for leads that are worthless without a story attached.

---

## 2. Page copy

> # Book your AI Reality Check
>
> One hour with our team. A written assessment in three business days — yours to keep whether
> or not we ever work together.
>
> *Five quick things about your situation. Takes about a minute.*

---

## 3. The questions

### Step 1 — Three taps

**Q1 · What's your role?** `radio, required`

- CTO / VP Engineering
- CEO / COO / Owner
- Chief AI, Data, or Digital Officer
- Product leadership
- Something else → reveals `text, required` "What's your title?"

**Q2 · Roughly, what's your annual revenue?** `radio, required`

- Under $10M
- $10M – $50M
- $50M – $250M
- $250M – $1B
- Over $1B

> The word "roughly" is doing real work — it measurably lowers resistance on a question people
> resent. Do not add a "prefer not to say" option; it becomes the modal answer and destroys the
> gate.

**Q3 · Where are you with this?** `radio, required`

- Something's stalled and we need to unblock it
- We're starting something this quarter
- Sometime this year
- Just exploring for now

> Option one is a self-identifying ICP flag. Timeline and trigger in a single tap.

### Step 2 — The question that matters

**Q4 · What have you already tried with AI — and where did it get stuck?** `textarea, required`

Helper text: *A sentence or two is plenty. We read every one of these.*

Validation: 10-word floor. On failure — *"A little more detail helps us prepare. What did you
try?"*

> This one question does three jobs: it identifies the burned buyer, it gives permission for
> things to have gone wrong (which is why "where did it get stuck" beats "what have you
> tried"), and it hands the call its opening. It is also the highest-weighted scoring input,
> and the raw text goes to whoever reviews — never just the score.

### Step 3 — Contact

| Field | Type | Notes |
|---|---|---|
| Full name | `text, required` | |
| Work email | `email, required` | Validate format. Do **not** block free providers — some legitimate small-co buyers use them |
| Company | `text, required` | |
| Company website | `url, conditional` | **Only shown if the email domain is a free provider.** Otherwise derive it from the domain — zero friction, and the research pipeline needs it |
| Anyone we should thank for the intro? | `text, optional` | Referral attribution for the #1 historical channel that currently has none |

Then, as visible copy above the button:

> The Reality Check is free and yours to keep. If we end up building together, engagements
> start at $50k.
>
> ☐ Makes sense

> Stated rather than demanded. A legalistic "I acknowledge…" checkbox reads adversarial and
> costs completions; this phrasing gets the same self-selection and still records the signal.

Submit button: **Book my Reality Check**

Privacy line beneath: *We'll only use this to prepare for your call. No list, no sequence you
didn't ask for.*

---

## 4. Hidden and derived fields

Source attribution was the audit's biggest measurement gap. Capture it here or it doesn't exist.

```
utm_source · utm_medium · utm_campaign · utm_content · utm_term
referrer · landing_page · first_touch_page
gclid / li_fat_id      (paid click IDs)
email_domain           (derived — company match + free-provider check)
submitted_at · time_on_form
```

---

## 5. Scoring and routing

**Hard gates first, then score.** Scoring alone misroutes: a $6M startup with a perfect stall
story scores 7/8 on merit and would auto-book — precisely the anti-ICP.

### Gates

| Condition | Outcome | Why |
|---|---|---|
| Revenue under $10M | **Office Hours**, always | Cannot clear a $50k build floor |
| Revenue $10M–$50M | **Capped at manual review** | Secondary ICP — the $10–20k/mo tier, not the growth engine |

### Score — 8 points

| Input | Points |
|---|---|
| Revenue $50M+ (any band above the gates) | 1 |
| Role: CTO/VP Eng · CEO/COO/Owner · Chief AI/Data/Digital | 2 |
| Role: Product leadership · Something else | 1 |
| Where: something's stalled · starting this quarter | 2 |
| Where: sometime this year | 1 |
| Where: just exploring | 0 |
| Q4 names a system, a workflow, or what actually happened | 2 |
| Q4 describes real intent without specifics | 1 |
| Q4 vague, aspirational, or under 10 words | 0 |
| Budget acknowledged | 1 |

### Routing

- **Auto-book** — score ≥ 6, **or** the ICP override: `stalled` + a specific Q4, at any score
- **Manual review** — score 3–5, or gated at $10–50M
- **Office Hours** — score < 3, or gated under $10M

The override matters: someone whose pilot has stalled and who can describe it precisely is the
exact buyer, and making them wait a day for review loses hot leads.

### Scoring Q4

LLM-scored against the three criteria above. The rubric must be explicit, and the raw text is
always surfaced to the human alongside the score. Never let a model's read of a sentence be
the only thing between a real buyer and a booking.

### Validated against personas

| Persona | Score | Route |
|---|---|---|
| CTO, $180M dialysis operator, pilot stalled, specific, ack | 8 | Auto-book |
| CTO, $6M startup, stalled, specific, ack | — | Office Hours *(gate)* |
| CEO, $30M, stalled, specific, ack | 8 | Manual review *(gate)* |
| VP Eng, $80M, this quarter, real plan, ack | 7 | Auto-book |
| Chief AI Officer, $600M, stalled, specific, no ack | 7 | Auto-book |
| CMO ("something else"), $400M system, stalled, specific, ack | 7 | Auto-book |
| VP Eng, $150M, this year, general, ack | 6 | Auto-book |
| Product, $120M, exploring, vague, no ack | 2 | Office Hours |
| CTO, $500M, exploring, nothing tried, ack | 4 | Manual review |
| Product, $150M, this year, general, no ack | 4 | Manual review |
| CTO, $2B, stalled, specific, ack | 8 | Auto-book |

---

## 6. The three outcomes

**Never show a score. Never say "you don't qualify."**

### Auto-book

> ## Let's talk.
>
> Pick a time below. You'll be talking to the two people who'd actually do the work — not a
> salesperson.
>
> **What to expect**
> - One hour. We'll ask about the workflow, the systems, and what happened last time.
> - **Bring one person who knows the process end to end.** It makes the hour twice as useful.
> - We record the call so we can build your assessment — you'll have it within three business
>   days.
>
> *[scheduler]*

Consent to record appears here **and** in the confirmation email, and is stated verbally in
the first minute of the call.

### Manual review

> ## Got it — thanks for the detail.
>
> We read every one of these properly. Jeff will come back to you by end of day tomorrow with
> times — or with a straight answer if we don't think we're the right fit for this.
>
> Either way you'll hear from a person, not an autoresponder.

Internal: Slack alert with the full Q4 text, score, and a one-click book / decline / Office
Hours action. **One business day SLA.**

### Office Hours

> ## Here's what we'd suggest instead.
>
> Based on where you are, the most useful next step is our monthly **Office Hours** — sixty
> minutes, eight to ten people, no charge. Bring your situation and ask about it directly.
>
> *[Save my seat]*
>
> In the meantime, here's the recording of last month's session.
>
> And if something changes — a project stalls, or your board asks for a number — come straight
> back.

Generous, specific, and it keeps the door visibly open. This segment is the nurture list, not
a dead end.

---

## 7. Emails

| Trigger | Send | Contains |
|---|---|---|
| Booking confirmed | Immediately | Time, who's attending, the recording consent, the bring-one-person ask, two prep questions |
| Manual review submitted | Immediately | "We're reading it, you'll hear from Jeff by tomorrow" |
| Office Hours routed | Immediately | Next session date, the last recording, the come-back-anytime line |
| 24h before call | Auto | Reminder + the two prep questions again |
| Report delivered | On send | The assessment, plus one specific observation in the email body |

---

## 8. CRM record

Every submission creates a contact and an opportunity, regardless of route.

```
contact        name · email · company · website · title · role_bucket
firm           revenue_band · email_domain
qualification  where_they_are · tried_raw_text · tried_score
               budget_ack · total_score · route · gate_applied
attribution    utm_* · referrer · landing_page · click_id
               referred_by            <- the "thank for the intro" field
lifecycle      route · booked_at · call_completed_at
               report_sent_at · roadmap_proposed_at
```

`referred_by` and the `utm_*` set are what finally make source attribution real — the metric
the audit said to track instead of traffic.

---

## 9. Build notes

- **Mobile first.** Radio options as full-width tappable rows, minimum 44px targets. Most
  LinkedIn traffic is mobile.
- **No progress bar with percentages** — "Step 2 of 3" is honest and doesn't imply more work
  than there is.
- **Autosave between steps** to analytics only, not the CRM. Partial records without email
  aren't leads; they're drop-off data.
- **Analytics events:** `form_view · step_1_complete · step_2_complete · form_submit ·
  route_assigned · scheduler_shown · booking_complete · office_hours_signup` — all dimensioned
  by source.
- **Accessibility:** real `<fieldset>`/`<legend>` per question, visible focus states, errors
  tied by `aria-describedby`, no colour-only error signalling.
- **Never block on the LLM.** If Q4 scoring is slow or errors, route to manual review and
  carry on. The form must never hang on a model call.

---

## 10. Open decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Who owns the one-business-day manual review SLA? | **Jeff** — it's a relationship call. Calvin as backup |
| 2 | Auto-book threshold at 6, or tighten to 7? | **6**, with the ICP override. We have capacity headroom; a missed hot lead costs more than a wasted hour |
| 3 | Hard 10-word floor on Q4, or score-only? | **Keep the floor.** Friendly copy, and it stops one-word submissions reaching review |
| 4 | Show Office Hours date inline, or ask them to register? | **Inline with a date** — a specific date converts far better than "monthly" |
| 5 | Is `referred_by` free text or a picklist of named partners? | **Free text in v1.** Picklist once the referral programme has actual partners in it |
