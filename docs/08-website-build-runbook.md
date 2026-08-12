# Runbook — getting the offer live on the site

*Drafted 2026-08-11 · Owner: Calvin · Week 3 of `05-reality-check-spec.md` §11*

Step-by-step for shipping the messaging, CTA, qualifier, and scheduler. Ten steps, roughly
9 person-days, ~5 calendar days across two people.

**Platform:** seesawlabs.com is **Astro**. That matters in a good way — pages are files, you own
the codebase, and the qualification logic can live in your own endpoint instead of being rented
from a form product.

Existing paths for reference: `/our-work` · `/about-us` · `/the-lab` · `/digital-products` ·
`/ux-ui-design` · `/ai-consulting` · `/fractional-cto` · `/staff-augmentation` · `/contact-us`

---

## Step 0 · Decide the stack

**½ day. Must happen in Week 2, not Week 3** — every step below waits on it, and accounts take
a day to provision.

| Need | Recommendation | Why | Alternatives |
|---|---|---|---|
| **Form** | **Build it.** Astro island, `client:load` | The form *is* the qualification logic. Outsourcing it to Typeform means outsourcing the routing, and you're a dev shop | — |
| **Scheduler** | **Cal.com** | API-first, collective scheduling native, self-hostable, cheap | Calendly (routing needs Teams tier), HubSpot Meetings |
| **CRM** | **HubSpot free** | Free tier has contacts, deals, stages, and attribution. Ubiquitous, so the fractional hire will know it | Attio, Pipedrive |
| **Transactional email** | **Resend** | Templates as code, good deliverability, trivial API | Postmark; or HubSpot for v1 to cut a tool |
| **Internal alerts** | Slack incoming webhook | Ten lines | — |
| **Analytics** | Plausible or Fathom | Simple, no cookie banner | GA4 if you need the ad integration |

**Do not** put the qualifier in a third-party form builder. The scoring, gates, and routing are
the product; they need to live somewhere you can test.

---

## Step 1 · Decide what ships now and what waits

**½ day, mostly a conversation.** The most important step, because it's what stops this
becoming a positioning rewrite.

### Ships now — positioning-independent

- `/ai-reality-check` — the offer page and the whole funnel
- `/office-hours` — the routing destination
- `/ai-reality-check/booked` — confirmation
- One nav entry point to the offer

### Waits for Decision #1

- The homepage hero and the 14-item "Things We Do" list
- `/ai-consulting` rebuild
- The six case-study rebuilds
- Anything that makes a positioning claim

> **This is the unblocking move.** The Reality Check lives on a new URL that ads, LinkedIn, and
> referrals point at directly. It does not need the homepage to change, so it does not need
> Decision #1. Ship the funnel, leave the front door alone until positioning lands.

**The one homepage change worth making:** a single nav or banner entry point, so organic traffic
can find the offer. An offer name isn't a positioning claim, so it's safe.

**Explicitly out of scope this week:** touching the services list, rewriting `/ai-consulting`,
or "just improving" the homepage hero while you're in there. Note the temptation and don't.

---

## Step 2 · Write the messaging

**1 day.** Most of it exists already — `04-offer-project-plan.md` §7 has the offer-page copy and
`06-qualifier-spec.md` §2 and §6 have the form and outcome copy. This step is adaptation, not a
blank page.

Page sections in order, each with its job:

| Section | Copy source | Job |
|---|---|---|
| Hero | `04` §7 hero, adapted to the free offer | *"One hour with our team. You keep the assessment."* |
| The problem | `04` §7 problem block | Name the pilot-failure narrative |
| What you get | New — from `05` §6's ten sections | Make the free deliverable feel substantial |
| How the hour works | `07-interview-guide.md` §3, simplified | Remove the fear of a sales call |
| Who it's for / isn't | `04` §7, adapted | Qualification as copy |
| FAQ | `04` §7 FAQ | AEO blocks. Include the price answer |
| Close CTA | `06` §3 | Repeat the promise |

**Mark every wedge-dependent line** `[WEDGE]` in the source so they're findable when positioning
lands. There should be no more than three or four.

**The CTA, everywhere on the page:** *Book my Reality Check* → anchors to the form. One CTA, one
destination. No secondary "contact us" escape hatch competing with it.

---

## Step 3 · Build the page

**1½ days.** `src/pages/ai-reality-check.astro`.

1. Scaffold from an existing service page so header, footer, and type inherit.
2. Static sections first, form as a placeholder block. **Get the page reviewed before wiring
   anything** — copy changes are free now and expensive after the form is built.
3. Add the form island at the bottom, with a sticky or repeated CTA that scrolls to it.
4. `/office-hours` — a simple page: what it is, next date, a register form or Cal.com link.
5. `/ai-reality-check/booked` — the confirmation page.
6. Meta: title, description, OG image. This page will be shared into Slacks and forwarded.
7. **Do not `noindex` it.** It should rank for its own name and get cited.

---

## Step 4 · Build the form

**1½ days.** Three steps, per `06-qualifier-spec.md` §3.

