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
| Questions | 3 taps + 1 optional text + company block |
| Target time | **45–75 seconds** |
| Required fields | 8 |
| Free-text required? | **No** |
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
> *A few quick things about your situation. Takes about a minute.*

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

- We tried something and it stalled
- Something's live but it isn't delivering
- We're scoping a build now
- Planning for later this year
- Still exploring

> **This tap carries the ICP detection**, which is why it's the heaviest-weighted input.
>
> The first two options are the two flavours of burned buyer, and separating them matters: a
> stalled pilot and a shipped-but-ignored system are different conversations that need the same
> intervention. "Live but isn't delivering" is literally what *"95% show no measurable P&L
> impact"* looks like from the inside.
>
> An earlier draft folded trigger and timeline into one question, which meant someone with a
> stalled pilot *and* a Q4 restart had two true answers. State belongs here; timeline is
> implicit in it.

### Step 2 — An invitation, not a toll gate

**Q4 · What have you tried so far?** `textarea, optional`

Helper text: *A sentence is plenty. Skip it if you'd rather just talk — we'll cover it on the
call.*

**No minimum length. No validation. Not required.** No word counter.

> **Why this got loosened.** The first draft made this required with a 10-word floor, and both
> were wrong.
>
> A CTO who types *"Pilot stalled at integration"* — four words — has given us the highest-signal
> answer in the form, and a word floor rejects it and asks them to pad. Length is a bad proxy for
> substance, and senior people write terse.
>
> Worse, the original phrasing presumed prior attempts. A well-qualified buyer who hasn't tried
> anything yet was forced to type filler to clear the floor — polluting our most valuable field
> and then scoring zero on it, which pushed a good lead toward manual review. That's a systematic
> misroute against a whole segment, not an edge case.
>
> So the trigger detection moved to Q3, where a tap does it reliably, and this field became what
> it should always have been: an open door for people who want to tell us now. The raw text always
> reaches the human reviewer — never just its score.

### Step 3 — About you and the company

| Field | Type | Notes |
|---|---|---|
| Full name | `text, required` | |
| Work email | `email, required` | Validate format. Do **not** block free providers — some legitimate small-co buyers use them |
| Company | `text, required` | |
| **Company website** | `url, required` | **Always asked, pre-filled from the email domain.** See below |
| **Industry** | `select, required` | Grouped, wedge-first. See below |
| Anyone we should thank for the intro? | `text, optional` | Referral attribution for the #1 historical channel that currently has none |

#### Company website — always ask, pre-fill from the domain

Helper text: *So we can do our homework before the call.*

Deriving it silently from the email domain was the wrong call. In care operations especially —
roll-ups, PE portfolio companies, acquired brands — the email domain routinely isn't the
company's actual site: `@corp.parentco.com`, a legacy brand domain, a shared holding-company
tenant. A wrong or missing website degrades the research on **every** report, and research
quality is a core part of what makes the free deliverable worth an hour of their time.

So: pre-fill from the domain when it isn't a free provider, leave it editable, and require it.
Usually a glance-and-continue; occasionally a correction that saves the report.

#### Industry — grouped, wedge-first

`[WEDGE]` The grouping and the first four options depend on Decision #1. Swap the groups if
positioning lands elsewhere; the field itself stays.

> **Care operations**
> - Pharmacy / PBM / medication management
> - Hospice, palliative & post-acute
> - Dialysis & renal
> - Care management / value-based care
>
> **Healthcare, other**
> - Payer / health plan / insurtech
> - Provider group / health system
> - Health tech / digital health
> - Other healthcare
>
> **Other industries**
> - Financial services / fintech
> - Insurance (non-health)
> - Logistics & supply chain
> - Manufacturing / industrial
> - Professional services
> - Something else → reveals `text, required`

Three jobs, one tap:

1. **Proof-matching.** The report's matched case study is only as good as the segment we can
   place them in. "Healthcare" doesn't distinguish a specialty pharmacy from a health system;
   these options do.
2. **Research targeting.** Regulatory surface, vendor landscape, and comparable deployments
   differ enormously between hospice pharmacy and dialysis. The pipeline needs the sub-vertical,
   not the sector.
3. **It signals specialisation at peak intent.** A hospice pharmacy CTO opens the dropdown, sees
   their exact niche named first under a heading that describes them, and concludes we work with
   companies like theirs. Positioning, delivered through a form field.

Use a native `<select>` with `<optgroup>` — fourteen options as radio rows is a wall, and native
select is better on mobile, where most LinkedIn traffic lives.

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

### Score — 9 points

| Input | Points |
|---|---|
| Revenue $50M+ (any band above the gates) | 1 |
| Role: CTO/VP Eng · CEO/COO/Owner · Chief AI/Data/Digital | 2 |
| Role: Product leadership · Something else | 1 |
| **Where: tried something and it stalled · live but not delivering** | **3** |
| Where: scoping a build now | 2 |
| Where: planning for later this year | 1 |
| Where: still exploring | 0 |
| Budget acknowledged | 1 |
| **Q4 bonus** — names a system, a workflow, or what actually happened | +2 |
| **Q4 bonus** — real intent without specifics | +1 |
| **Q4 blank or vague** | **0 — never negative** |

