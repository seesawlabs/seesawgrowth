---
name: one-thing
description: Research a company and produce the SeeSaw report and email draft, then review before anything is sent. Cold outreach first ("write to <company>", "research <domain> for outreach", "run a report on <company>"), also inbound leads ("run the research on this lead"), and review ("is this draft safe to send", "review the run", "revise it"). Runs on GitHub Actions through gh; never runs the pipeline locally.
---

# /one-thing — research a company, draft the email, review before sending

The report and the email draft are produced by `tools/exposure` running in GitHub
Actions (`.github/workflows/analysis.yml`). This skill collects the inputs the run
needs, starts the run, downloads what it made, and takes the reviewer through the
gate. It never runs the pipeline on a laptop: the runner is the one place where the
API keys, Chrome, the evidence ledger and the validation code are all known-good.

The person needs `gh` logged in to an account with write access to
`seesawlabs/seesawgrowth`. No API keys.

## The inputs are the quality lever

Most runs from this skill are **cold outreach**: the company has not asked us for
anything. That changes what the run needs. An inbound lead gives us three answers
about their situation; a cold target gives us nothing, so the teammate has to supply
what the form would have, and one thing more: a specific, dated, sourced reason to
write *now*. Without it the email is a generic pitch with a research appendix, and
the whole point of this offer is that it is not that.

So the skill refuses to start a cold run without these. **Collect all of them from
the user before running anything.** Ask in one message, not a chain of questions.

| Input | Why it is required |
|---|---|
| **Domain** | Where the research starts |
| **Recipient name and role** | The role decides how the idea is framed. A COO and a CEO get different first sentences |
| **Category, one line in your words** | What they do and for whom. It aims peer discovery, the make-or-break stage. A stranger's homepage rarely says it plainly |
| **Why now, in one sentence** | The dated, specific thing we noticed: a role posted, a launch, a funding round, a regulatory change, a new location. Not "they're growing" |
| **Why now URL** | The page that shows it. The pipeline reads the page and keeps a verbatim quote only if the page supports the note. That quote becomes the only thing the email may open with. No page, no run |

Optional, and worth asking for once: named competitors (domains), what we know about
where their team burns time, any prior contact or things we know they tried.

If the user cannot give a "why now" with a page, say so plainly and do not run. The
right move is to go find one (their careers page, their news page, LinkedIn posts,
the state regulator's site), not to run without it.

For an **inbound lead** the inputs are the lead's own answers from the form (what
changed, where time burns, what they tried) plus name and email. The Slack link is
usually simpler for those; this path exists for laptops.

### Ask like this

> To research **acme.com** for outreach I need: who it's to (name and role), one line
> on what Acme does and for whom, the dated thing we noticed that makes this worth
> writing now, and the URL of the page that shows it. Optional: competitor domains,
> what you know about where their team burns time, any prior contact.

## Commands

Scripts live next to this file in `scripts/`. Run them from the repo root.

| Ask | Do |
|---|---|
| cold outreach | `scripts/run.sh --domain acme.com --to-name "Dana Whitfield" --to-role COO --category "…" --why-now "…" --why-now-url https://… [--peers a.com,b.com] [--known "…"] [--history "…"] [--to-email …]` |
| inbound lead | `scripts/run.sh --lead --domain acme.com --to-name "…" --to-email … [--changed "…"] [--burn "…"] [--tried "…"]` |
| status | `scripts/status.sh [run-id]` |
| review | `scripts/fetch.sh <run-id>` then `node scripts/review.mjs <downloaded dir>` |
| revise | `scripts/revise.sh --domain acme.com --run <pipeline runId> --notes "…"` |

`run.sh` checks the required inputs, packs them into the brief the pipeline expects,
dispatches the workflow (mode `cold` or `run`), and prints the GitHub run id and URL.
A run takes about ten minutes and about two dollars. The Slack channel gets the
report PDF and the email draft when it finishes, exactly as a form lead does. Do not
poll in a loop; check when asked or after a reasonable wait.

## What the run does with the brief

- **Stage 00 verifies the why-now.** The URL is read. A verbatim passage that supports
  the note becomes a Verified claim (`brief-1`) with the page as its source. If the
  page does not support the note, no claim is made and the report says so in "What
  the brief cited". The teammate's own words never become a claim.
- The category aims peer discovery; named competitors seed it.
- Everything else in the brief steers emphasis and is never cited.
- **Cold email rules**, enforced in stage 07: 120 to 220 words; opens with the dated
  thing we noticed, cited to a Verified claim; one idea framed as a hypothesis; the
  ask is forty-five minutes; never "you told us" or any phrase implying they gave us
  information; never mentions hiring or job postings in the prose; Verified claims
  only, as always.

## Reviewing a run

This is the part that matters. Run `fetch.sh` then `review.mjs`, then work through
what it prints **in this order**, and say what you find plainly:

1. **The banner.** Every warning the report carries: redactions, † citations in the
   email, no fork found, dead source URLs, thin coverage, a null verdict, a brief
   citation the page did not support.
2. **The brief evidence.** Did the why-now page support the note? If not, the email
   has no dated opener and probably should not go out; find a better page and revise
   or re-run.
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
7. **Sources.** Non-2xx or 202 (bot challenge) pages are claims to re-check by hand.

`review.mjs` ends with `SEND-READY: yes` or `no` and the reasons. **Never present
the draft as ready to send while it says no.** Do not rewrite the draft to route
around a blocker: removing a † sentence is the reviewer's call, and replacing a
redacted figure is forbidden. Offer the revise path instead.

When the draft is clean, hand the reviewer the text from `email-draft.md`, remind
them to add their own sign-off, and stop. Sending is done by a person from their own
mail client.

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

## When something is wrong with the run itself

- `run.sh` fails with 404 or 403: the account lacks write access to the repo, or `gh`
  is logged in to the wrong account. `gh auth status` shows which.
- The run fails in Actions: `status.sh` prints the failed step. Read the job log with
  `gh run view <id> --log-failed`. A 401 from a service means a wrong secret in the
  repo's Actions settings, not a code problem.
- No PDF in the artifact: Chrome was missing on the runner. The HTML is there.
- Artifacts expire after 14 days. `fetch.sh` keeps a local copy under `~/one-thing/`.
