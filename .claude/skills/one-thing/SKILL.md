---
name: one-thing
description: Run the SeeSaw research report and email draft for a lead, then review it before anything is sent. Use for "run the research on <domain>", "run a report for <company>", "review the run", "is this draft safe to send", "revise the recommendation". Runs on GitHub Actions through gh; never runs the pipeline locally.
---

# /one-thing — run and review the research report

The report and the email draft are produced by `tools/exposure` running in GitHub
Actions (`.github/workflows/analysis.yml`). This skill starts that run, waits for it,
downloads what it made, and takes the reviewer through the gate. It never runs the
pipeline on a laptop: the runner is the one place where the API keys, Chrome, the
evidence ledger and the validation code are all known-good, and quality comes before
convenience.

Everything the user needs is `gh` logged in to an account with write access to
`seesawlabs/seesawgrowth`. No API keys.

## Commands

All scripts live next to this file in `scripts/`. Run them from the repo root.

| Ask | Do |
|---|---|
| "run the research on acme.com" | `scripts/run.sh --domain acme.com --name "Dana Whitfield" --email dana@acme.com [--changed "…"] [--burn "…"] [--tried "…"]` |
| "what's the status" / "is it done" | `scripts/status.sh [run-id]` |
| "review it" / "is the draft safe to send" | `scripts/fetch.sh <run-id>` then `node scripts/review.mjs <downloaded dir>` |
| "revise it: …notes…" | `scripts/revise.sh --domain acme.com --run <pipeline runId> --notes "…"` |

`run.sh` prints the GitHub run id and URL. `status.sh` with no id shows the latest run.
`fetch.sh` downloads the run artifact into `~/one-thing/<domain>/<run-id>/` and prints
the paths of the PDF, the email draft, and the JSON. `review.mjs` reads those and prints
the review checklist with a verdict on whether the draft can be sent as-is.

## Starting a run

1. You need the company's domain and the recipient's name and email. The email is the
   lead's address if this is a real lead; if the run is exploratory, use the teammate's
   own address. Nothing is emailed in `run` mode either way.
2. The three optional answers are what the lead typed on the form, or what the teammate
   knows: what changed recently, where the team burns time, what they have already tried
   or ruled out. Pass whichever you have. They steer the research; they are never cited.
3. Run `scripts/run.sh`. A run takes about ten minutes and about two dollars. The Slack
   channel gets the two documents when it finishes, exactly as a form-submitted lead does.
4. Tell the user the run id and that Slack will also get the result. Do not poll in a
   loop; check when asked, or after a reasonable wait.

## Reviewing a run

This is the part that matters. Run `fetch.sh` then `review.mjs`, then work through what
it prints **in this order**, and say what you find plainly:

1. **The banner.** Every warning the report carries: redactions, † citations in the
   email, no fork found, dead source URLs, thin coverage, a null verdict. Each one is a
   thing the reviewer must look at, not a footnote.
2. **The verdict.** `recommend` or `nothing_worth_a_call`. A null verdict is a real
   answer; check it is the honest read of the register and not the model giving up on
   thin evidence.
3. **The fork.** Do the two branches name different builds? If they differ only in
   timing, the fork failed its own test and the recommendation is under-researched. If
   no fork was found, ask: would the owner name one?
4. **Buyer overlap.** Any peer marked `yes` is a real threat. Any `no` or `partial` must
   not be described as a threat in the email. `unknown` means the evidence did not say.
5. **The email draft.** Every footnote marked † cites a claim that is not Verified. That
   sentence cannot be sent as written: cut it, or say it on the call. Every
   `[figure removed: unsourced]` marker is a number the model reached for and could not
   source; the sentence around it needs a human decision.
6. **Sources.** Any cited page that returned a non-2xx status, or a 202 (usually a bot
   challenge), is a claim to re-check by hand before the call. The report's appendix has
   the thumbnails.

`review.mjs` ends with `SEND-READY: yes` or `SEND-READY: no` and the reasons. **Never
present the draft as ready to send while it says no.** Do not rewrite the draft to route
around a blocker: removing a † sentence is the reviewer's call, and replacing a redacted
figure is forbidden. Offer the revise path instead.

When the draft is clean, hand the reviewer the text from `email-draft.md`, remind them to
add their own sign-off, and stop. Sending is done by a person from their own mail client.

## Revising

If the reviewer wants a different cut (a different pick, a sharper fork, a sentence
moved to the call), run `scripts/revise.sh` with their notes verbatim. It reuses the
research, re-runs the analysis and the verdict, and posts fresh documents to Slack in
about two minutes for a few cents. The `--run` value is the pipeline's run id, the
timestamp-shaped folder name inside the artifact, which `review.mjs` prints.

## Rules that travel with the report

These are enforced in code; the skill's job is to make sure nobody works around them.

- **No invented numbers.** Every numeral in the recommendation and the email traces to a
  cited claim or is redacted. Never type a figure into a draft.
- **Outbound draws on Verified claims only.** Cited and Tool-data claims are call
  material. Ours never leaves unspoken.
- **Absences are marked.** "We could not see" is never rewritten as "they do not have".
- **The fork must fork.** A question counts only if the build differs by answer.
- **No is an answer.** A null verdict ships with the same rigour as a recommendation.

## When something is wrong with the run itself

- `run.sh` fails with 404 or 403: the account lacks write access to the repo, or `gh`
  is logged in to the wrong account. `gh auth status` shows which.
- The run fails in Actions: `status.sh` prints the failed step. Read the job log with
  `gh run view <id> --log-failed`. A missing or wrong secret shows as a 401 from the
  service in question; the fix is in the repo's Actions secrets, not in code.
- No PDF in the artifact: Chrome was missing on the runner. The HTML is there; the Slack
  message says so too.
- Artifacts expire after 14 days. `fetch.sh` keeps a local copy under `~/one-thing/`.