Q4 is a **bonus, not a requirement.** Leaving it empty costs nothing it could have earned; it
never subtracts. That single property is what stops the form from punishing people who'd rather
talk than type.

### Routing

- **Auto-book** — score ≥ 6, **or** the ICP override
- **Manual review** — score 3–5, or gated at $10–50M
- **Office Hours** — score < 3, or gated under $10M

**The ICP override now keys off Q3 alone:** anyone answering *"tried something and it stalled"*
or *"live but it isn't delivering"* auto-books once they clear the gates, whatever the total.
That's the exact buyer, identified by a tap rather than by how well they write, and making them
wait a business day loses hot leads.

### Industry is captured, not scored

Deliberate, for two reasons.

The audit is explicit that we're healthcare-first in *proof and content*, not healthcare-only in
*sales* — "we still take the Bacardis and the Kountables." A wedge bonus would push an
equally-qualified fintech CTO to manual review while a weaker care-ops lead auto-books, which
inverts the strategy rather than encoding it.

More importantly, **positioning is still open.** Scoring the wedge now would bake Decision #1
into the routing logic before it's been made. Capturing without scoring keeps the model
positioning-independent — the same property preserved everywhere else in these docs.

Revisit once positioning locks *and* there is real conversion data by segment. Until then
industry drives proof-matching, research targeting, and the segment dataset behind the future
benchmark asset — not routing.

> The 11-persona validation below is therefore unaffected by adding this field.

### Scoring Q4 — length is not a criterion

LLM-scored against the three criteria above, and the prompt must say so explicitly:

> *"Pilot stalled at integration"* is **specific** — it names where it broke. Four words is
> enough. Score on whether the answer identifies a system, a workflow, or an outcome — never on
> how long it is.

The raw text always reaches the human reviewer alongside the score. Never let a model's read of
one sentence be the only thing between a real buyer and a booking.

### Validated against personas

| Persona | Score | Route |
|---|---|---|
| CTO, $180M dialysis operator, stalled, specific, ack | 9 | Auto-book |
| CTO, $6M startup, stalled, specific, ack | — | Office Hours *(gate)* |
| CEO, $30M, stalled, specific, ack | 9 | Manual review *(gate)* |
| VP Eng, $80M, scoping now, general, ack | 7 | Auto-book |
| Chief AI Officer, $600M, stalled, specific, no ack | 8 | Auto-book |
| CMO ("something else"), $400M system, stalled, specific, ack | 8 | Auto-book |
| **Terse: CTO, $200M, "Pilot stalled at integration", ack** | **9** | **Auto-book** |
| **Skipped the box: CTO, $150M, stalled, blank, ack** | **7** | **Auto-book** |
| **Hasn't tried anything: VP Eng, $90M, scoping, blank, ack** | **6** | **Auto-book** |
| **Live but flat: Product lead, $70M, blank, no ack** | **5** | **Auto-book** *(override)* |
| Product, $120M, exploring, blank, no ack | 2 | Office Hours |
| CTO, $500M, exploring, blank, ack | 4 | Manual review |
| Product, $150M, planning, general, no ack | 4 | Manual review |
| CTO, $2B, stalled, specific, ack | 9 | Auto-book |

The four bold rows are the cases the first draft got wrong. The terse answer was **blocked from
submitting at all**; the other three lost 2 points for an empty box and slid toward manual
review.

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
firm           revenue_band · industry · industry_group · email_domain
               website_source        <- prefilled | user_corrected
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
- **Never block on the LLM.** If Q4 scoring is slow or errors, treat the bonus as 0 and route on
  the rest of the score. The form must never hang on a model call — and since Q4 is a bonus, a
  scoring failure degrades gracefully instead of misrouting.
- **Watch the Q4 skip rate.** If more than ~70% leave it blank, the prompt is the problem, not
  the optionality. Reword it — don't reinstate a requirement.

---

## 10. Open decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Who owns the one-business-day manual review SLA? | **Jeff** — it's a relationship call. Calvin as backup |
| 2 | Auto-book threshold at 6, or tighten to 7? | **6**, with the ICP override. We have capacity headroom; a missed hot lead costs more than a wasted hour |
| 3 | ~~Hard 10-word floor on Q4?~~ | **Resolved — no floor, field optional.** Length isn't substance, and requiring it misroutes anyone who hasn't tried something yet |
| 4 | Show Office Hours date inline, or ask them to register? | **Inline with a date** — a specific date converts far better than "monthly" |
| 5 | Is `referred_by` free text or a picklist of named partners? | **Free text in v1.** Picklist once the referral programme has actual partners in it |
