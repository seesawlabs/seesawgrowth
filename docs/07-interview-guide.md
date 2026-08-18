# Interview guide — the AI Reality Check call

*Drafted 2026-08-17 · Owner: Calvin · Week 1 deliverable · Companion to `05-reality-check-spec.md`*

The one-hour call that produces the Reality Check report. Written to be run by someone who
isn't Calvin or Jeff — that's the point of writing it down.

---

## Contents

| § | | Clock |
|---|---|---|
| 1 | [Before the call](#1-before-the-call) | −24h |
| 2 | [Who's on it, and who does what](#2-whos-on-it-and-who-does-what) | — |
| 3 | [The shape of the hour](#3-the-shape-of-the-hour) | — |
| 4 | [Open and consent](#4-open-and-consent) | 0:00–0:04 |
| 5 | [Block A · The stall story](#5-block-a--the-stall-story) | 0:04–0:14 |
| 6 | [The minute-12 checkpoint](#6-the-minute-12-checkpoint) | 0:12 |
| 7 | [Block B · The workflow](#7-block-b--the-workflow) | 0:14–0:30 |
| 8 | [Block C · Data and systems](#8-block-c--data-and-systems) | 0:30–0:39 |
| 9 | [Block D · People and adoption](#9-block-d--people-and-adoption) | 0:39–0:49 |
| 10 | [Block E · Constraints and the decision](#10-block-e--constraints-and-the-decision) | 0:49–0:56 |
| 11 | [Close](#11-close) | 0:56–1:00 |
| 12 | [Interviewing technique](#12-interviewing-technique) | — |
| 13 | [What not to do](#13-what-not-to-do) | — |
| 14 | [Must-capture checklist](#14-must-capture-checklist) | — |
| 15 | [Running behind](#15-running-behind) | — |
| 16 | [Difficult calls](#16-difficult-calls) | — |
| 17 | [Outlier branches](#17-outlier-branches) | — |
| 18 | [Immediately after](#18-immediately-after) | +5 min |
| 19 | [Fit assessment](#19-fit-assessment) | +1 day |
| 20 | [Report variants](#20-report-variants) | — |

---

## 1. Before the call

Thirty minutes of prep, not more. Most of it is reading what the pipeline already pulled.

| | |
|---|---|
| **Megamine brief** — run 24h ahead | Company, ownership, revenue, recent funding or M&A · their public AI announcements · vendor landscape in their sub-vertical · regulatory surface · comparable deployments · any competitor AI moves |
| **The qualifier record** | Their Q4 text verbatim, their Q3 answer, industry, revenue band, who referred them |
| **Their website** | The product, the segments they serve, careers page (AI roles being hired = real budget) |
| **One hypothesis, written down** | A single sentence: *"I think their expensive manual workflow is ___ and the reason the pilot died is ___."* Written to be wrong — it just gives the hour a spine |
| **The matched case study** | Which of our six is closest. Don't bring it up unless asked |

**Do not** prepare slides. Nothing gets presented on this call.

---

## 2. Who's on it, and who does what

| Role | During the call |
|---|---|
| **Lead** (product) | Asks. Owns the clock. Makes the minute-12 call |
| **Sketcher** (design) | Draws current and future state live. Asks at most two clarifying questions, in Block B or D. Shares screen at 0:56 |

The sketcher's near-silence is deliberate: two people asking questions turns an interview into
a panel, and the person being interviewed starts performing rather than thinking.

**Ask them to bring one person who knows the workflow end to end.** Confirmed in the booking
email and again at the open. An exec alone will describe the process as documented; the person
who does it will describe the process as it happens. That gap is usually where the opportunity
is.

---

## 3. The shape of the hour

| Clock | Block | Job |
|---|---|---|
| 0:00–0:04 | Open and consent | Permission, framing, expectations |
| 0:04–0:14 | **A · The stall story** | What they tried, what happened, why it stopped |
| *0:12* | *Checkpoint* | *Run the full script, or pivot* |
| 0:14–0:30 | **B · The workflow** | End to end. **Volume and time per unit live here** |
| 0:30–0:39 | **C · Data and systems** | What exists, who owns it, what the compliance surface is |
| 0:39–0:49 | **D · People and adoption** | Who changes behaviour, and who sponsors that |
| 0:49–0:56 | **E · Constraints and decision** | Budget, timeline, who else decides, cost of inaction |
| 0:56–1:00 | Close | Sketch share, report date, one commitment |

Block B is the longest because it carries the two mandatory extraction fields. If the hour
overruns, it should overrun into B — never out of it.

---

## 4. Open and consent

*0:00–0:04. Say this more or less verbatim — it sets everything downstream.*

> "Thanks for the hour. Let me tell you how this works so nothing's a surprise.
>
> We're going to spend most of it asking about your situation — the workflow, the systems, and
> what happened the last time you tried something. In three business days you'll get a written
> assessment back: where we think the value is, what we'd do first, and honestly, what we
> couldn't figure out from one conversation. It's yours to keep and forward, whether or not we
> ever work together.
>
> **We record so we can build that.** Is that alright with you?
>
> Two things worth saying up front. I'm not going to pitch you anything — if there's a fit
> we'll both know by the end, and if there isn't I'll tell you. And Maya's going to be quiet
> and drawing the whole time; she'll show you what she's got at the end.
>
> Start wherever you like, but I'd like to begin with what you've already tried."

**Consent is not optional and not implied.** If they decline recording, take manual notes, say
the report will take an extra day, and flag it — a no-recording call needs a second person on
notes.

---

## 5. Block A · The stall story

*0:04–0:14. The most important ten minutes. This is where you find out whether they're the
buyer we think they are.*

### Must ask

- **"Tell me about what you already tried."** *(Open. Let them run for two minutes without
  interrupting.)*
- **"When did it stop moving — and what was the conversation when it did?"**
- **"Who owned it?"**
- **"What's the story internally about why it didn't land?"** *(Note: the story, not the truth.
  The gap between them is diagnostic.)*

### If time

- "Was it built in-house, with a vendor, or bought off the shelf?"
- "What did it cost, roughly?"
- "Is it still running, or has it been switched off?"
- "Who was disappointed?"
- "If you ran it again tomorrow with the same team, what would you do differently?"

### What a thin answer sounds like, and how to open it up

| Thin | Probe |
|---|---|
| "It just didn't get traction." | *"Traction with whom? Who was supposed to use it?"* |
| "The technology wasn't there yet." | *"What specifically did it get wrong?"* |
| "We deprioritised it." | *"What got prioritised instead — and who made that call?"* |
| "It's still in progress." | *"When did it last ship something? What's it waiting on?"* |
| "We're happy with it, actually." | *"How do you know? What are you measuring?"* ← often uncovers a live-but-flat system |

> **The single most useful question in the whole hour:** *"Has a tool ever been rolled out here
> that people quietly stopped using?"* Ask it in Block A if it fits, Block D if not. The answer
> is almost always yes, and it's almost always the real story.

---

## 6. The minute-12 checkpoint

The lead makes a silent judgment at roughly minute twelve. Four questions:

1. Is there a **real, expensive, repeated workflow** here — or just an interest in AI?
2. Is the **person on this call** connected to the money?
3. Did the qualifier tell the truth about size and situation?
4. Is there anything we could **honestly** write eight pages about?

**All four yes → run the script as written.**

**Any no → pivot** to §17. Do not spend forty-eight more minutes being polite and then produce
a report that pretends an opportunity exists. Pivoting well is more valuable to them and to us
than finishing the script badly.

---

## 7. Block B · The workflow

*0:14–0:30. Sixteen minutes, the longest block, because the mandatory numbers live here.*

Frame it: *"Walk me through the process the way it actually happens — not the way it's
documented."*

### Must ask

- **"Take me through it from the trigger to done. Who touches it, in what order?"**
- **"How many of these go through per week or month?"** ← **mandatory field**
- **"How long does one take, end to end? And how much of that is someone actually working on
  it versus waiting?"** ← **mandatory field**
- **"Where does it break, or come back for rework?"**
- **"How often does it get done wrong, and what happens when it does?"**
- **"What does the person doing this have open on their screen? How many systems?"**

### If time

- "Who's the bottleneck — is it one role, one person, or a queue?"
- "What happens at volume spikes? Month-end, enrolment season, a big referral batch?"
- "Which step would the team say is the most annoying?"
- "Has anyone ever timed this?"
- "What's the cost of getting it wrong — rework, a denial, a re-submission, a safety event?"

### Getting the numbers when they don't have them

They usually won't have measured it. Do not accept "I don't know" and do not invent a figure.
Bracket it instead:

> *"Rough is fine — I'll label it as an estimate. Is it closer to fifty a week or five hundred?"*
>
> *"And one of them: ten minutes, or half a day?"*

Then read it back: *"So call it two hundred a week at about twenty minutes each — I'll put that
in as an estimate from you, and we'll say where it came from."*

That read-back does two things: it gets consent for the figure, and it makes the report's
`Est.` labelling honest rather than a hedge we applied afterwards.

> **If you leave this block without volume and time-per-unit, you do not have a report.** Say
> so on the call and agree who will send the numbers.

---

## 8. Block C · Data and systems

*0:30–0:39.*

### Must ask

- **"What systems hold the data this would need?"** *(Get names, not categories.)*
- **"Who controls access to those? What would it take for someone outside to get a look?"**
- **"Is PHI in scope? What about PII beyond that?"**
- **"Do you have BAAs in place with your current vendors?"**
- **"Is the data any good? Complete, current, consistent?"**

### If time

- "Is there a warehouse, or does everything live in the source systems?"
- "Has anyone integrated against these before? How did that go?"
- "Who'd be the internal engineer we'd work alongside?"
- "Anything on-prem, or air-gapped?"
- "Is there an audit trail requirement?"

### The tell to listen for

*"We'd have to ask IT"* said about their **own** data is the single strongest predictor of a
stalled build. Follow it: *"Who is IT, in this case — and are they aware this is coming?"*

---

## 9. Block D · People and adoption

*0:39–0:49. Our differentiator. Nobody else's discovery call spends ten minutes here.*

### Must ask

- **"Who would actually use this, by role? How many of them?"**
- **"Walk me through their day. Where does this workflow sit in it?"**
- **"What would have to change about how they work — and what's their incentive to?"**
- **"Who's their manager, and would that person sponsor the change?"**
- **"Has a tool ever been rolled out here that people quietly stopped using?"** *(If not already
  asked.)*

### If time

- "Who on that team is respected? Would they champion this or resist it?"
- "Is anyone's headcount or comp affected if this works?"
- "How do they find out something new is coming? Is there training?"
- "Would they trust a recommendation from a model? Has anyone asked them?"
- "If this shipped and nobody used it, who would notice, and how long would it take?"

### What you're really testing

Whether there is a **named person whose behaviour must change** and a **named person who
sponsors that change.** If either is missing, adoption scores low in the report and the honest
recommendation is to fix that before building. Say it in the report — that's the section nobody
else writes.

---

## 10. Block E · Constraints and the decision

*0:49–0:56. Do not skip this to keep the mood pleasant. An unqualified opportunity wastes their
time as much as ours.*

### Must ask

- **"If you did move on this, roughly what would you expect it to cost?"** *(Their number
  first. Always.)*
- **"Who besides you would need to say yes?"**
- **"Is there a date this is tied to? A board meeting, a contract, a season?"**
- **"What happens if nothing changes for twelve months?"**

### If time

- "Is there budget allocated, or would it need to be found?"
- "Have you bought anything like this before? How did that process work?"
- "Is procurement or legal going to be involved, and how long do they usually take?"
- "Is anyone else looking at this with you?" *(i.e. are we one of three quotes)*
- "What would make you decide not to do anything?"

### On price

If they ask what a build costs, answer plainly — don't defer:

> "Roadmap engagements are $25,000 and three weeks, credited in full if you go on to build with
> us. Builds run $40–50k a month as an embedded team, typically six to twelve months. If that's
> wildly off from what you had in mind, better we both know now."

Vagueness about price reads as a setup for a big number. Directness reads as confidence and
qualifies in the same breath.

---

## 11. Close

*0:56–1:00.*

1. **Sketcher shares screen.** Thirty seconds: *"This is what I heard your process looks like
   today, and this is roughly where it could go. Have I got it wrong anywhere?"* — Their
   corrections here are gold, and this is the moment the call stops feeling like a sales call.
2. **Confirm the report date.** *"You'll have the assessment by Thursday."*
3. **Name the one thing you'll dig into.** *"The part I want to think hardest about is whether
   your eligibility data is clean enough to drive this automatically."*
4. **One ask, if anything is missing.** *"Could you send me the monthly volume figure? That's
   the one number I'd hate to estimate."*
5. **Do not pitch.** No next-step close, no proposal talk. The report does that work.

---

## 12. Interviewing technique

- **Open, then narrow.** Every block starts with an open question and tightens. Never lead with
  the specific one.
- **Ask about the last time, not the general case.** *"Walk me through the most recent one"*
  beats *"how does it usually work"* — memory produces detail, generalisation produces the org
  chart.
- **Use silence.** Three seconds after they stop talking. Most of the good material arrives in
  the second half of an answer, after the rehearsed part.
- **Ladder on nouns.** They say "the intake process" — ask *"what happens in intake?"* Repeat
  until you hit a person doing a thing on a screen.
- **Read numbers back.** *"So roughly two hundred a week?"* Consent and accuracy in one move.
- **Play back the emotion once.** *"It sounds like that was frustrating for the nursing team."*
  It buys more candour than any question.
- **Ask the naive question.** *"Sorry — why does that step exist?"* is the highest-yield
  question in any process interview and you get one free pass on it.
- **Write down verbatims.** The report needs three, attributed by role. Mark them live; you
  won't find them again in a transcript.

---

## 13. What not to do

- **Don't pitch.** Not once. You said you wouldn't at minute two.
- **Don't solve it on the call.** The instinct to say "oh, you could just—" is the single
  biggest quality risk. You lose the diagnosis, you give away the thinking unpriced, and you
  anchor them on the first idea anyone had. Write it down and put it in the report.
- **Don't diagnose out loud.** *"That sounds like a data problem"* forecloses the next fifteen
  minutes.
- **Don't defend the industry or another vendor.** If they trash a tool, let them.
- **Don't fill silence.**
- **Don't take a number you didn't hear.** If they don't say it, it isn't in the report.
- **Don't promise scope.** No "we could definitely build that in six weeks."
- **Don't run over.** End at the hour even mid-sentence — ask to follow up. Respecting the box
  is part of the product.

---

## 14. Must-capture checklist

Keep this visible. Glance at it at minute 45; if anything's blank, you have eleven minutes.

- ☐ Stalled initiative — what, when it stopped, stated reason, who owned it
- ☐ Target workflow — steps and actors, in order
- ☐ **Volume per period** ← mandatory
- ☐ **Time per unit** ← mandatory
- ☐ Rework or error rate
- ☐ Named systems (not categories)
- ☐ Data owner / access path
- ☐ PHI and compliance surface
- ☐ End users by role, and headcount
- ☐ The sponsor for behaviour change
- ☐ Prior adoption failure
- ☐ Budget expectation — **their** number
- ☐ Other deciders
- ☐ Timeline or trigger date
- ☐ Cost of inaction
- ☐ **Three verbatim quotes**, attributed by role

---

## 15. Running behind

Cut in this order. Never cut Block B.

1. Block A "if time" questions — the qualifier text already covers some of it
2. Block C detail — systems can be chased by email, and Megamine covers some of it
3. Block E "if time" questions — but **never** the four must-asks
4. Block D's second half — though this is the differentiator, so cut it last of the four
5. **Never:** the volume and time questions, the sponsor question, or the sketch share

If you're at minute 40 and still in Block B, that's fine. Email the Block C questions the same
day.

---

## 16. Difficult calls

| Situation | Handling |
|---|---|
| **The talker.** Twenty minutes of company history. | Interrupt warmly and specifically: *"This is useful — can I jump us forward, because I want to make sure we get to the workflow itself."* Do it at minute 8, not minute 25 |
| **The guarded one.** Short answers, won't share numbers. | Stop asking for figures and ask for a story: *"Walk me through the last one that went badly."* Narrative gets past confidentiality reflexes. Offer an NDA and move on |
| **The delegate.** Sent someone with no authority. | Run the call properly — they're often the best source on the workflow. Then at close: *"Who else should see this when I send it? Happy to walk them through it."* Get the buyer's name |
| **The committee.** Six people join. | Name the shape early: *"I'll mostly be asking [name] about the workflow — jump in anywhere."* Direct questions to individuals, never the group. Get the quiet operations person talking; they know the truth |
| **The interrogator.** Wants to interview *us* the whole hour. | Give ten honest minutes, then: *"I'd rather spend the rest on your situation, or the report won't be worth much. Can I send you the credentials material after?"* |
| **The recon call.** A competitor or agency fishing. | The Megamine brief usually catches this beforehand. If it surfaces live, stay generous and generic, end at 30 minutes, don't produce a report |
| **No recording consent.** | Second person switches to full notes, report slips a day, flag it in the record |

---

## 17. Outlier branches

The script assumes an operator with an expensive workflow and a stalled attempt. Here's what to
do when that's not what's on the call.

### A · Totally pre-product

*No workflow, no data, no volume. An idea and possibly funding.*

Sections 3–8 of the report all depend on an existing process. There is nothing honest to write
about value at stake, because there's no baseline.

**Pivot at minute 12** to three questions:

1. "What has to be true for this to be a real business in eighteen months?"
2. "Who's your first ten customers — named?"
3. "What's the riskiest assumption, and how would you test it cheapest?"

**Then split on funding and domain depth:**

| | Route |
|---|---|
| **Funded ($2M+) and deep domain expertise** | Secondary ICP. Real fit for a smaller package — design sprint or MVP scope, $10–20k/mo tier. Not a pod, not a Roadmap. This is the Kountable/LineDance shape, and it's historically been good business |
| **Unfunded, or domain-thin** | Office Hours and a genuinely useful "here's what you'd need in place" note. No report |

**The report variant:** the *Not-viable-yet* version (§20). Its job is to name honestly what has
to exist before an AI build makes sense. Counter-intuitively this is the most trust-building
document we can send, and pre-product founders forward it more than anyone.

> Do not stretch a pre-product call into a standard report. It requires inventing a baseline,
> which means inventing a metric.

### B · The whale who wants a small first project

*Enterprise-scale account — the DISCO-shaped case — asking for something far below our floor as
a first step.*

**This is not the anti-ICP. Read it correctly.** The audit's anti-ICP is a sub-$10k
discovery-only project at a company that will never be bigger. A small first project at a $1B+
account is a **paid audition**, and it's how almost every large account actually starts. The
test is not size. **The test is whether there's a named path behind it.**

Ask these, in this order:

1. **"What's the bigger thing this is a first step toward?"**
2. **"Who owns the budget for *that* — and are they part of this conversation?"**
3. **"If this first piece goes well, what would you want next, and roughly when?"**
4. **"What would make you say this one worked?"**
5. **"What happens to this if the first piece goes badly — does the bigger thing die, or find
   another route?"**

**Take it only if all four hold:**

- ☐ The larger workflow or programme is **named**, not gestured at
- ☐ The economic buyer for it is **identified** — ideally on the call, at minimum named
- ☐ There's a **stated trigger** for the expansion (a date, a milestone, a budget cycle)
- ☐ It's at **full rate.** No discount to win the audition — a discount teaches the account
  what we cost, and it's nearly impossible to unteach

**And two structural guardrails:**

- **A floor of $25k on any first engagement.** Below that the setup cost eats it and it reads as
  staff aug. If they want less than $25k of work, sell the Roadmap instead — it's the
  right-sized first paid step and it's designed for exactly this.
- **The Roadmap credit does not apply.** The credit exists to convert into a pod. A small pilot
  isn't a pod, and crediting against it gives away $25k for a $30k engagement.

**If it fails the test** — no named larger thing, or no identified buyer — the honest move is to
sell the Roadmap and say why:

> "I'd rather not start with a small build, because I don't yet know enough to make it the right
> small build. Three weeks and $25k gets us both a real answer, and it comes off the first month
> if you go ahead."

**Note on entry point:** at genuine enterprise scale the Reality Check may not be the right door
at all — procurement often can't engage without a contract vehicle. If they're a $1B+ account with
active procurement, route to a scoped paid engagement and treat the free call as relationship
groundwork rather than as a funnel step.

### C · "Should we buy or build?"

They want a vendor recommendation, not a build partner.

Legitimate and answerable, and answering it honestly is powerful — we're one of very few people
in the conversation with no reason to sell them software. Run the workflow block properly, then
the report's *where to start* section names the buy option where buying is right.

Watch for: this is often a whale-audition in disguise. The build lands after the buy
disappoints. Worth being genuinely useful here.

### D · Staff augmentation in disguise

*"We just need two engineers for six months."*

The audit is explicit that we're doing less of this. Don't run the full script — pivot at
minute 12:

> "That's honestly not what we're best at, and you'd be paying our rate for something a staffing
> firm does cheaper. What I'd be useful for is the part where you decide *what* those two
> engineers should build. Want me to spend the rest of this hour on that instead?"

Either it converts into a real scoping conversation, or it ends early and honestly. Both are
better outcomes than a reluctant staff-aug engagement.

### E · Third quote

They already have a partner or are running a formal comparison.

Ask directly: *"Are you looking at this with anyone else?"* If yes:

- Ask what the others have proposed. It's free competitive intelligence and they'll usually tell
  you.
- **Don't compete on the same axis.** If the others quoted a build, the differentiated move is
  the adoption question nobody else asked.
- Deliver the report anyway. It's the best possible proof of how we think, and it frequently
  wins the second round even when it loses the first.

### F · Data isn't accessible and nobody owns fixing it

Named in the audit as anti-ICP, and rightly. But say it precisely — this is a *sequencing*
problem, not a disqualification.

Report as *Not viable yet* with a specific first step: who needs to own data access, and what
"ready" looks like. Then set a real follow-up date. These convert later at a good rate, because
we were the ones who told them the truth.

### G · Great fit, no budget this year

Deliver the full report. Then:

- Ask what the budget cycle is and when it opens.
- Ask what would have to be true to pull it forward.
- Put them in nurture with a **dated** re-contact, not a vague one.
- Invite them to Office Hours.

A report in the hands of someone who'll have budget in five months is a good use of an hour.

### H · Compliance or legal is a hard blocker

*"Legal won't let us put PHI near a model."*

Real, common, and often soluble — a lot of it is unexamined policy rather than regulation. Ask:

- "Is that a written policy, or a position someone holds?"
- "Who wrote it, and when?"
- "Is there a de-identified or on-prem version of this that clears it?"

If it's genuinely immovable this year, the report says so and names the architecture that would
change the answer. That document has a long shelf life.

---

## 18. Immediately after

**Five minutes, before anything else.** The lead and sketcher, no exceptions.

1. **Say the headline out loud** — one sentence on where the value is. Record it; it becomes the
   report's section 2.
2. **Fill the checklist gaps.** Anything blank in §14 → who's chasing it, by when.
3. **Log the three verbatims** while you can still hear them.
4. **Write the one thing you'd have asked with another ten minutes.** It usually belongs in
   section 9, *what we couldn't determine*.
5. **Call the fit** — §19, provisionally.

The transcript captures words, not judgment. This five minutes captures the judgment.

---

## 19. Fit assessment

Post-call, before the report is written. Six checks — this determines which report variant gets
built and what, if anything, gets proposed.

| | Check |
|---|---|
| ☐ | A named workflow with **volume and time** figures |
| ☐ | An **economic buyer** engaged or identified |
| ☐ | Data accessible, **or** an owner for making it so |
| ☐ | A **sponsor** for the behaviour change |
| ☐ | A **trigger** — date, board, contract, season |
| ☐ | Budget expectation consistent with **$50k+** |

- **5–6 → Standard report, and propose the Roadmap.**
- **3–4 → Standard report, propose the Roadmap, and name the gaps as the reason it's needed.**
- **1–2 → *Not viable yet* report.** No Roadmap proposal. Dated follow-up instead.
- **0 → Short honest note**, an Office Hours invitation, and no report.

Being willing to reach the bottom two rows is what makes the top two credible.

---

## 20. Report variants

| Variant | When | Shape |
|---|---|---|
| **Standard** | Fit 3–6 | The ten sections in `05-reality-check-spec.md` §6 |
| **Not viable yet** | Fit 1–2, pre-product, data-blocked, compliance-blocked | Shorter. What we heard · why we'd wait · **what has to be true first** · what to do in the next 90 days without us · what would change our answer. No fabricated value figures, no opportunity matrix |
| **Enterprise / small-first** | Whale passing the §17-B test | Standard, plus an explicit *"the small first piece and what it proves"* section, and the named larger programme with its own path to production |

> The *Not viable yet* variant is not a consolation prize. It is the highest-integrity thing we
> produce, it costs us nothing but honesty, and it is the version most likely to be forwarded to
> someone with budget.