- Client-side state across the three steps; nothing posts until the final submit.
- Validation per `06` §3 — remember Q4 is optional with **no** minimum.
- Conditional fields: "Something else" role → title; free email domain → website stays blank
  rather than pre-filled; "Something else" industry → text.
- Website pre-fill from the email domain, editable, and track `website_source` as
  `prefilled` | `user_corrected`.
- Accessibility: real `<fieldset>`/`<legend>` per question, `aria-describedby` on errors, visible
  focus, no colour-only error state.
- Analytics events on `form_view`, `step_1_complete`, `step_2_complete`, `form_submit`.

**Attribution — the detail that's easy to lose.** Capture UTMs, referrer, landing page, and
click IDs into `sessionStorage` on **first page view**, not at submit. Someone who lands on an ad,
reads the page, navigates to `/our-work`, comes back, and then submits will otherwise arrive with
no source. Read from `sessionStorage` at submit and pass as hidden fields.

> The working prototype (copy, steps, scoring, all three outcome screens) is already built —
> lift the logic from it rather than re-deriving.

---

## Step 5 · Build the endpoint

**1 day.** The core of the whole thing.

Astro specifics: if `output: 'static'`, put this in a platform function
(`api/reality-check.ts` on Vercel, `netlify/functions/` on Netlify). If hybrid, use
`src/pages/api/reality-check.ts` with `export const prerender = false`.

```
POST /api/reality-check
  │
  ├─ 1. Validate and normalise
  ├─ 2. Deterministic score        revenue 1 + role 2 + where 3 + ack 1  →  max 7
  ├─ 3. Apply gates                <$10M → office_hours
  │                                $10–50M → cap at manual_review
  ├─ 4. Route                      auto_book (≥6 or ICP override)
  │                                manual_review (3–5)
  │                                office_hours (<3)
  ├─ 5. Respond immediately        { route, bookingUrl? }
  │
  └─ 6. Fan out, non-blocking
        ├─ HubSpot: contact + deal, all fields from `06` §8
        ├─ Resend: the route's confirmation email
        ├─ Slack: alert if manual_review, with Q4 text and one-click actions
        └─ Async: LLM scores Q4 → patch the CRM record
```

### The LLM is not on the critical path — and that's a v1 simplification worth taking

Deterministic signals max out at **7**, and auto-book triggers at **6**. So a lead can auto-book
without the model running at all, and the ICP override keys off Q3 alone, which is also
deterministic.

The Q4 bonus (0–2) therefore only changes routing for deterministic scores of 4–5 — and those go
to manual review, where a human reads the raw text properly anyway.

**So for v1: route synchronously on deterministic score, run the LLM async to enrich the CRM
record.** No timeout risk, no failure mode, no latency on the response. Revisit in v2 if manual
review volume turns out to be mostly would-have-been-upgrades.

### Also

- **Idempotency.** Hash email + timestamp window so a double-click doesn't create two deals.
- **Never 500 on a fan-out failure.** If HubSpot is down, still return the route and still show
  the scheduler. Queue or log the CRM write and retry.
- Rate limit modestly. Log every submission raw before scoring, so a scoring bug is recoverable.

---

## Step 6 · Configure the scheduler

**½ day.** One event type: **AI Reality Check — 60 minutes.**

| Setting | Value | Why |
|---|---|---|
| Scheduling type | **Collective** — lead *and* sketcher both required | Round-robin would book one person alone and lose the live sketch |
| Duration | 60 min | |
| Buffer after | **15 min** | The five-minute debrief plus notes. Without it, back-to-back calls lose the judgment capture |
| Minimum notice | **2 business days** | Megamine's brief needs 24h. Without this someone books 9am tomorrow and you walk in cold |
| Max bookings per week | **3** | Enforces the 8/month cap at the calendar level, not by willpower |
| Timezone | Auto-detect | |
| Booking questions | **None** | You already have everything. Adding questions here is the most common way to lose a booking |
| Description | The bring-one-person ask **and** the recording consent line | Consent appears here, in the confirmation email, and verbally on the call |

Embed it on the auto-book outcome screen rather than redirecting off-site — a redirect is a
drop-off point.

---

## Step 7 · Emails

**1 day.** Five, per `06-qualifier-spec.md` §7.

1. **Booking confirmed** — time, who's attending, **recording consent**, the bring-one-person ask, two prep questions
2. **Manual review submitted** — "we're reading it, you'll hear from Jeff by tomorrow"
3. **Office Hours routed** — next dated session, last recording, come-back-anytime line
4. **24h reminder** — prep questions again
5. **Report delivered** — the assessment, plus one specific observation in the body

Send from a person's address, not `hello@`. Plain-text-leaning HTML — this is correspondence, not
a newsletter.

---

## Step 8 · CRM and attribution

**1 day.**

- Custom properties for every field in `06` §8, including `industry`, `industry_group`,
  `website_source`, `referred_by`, `total_score`, `route`, `gate_applied`.
