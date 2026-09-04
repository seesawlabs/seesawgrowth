---
name: one-thing
description: Research a company from its URL and produce the SeeSaw report, the LinkedIn messages and an email draft, then review before anything is sent. Cold outreach first ("write to <company>", "research <domain> for outreach", "run a report on <company>"), also inbound leads ("run the research on this lead"), and review ("is this safe to send", "review the run", "revise it"). Runs on GitHub Actions through gh; never runs the pipeline locally.
---

# /one-thing — research a company, draft the message, review before sending

The report, the LinkedIn messages and the email draft are produced by
`tools/exposure` running in GitHub Actions (`.github/workflows/analysis.yml`). This
skill collects the inputs the run needs, starts the run, downloads what it made, and
takes the reviewer through the gate. It never runs the pipeline on a laptop: the
runner is the one place where the API keys, Chrome, the evidence ledger and the
validation code are all known-good.

The person needs `gh` logged in to an account with write access to
`seesawlabs/seesawgrowth`. No API keys.

## The day this fits into

One target a day, worked in four steps. The skill owns step three only.

1. A teammate picks a company from the target list (`docs/03-targeting-report.md`).
2. They find the right person on LinkedIn — name and role. **The pipeline never
   touches LinkedIn**, and it should not: finding the person is judgement, and the
   research has no business logging into anything.
3. This skill runs the research from the company's URL and produces the report, the
   two LinkedIn messages and an email draft.
4. The teammate reads the review output, edits the message, and sends it themselves.

A day with no send is a real outcome. A null verdict, or a run with no dated
Verified opener, means write to someone else tomorrow rather than pad this one.

## The inputs

Most runs from this skill are **cold outreach**: the company has not asked us for
anything. Two things only are required, because two things are all a teammate knows
that the machine cannot find.

| Input | Why it is required |
|---|---|
| **Domain** | Where the research starts. Everything else is derived from it |
| **Recipient name and role** | The role decides how the idea is framed. A COO and a CEO get different first sentences, and only the person who found them knows which it is |

Worth offering, never demanded:

| Optional | What it does |
|---|---|
| `--category "one line, what they do and for whom"` | Aims peer discovery, the make-or-break stage. Give it when their homepage does not say it plainly |
| `--why-now "…"` **with** `--why-now-url https://…` | An override for something you saw that a crawl will not: a LinkedIn post, a regulator's notice, a trade story. The page is read and a verbatim passage that supports the note becomes a Verified claim. One without the other is refused |
| `--peers a.com,b.com` | Competitors you already know |
| `--known "…"`, `--history "…"` | Where you think their team burns time; anything they have already tried |

**The run finds the reason to write.** Stage 03b starts from the domain alone: it
reads their own news, press and blog pages for dated lines, then asks a
citation-backed search and a date-filtered news index. An item read on their own
page is Verified and may open a message we send. An item from a third party is
Cited: good for the call, never the opening sentence. If nothing dated turns up, the
report says so on the first page and the review gate blocks the send — that is the
honest outcome for a twenty-person company with a brochure site, and the answer is
another target, not a vaguer sentence.

### Ask like this

> To research **acme.com** for outreach I need two things: who it is to (name and
> role from LinkedIn), and the domain. Optional if you have it: one line on what
> Acme does and for whom, competitor domains, and anything you noticed that made
> you pick them today with the page that shows it.

For an **inbound lead** the inputs are the lead's own answers from the form (what
changed, where time burns, what they tried) plus name and email. The Slack link is
usually simpler for those; this path exists for laptops.

## Commands

Scripts live next to this file in `scripts/`. Run them from the repo root.

| Ask | Do |
|---|---|
| cold outreach | `scripts/run.sh --domain acme.com --to-name "Dana Whitfield" --to-role COO [--category "…"] [--why-now "…" --why-now-url https://…] [--peers a.com,b.com] [--known "…"] [--history "…"] [--to-email …]` |
| inbound lead | `scripts/run.sh --lead --domain acme.com --to-name "…" --to-email … [--changed "…"] [--burn "…"] [--tried "…"]` |
| status | `scripts/status.sh [run-id]` |
| review | `scripts/fetch.sh <run-id>` then `node scripts/review.mjs <downloaded dir>` |
| revise | `scripts/revise.sh --domain acme.com --run <pipeline runId> --notes "…"` |

`run.sh` checks the required inputs, packs them into the brief the pipeline expects,
dispatches the workflow (mode `cold` or `run`), and prints the GitHub run id and URL.
A run takes about ten minutes and about two dollars. The Slack channel gets the
report PDF, the email draft and the paste-ready LinkedIn pair when it finishes,
exactly as a form lead does. Do not poll in a loop; check when asked or after a
reasonable wait.

## What the run does

- **Stage 03b finds the dated reason to write**, from the domain alone: their own
  news, press and blog pages (read by us, so Verified, and the only openers we may
  use), a citation-resolved search, and a date-filtered news index (both Cited, so
  call material). Eighteen-month window. Absence language, near-miss company names,
  undated sources and prose that contradicts its own citation are all dropped, and
  the report lists the drops.
