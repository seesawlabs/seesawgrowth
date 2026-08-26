# The package: brief + 45-minute session

Dated 2026-08-26. Supersedes the two-offer structure in `04` and `05` where they
conflict. Written after team feedback that the analysis and the call should be
sold as one thing.

## What changed, and what didn't

The pipeline is untouched. A lead qualifies, a human decides whether to run the
brief, the brief runs, an operator iterates and releases it over a magic link.
None of that moves.

What changes is the offer. It used to be two rungs — a free brief, and an hour
on a call if they wanted it. It is now one package:

> **A researched analysis of where AI pays off in your business, plus 45
> minutes with the people who wrote it.**

The call stops being an upsell at the end of a document and becomes half of
what was promised at the top. That fixes the weakest joint in the funnel: a
brief that lands in an inbox and hopes.

## Decisions taken here

Four were open. Rather than leave them, they are decided, with reasoning, so
they can be reversed on purpose rather than drifted away from.

### 1. One form, not two

The qualifier scored leads and booked calls. The brief intake collected the
research fields and scored nothing. Neither did the whole job, and the qualifier
in particular **does not ask for the one-liner or the competitor names** — the
two fields that decide whether a brief is sharp or generic. Five of seven test
targets derived a poor category query from their own meta description, and
naming competitors took one target from a single evidenced peer to three, and
90% coverage to 100%. Merging the two forms without carrying those fields across
would have quietly degraded every brief.

So there is one form. Field order puts the one-liner immediately after the
website, while the visitor is still fresh, because a rushed answer there costs
more than a rushed answer anywhere else.

### 2. Scoring stays deterministic

An LLM score was proposed and is deferred. The current score is gates followed
by weights, validated against 14 personas in `06` §5, and it lives in exactly
one module that both the form and the endpoint import. The team will eyeball
the Slack alert for v1. When a model does earn a place here it should write the
*qualitative* read — what stands out, what to open the call with — beside the
number rather than replacing it, so routing stays testable.

### 3. Three outcomes, and only one of them books instantly

The qualifier's routing survives, and now decides what the confirmation screen
offers:

| Route | What the lead sees |
|---|---|
| `auto_book` | Brief in preparation, and a scheduler on the page |
| `manual_review` | Brief in preparation, a time confirmed by email |
| `not_yet` | An honest "not the right fit for a build at this stage", the sample brief, and an open door |

A `not_yet` lead is not promised a brief. A run costs about $1.90 and nine
minutes of operator attention, and the strategy this sits inside is four to six
qualified opportunities a quarter, not volume. The operator can still choose to
run one; the page just does not commit us.

### 4. One offer means one page

`/reality-check` sold a one-hour call producing a written assessment in three
business days. `/sample` walked through that assessment's structure. Neither
describes what we now do — the written analysis arrives *before* the call, and
the call is 45 minutes.

Keeping them would leave two surfaces describing a retired offer, which has
been the recurring failure all week: stale copy in the page nobody was looking
at. So the site collapses to one offer:

- `/` sells the package and carries the form
- `/reality-check`, `/book`, `/brief` redirect to `/`
- `/sample` redirects to `/sample-brief`, which is a real brief rather than a
  structural walkthrough
- `05` and `06` stay in `docs/` as the record of how the hour and the scoring
  were designed; the interview guide in `07` is still what the session runs on

## The value of the 45 minutes

Written to be usable as copy. The frame is an attack on what a free
consultation normally is:

> You've had the call where you explain your business to someone taking notes.
> This isn't that.

**We've done the homework.** No twenty minutes of background. We open with our
read of the business and the lead corrects it. It is the fastest version of
this conversation that exists.

**We ask the questions that shape the roadmap.** The ones only they can answer:
volumes, cycle times, which manual step is quietly costing the most. The brief
names them explicitly, so the agenda is visible before they agree to the call.

**We say what we have watched fail.** The part research cannot supply. Nobody
publishes the pilot that died in security review, or the model that worked and
shipped to nobody. We have shipped this in healthcare operations — the platform
that cut medication approvals 5x at Hospice Pharmacy Solutions — and we have
seen the expensive dead ends.

**They leave with a sequence, not a list.** What to do first, what to park,
what has to be true before the next thing starts.

And the line that makes it credible: **if there is no fit, we say so inside the
45 minutes rather than in a follow-up sequence.**

Two things make this land better than it reads. The brief's "where your context
sharpens it" section is already the call's agenda, so the document sells the
session without a pitch. And 45 minutes rather than an hour is itself a claim:
we know what we are doing with the time.

## Build order

1. `src/lib/intake.ts` — one spec, importing the scoring from `qualifier.ts`
   rather than reimplementing it
2. `src/pages/api/intake.ts` — one endpoint: log, score, route, alert, ack
3. `src/components/IntakeForm.astro` — the merged form and its three
   confirmation states, with the scheduler embedded for `auto_book`
4. `/` — package copy
5. Redirects for the retired routes
6. `src/lib/email.ts` — both templates become package-aware
7. `tools/exposure/src/render/copy.ts` — the brief's closing CTA points at the
   session that was already promised, not at a fresh ask
8. Checks: prose, voice, intake, links, and the build

## What this does not fix

- A run still costs about $1.90 and takes nine minutes. Fine for a reviewed
  flow; not fine unattended.
- We cannot tell whether a lead booked. There is no calendar webhook, so the
  delivery email is worded to work either way.
- The `not_yet` copy is the hardest thing on the page to get right. It is a
  rejection, and it is the one message most likely to be forwarded.