- Deal pipeline stages: `Submitted → Booked → Call held → Report sent → Roadmap proposed →
  Roadmap won → Pod`.
- Lifecycle timestamps so you can measure turnaround against the 3-day SLA.
- A view for **manual review, unactioned, over 1 business day** — the SLA is meaningless without
  something that surfaces breaches.
- A dashboard with route distribution, source, and stage conversion.

> `referred_by` and the UTM set are what finally make source attribution real — the metric the
> audit said to track instead of traffic.

---

## Step 9 · Test before shipping

**½ day.** A broken route loses leads silently, so run all of it.

| # | Test | Expect |
|---|---|---|
| 1 | CTO · $180M · stalled · text · ack | Auto-book, scheduler shows |
| 2 | CTO · $6M · stalled · text · ack | Office Hours *(gate)* |
| 3 | CEO · $30M · stalled · text · ack | Manual review *(gate cap)* |
| 4 | Product · $70M · live-but-flat · **blank** · no ack | Auto-book *(ICP override)* |
| 5 | Product · $120M · exploring · blank · no ack | Office Hours |
| 6 | CTO · $500M · exploring · blank · ack | Manual review + Slack alert |
| 7 | Q4 left completely blank | Submits fine, no error |
| 8 | Four-word Q4: "Pilot stalled at integration" | Submits, scores specific |
| 9 | Role "Something else" | Title field appears, required |
| 10 | Industry "Something else" | Text field appears, required |
| 11 | Work email | Website pre-fills, `website_source = prefilled` |
| 12 | Gmail address | Website blank, required, `website_source` reflects entry |
| 13 | Land with `?utm_source=linkedin`, navigate away, return, submit | UTM present on the CRM record |
| 14 | Fill `referred_by` | Lands in CRM |
| 15 | Mobile, real phone | Tappable rows, native select, no zoom-on-focus |
| 16 | Double-click submit | One deal, not two |
| 17 | Break the CRM key deliberately | Route still returns, scheduler still shows, failure logged |
| 18 | Book a real slot | Both calendars blocked, 15-min buffer, confirmation email with consent line |
| 19 | Try to book tomorrow | Blocked by the 2-day minimum notice |
| 20 | Book 4 in one week | Fourth blocked by the weekly cap |

Tests 17, 19, and 20 are the ones that get skipped and shouldn't be.

---

## Step 10 · Ship, then watch

**¼ day.**

1. Deploy. Confirm the page renders for a logged-out visitor on a phone.
2. Submit one real booking yourself, end to end, and read the confirmation email as a stranger
   would.
3. Add the nav entry point.
4. Point one channel at it — referrals or LinkedIn organic. **Not ads yet;** ads wait for the
   calibration gate at 10 completed reports.

### First-week watch list

| Metric | Concern if |
|---|---|
| `form_view` → `step_1_complete` | Under 50% — the page isn't selling the hour |
| Step-to-step drop | A cliff at step 2 means the text box still reads as mandatory |
| Route distribution | Nearly all manual review means the gates or thresholds are miscalibrated |
| Q4 skip rate | Over ~70% — reword the prompt, **don't** reinstate a requirement |
| Manual review age | Anything over 1 business day is a broken promise |
| Report turnaround | Over 3 business days on the first one means the pipeline isn't ready |

---

## Sequencing and dependencies

| Step | Days | Owner | Blocks on |
|---|---|---|---|
| 0 · Stack | 0.5 | Calvin + fractional | **Do in Week 2** |
| 1 · Scope | 0.5 | Calvin + Jeff | — |
| 2 · Messaging | 1 | Calvin | 1 |
| 3 · Page | 1.5 | Designer | 2 |
| 4 · Form | 1.5 | Fractional / engineer | 0 |
| 5 · Endpoint | 1 | Engineer | 0, 4 |
| 6 · Scheduler | 0.5 | Fractional | 0 |
| 7 · Emails | 1 | Fractional + Calvin | 0 |
| 8 · CRM | 1 | Fractional | 0 |
| 9 · Test | 0.5 | All | 3–8 |
| 10 · Ship | 0.25 | Calvin | 9 |

**≈9.25 person-days ≈ 5 calendar days across two people.** It fits Week 3 (Aug 25–29) only if
Step 0 lands in Week 2 and the fractional hire has started.

**The standing risk:** steps 4–8 are mostly the fractional hire. If that hire hasn't started by
Aug 22, either Week 3 slips or Calvin absorbs a reduced version — decide which now rather than
in the middle of it.

---

## What can be cut if the week compresses

In order:

1. **Office Hours page** → route sub-threshold leads to an email invitation instead. Costs
   nothing structurally.
2. **Emails 4 and 5** (reminder, report delivery) → send manually for the first few.
3. **The CRM dashboard** → the underlying properties still get captured, so nothing is lost
   permanently.
4. **Plausible/analytics** → the CRM record still tells you route distribution.

**Never cut:** the endpoint's gate logic, attribution capture, the scheduler's minimum notice, or
test 17. Those are the ones that silently lose leads or waste calls rather than merely looking
unfinished.