- **Stage 00 verifies a why-now you supplied.** The URL is read; a verbatim passage
  that supports the note becomes a Verified claim (`brief-1`). If the page does not
  support it, no claim is made and the report says so in "What the brief cited". The
  teammate's own words never become a claim.
- The category aims peer discovery; named competitors seed it.
- Everything else in the brief steers emphasis and is never cited.
- **Cold rules**, enforced in stage 07: opens with a dated Verified observation and
  cites it; one idea framed as a hypothesis; the ask is forty-five minutes; never
  "you told us" or any phrase implying they gave us information; never mentions
  hiring or job postings in the prose; Verified claims only, as always. The email is
  120 to 220 words.
- **The LinkedIn pair** is written in the same pass: a connection note of at most 300
  characters and a first message of 300 to 900, both measured on the text as it will
  be pasted, with the claim ids stripped. The annotated version, footnoted to the
  pages behind it, is at the end of `email-draft.md`.

## Reviewing a run

This is the part that matters. Run `fetch.sh` then `review.mjs`, then work through
what it prints **in this order**, and say what you find plainly:

1. **The banner.** Every warning the report carries: redactions, † citations, no
   dated Verified opener, no fork found, dead source URLs, thin coverage, a null
   verdict, a brief citation the page did not support.
2. **What changed at their company, and the brief evidence.** Is there at least one
   VERIFIED dated line — read on their own page — for the message to open with? If
   not, the send is blocked. Find a page that carries one and re-run with
   `--why-now`, or move to another target.
3. **The verdict.** `recommend` or `nothing_worth_a_call`. A null verdict is a real
   answer; check it is the honest read of the register, not a give-up on thin
   evidence. For cold outreach a null verdict means: do not write to them.
4. **The fork.** Do the two branches name different builds? Timing-only means the fork
   failed its own test.
5. **Buyer overlap.** Any peer marked `yes` is a real threat. Any `no` or `partial`
   must not be described as a threat in the email.
6. **The email draft.** Every † footnote is call material and cannot be sent as
   written. Every `[figure removed: unsourced]` marker is a number the model could
   not source. For cold outreach also read it as the stranger would: does the first
   sentence name something true and specific about them?
7. **The LinkedIn messages.** The character counts against 300 and 900, and the same
   reading: first sentence true, specific, about them, and no citation markers left
   in the pasted text. This is what actually gets sent, so it gets the closest read.
8. **Sources.** Non-2xx or 202 (bot challenge) pages are claims to re-check by hand.

`review.mjs` ends with `SEND-READY: yes` or `no` and the reasons. **Never present
the draft as ready to send while it says no.** Do not rewrite the draft to route
around a blocker: removing a † sentence is the reviewer's call, and replacing a
redacted figure is forbidden. Offer the revise path instead.

When it is clean, hand the reviewer the paste-ready LinkedIn note and message (also
in Slack, also at the end of `email-draft.md`), remind them that the email version
needs their own sign-off if they use it instead, and stop. Sending is done by a
person, from their own LinkedIn account or their own mail client.

## Revising

If the reviewer wants a different cut, run `scripts/revise.sh` with their notes
verbatim. It reuses the research, re-runs the analysis and the verdict, and posts
fresh documents to Slack in about two minutes for a few cents. The `--run` value is
the pipeline's run id, the timestamp-shaped folder name inside the artifact, which
`review.mjs` prints.

## Rules that travel with the report

These are enforced in code; the skill's job is to make sure nobody works around them.

- **No invented numbers.** Every numeral traces to a cited claim or is redacted.
  Never type a figure into a draft.
- **Outbound draws on Verified claims only.** Cited and Tool-data claims are call
  material. Ours never leaves unspoken.
- **Absences are marked.** "We could not see" is never rewritten as "they do not have".
- **The fork must fork.** A question counts only if the build differs by answer.
- **No is an answer.** A null verdict ships with the same rigour as a recommendation.
- **The brief is not evidence.** Only what the cited page says, verbatim, is.
- **Recency is a claim.** "Recently" with no dated, Verified source behind it is not
  written at all, in the email or the LinkedIn message.
- **The pipeline stays off LinkedIn.** It writes the message; a person sends it.

## When something is wrong with the run itself

- `run.sh` fails with 404 or 403: the account lacks write access to the repo, or `gh`
  is logged in to the wrong account. `gh auth status` shows which.
- The run fails in Actions: `status.sh` prints the failed step. Read the job log with
  `gh run view <id> --log-failed`. A 401 from a service means a wrong secret in the
  repo's Actions settings, not a code problem.
- No PDF in the artifact: Chrome was missing on the runner. The HTML is there.
- Artifacts expire after 14 days. `fetch.sh` keeps a local copy under `~/one-thing/`.
