# The package: brief + 45-minute session

Dated 2026-08-26. Supersedes the two-offer structure in `04` and `05` where they
conflict. Written after team feedback that the analysis and the call should be
sold as one thing.

## What changed, and what didn't

The pipeline is untouched. A lead qualifies, a human decides whether to run the
brief, the brief runs, an operator iterates and releases it over a magic link.
None of that moves. "Iterates" used to mean editing a run by hand or paying to
regenerate it; it is now a `revise` command and a Slack link — see
`sites/reality-check/DEPLOY.md` §3a — that rewrites the draft against typed
notes for a few cents, reusing the research rather than redoing it.

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

### 3. Every lead sees the calendar

This was decided the other way first, and reversed on review. The original
reasoning was that a run costs about $1.90 and nine minutes of operator
attention, so the page should not put a calendar in front of someone we would
have to turn down.

The reversal is right. **A booked meeting we cancel costs one email. A qualified
lead who was told to wait for one costs the lead.** Scoring at the door is a
false economy when the false negatives are the expensive kind, and the routing
is a heuristic on five multiple-choice answers, not a judgement.

So the score no longer gates anything the visitor sees. Everyone is offered the
calendar, everyone gets the acknowledgement email, and the score goes to the
team in the Slack alert with an explicit instruction:

| Route | What the alert says to do |
|---|---|
| `auto_book` | Good fit. Run the analysis before the call if you can. |
| `manual_review` | Secondary ICP. Worth the call; decide on the analysis when you read this. |
| `not_yet` | Not a fit on the numbers. They can still book, so cancel the meeting and send the no. |

That last line is load-bearing and is covered by a check: a poor-fit lead now
has a meeting on someone's calendar, and the alert is the only thing that says
so.

#### The rejection, when you send it

This was written as an on-page message before the reversal, and it is better as
an email from a person. Draft:

> Subject: About that session
>
> Thanks for asking — and I want to be straight with you rather than take the
> 45 minutes.
>
> Our work starts at around $50k, and at your stage the honest answer is that a
> session with us would be two people speculating about your business at your
> expense. You'd get a thin analysis and forty-five minutes of generalities.
> I've cancelled the meeting rather than have you sit through that.
>
> What is actually useful today: the analysis we ran on our own company is
> published at [/sample-brief], unedited, including the parts where it tells us
> what we're missing. The structure is the useful bit — you can work through the
> same questions about your own business for nothing. Most of what makes AI work
> at your size is sequencing something boring before anything called AI: a data
> path, a record nobody keeps, one cheap test that saves a big build.
>
> When that changes — a stalled project, a board asking for a number, revenue
> where a real build makes sense — come straight back. We keep no list, so
> there's nothing to unsubscribe from and nothing stopping you.

Two things it does on purpose: it says the number, and it names what to do
instead. A rejection with neither reads as a brush-off, and this is the message
most likely to be forwarded.

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
3. `src/components/IntakeForm.astro` — the merged form and one confirmation
   state with the scheduler embedded, plus an error state that says the
   submission was lost rather than pretending otherwise
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
  delivery email is worded to work either way, and nothing reconciles a booked
  meeting against a rejection that was sent.
- Cancelling a poor-fit meeting is manual, and the only prompt is a line in a
  Slack message. If that gets missed, someone turns up to a call we did not
  intend to take. A calendar webhook plus a hold-and-confirm flow is the real
  fix when it is worth building.
