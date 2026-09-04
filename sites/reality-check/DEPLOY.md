# Getting the brief flow live

Ordered, because some steps break loudly without an earlier one. Nothing here
needs the pipeline to run on Vercel — the brief is generated on an operator's
machine and released, which is the human gate that stops a thin brief reaching
a good prospect.

## 0. What is already true

`seesawgrowth.vercel.app` builds from **`claude/seesaw-labs-growth-u5ou0b`**
with Root Directory `sites/reality-check`. It is serving a commit from before
the brief work: `/`, `/sample` and `/book` exist; `/brief` and `/reality-check`
404.

## 1. Get the code onto the deployed branch

Everything for the brief flow is on `claude/exposure-report-stages-03-04-qcyvrr`.
Until it lands on the branch Vercel builds, none of the rest of this matters.

After it deploys, these should all answer:

| Route | Expect |
|---|---|
| `/` | the package — analysis plus session — with the intake form |
| `/sample-brief` | the analysis we ran on ourselves |
| `/book-call` | 302 to the calendar |
| `/brief` | 301 to `/` |
| `/sample` | 301 to `/sample-brief` |
| `/book` | 302 to `/#request` |
| `/reality-check` | 302 to `/#session` |

The last four are retired routes kept as redirects. There is one offer and one
page now — see `docs/10-package-plan.md`. `POST /api/intake` is the only
endpoint; `/api/exposure-request` and `/api/reality-check` are gone.

## 2. Environment variables

Vercel → Settings → Environment Variables. Set for Production **and** Preview,
otherwise a preview deploy silently behaves differently from production.

| Variable | Without it | Notes |
|---|---|---|
| `SLACK_WEBHOOK` | **A submitted request reaches nobody.** It is logged to the Vercel function log and that is all | Effectively required. The alert carries the exact command to fulfil the request |
| `EXPOSURE_LINK_SECRET` | **Every magic link fails to verify.** The route logs it loudly | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. The operator machine needs the *same* value |
| `EXPOSURE_REPORT_BASE_URL` | A verified link 404s: the site has nowhere to read briefs from | Public prefix of the blob store, e.g. `https://….public.blob.vercel-storage.com/briefs` |
| `GITHUB_DISPATCH_TOKEN` | No auto-run and no one-click runs; the alert prints commands instead | See §3a |
| `EXPOSURE_AUTORUN` | Research waits for a click on the *Run* link in the alert | Set to `true` to start the research the moment a lead lands. Needs `GITHUB_DISPATCH_TOKEN`. See §3a |
| `PUBLIC_SITE_ORIGIN` | The alert cannot build absolute links | `https://seesawgrowth.vercel.app` |
| `PUBLIC_CAL_LINK` | The calendar is hidden on the confirmation screen and `/api/booking` returns null; `/book-call` falls back to `/book` | See §3 |
| `RESEND_TOKEN` | Neither email sends. Both no-op loudly in the log | Sender domain must be verified in Resend first |
| `PUBLIC_PLAUSIBLE_DOMAIN` | No analytics | Optional |
| `EXPOSURE_DELIVERY` | Stays `reviewed`, which is what we want | Only set to `instant` when the review gate retires |
| `HUBSPOT_TOKEN` | No CRM push | The CRM function is still a stub — leave unset |

### These are read at runtime, and that took a fix to be true

The first version of this file claimed it. It was wrong, and the failure was
silent: Vite statically replaces `import.meta.env.ANYTHING` while bundling, so
`import.meta.env.SLACK_WEBHOOK` compiled to the literal `undefined` and the
`fetch` beneath its guard was eliminated from the deployed bundle. Setting the
webhook in the dashboard changed nothing, and the function logged "SLACK_WEBHOOK
unset" while insisting it was doing its job.

Server values now go through `serverEnv()` in `src/lib/server-env.ts`, which
reads `process.env` first. Adding or rotating one takes effect on the next
request, no redeploy.

The exception is any `PUBLIC_`-prefixed value used in client-side code: those are
meant to be inlined and do need a rebuild. `PUBLIC_CAL_LINK` is currently read
server-side only, so it does not.

### Checking it worked

`GET /api/health` reports which integrations the environment actually serving
that request can see — booleans only, never values:

```
curl -s https://seesawgrowth.vercel.app/api/health
```

`blocking` lists the ones that break the flow rather than degrade it: without
Slack a request reaches nobody, and without the link secret every magic link
fails. Check this before hunting anywhere else.

## 3. The calendar

The session is **45 minutes**, not the hour the old Reality Check ran. It is a
**single-host** event with the rest of the team added to the invite when more
than one of us should be on the call — a collective event only offers times
every host is free, which would close most of the window. Currently
`https://cal.com/calvin-locklear-vhu26c/welcome-to-seesaw-labs`.

1. Open the URL in a private window. If it does not load for a stranger, it
   will not load for a lead.
2. Put it in `PUBLIC_CAL_LINK`. Both flows read that one value — the
   confirmation screen and `/book-call`, which is what briefs link to.
3. Set **availability to 10:00–15:00 `America/Chicago`, weekdays**, and a
   **minimum notice of one business day**. The notice is not optional: the
   confirmation screen and the acknowledgement email both say the analysis
   will be read before the call, and without a notice period someone can book
   a slot forty minutes out and make both of them false.

Briefs point at `/book-call` on our own origin rather than at the calendar
directly, so changing tools later is one variable and every brief already in
someone's inbox follows it. Nothing needs reissuing.

The form mounts that calendar (Cal.com embed, not a bare iframe) on the
confirmation screen, after the questions. Every lead sees it. Scoring is retired from this
flow (`docs/00-status.md`, 2026-08-31): nothing gates the calendar and the alert
gives no instruction beyond the facts, so the team decides from the alert and the
research. Someone arriving from a released report goes straight to the calendar
through `/book-call`.

## 3a. One-click runs from Slack

With `EXPOSURE_AUTORUN=true`, the research starts the moment a lead lands: the
intake route dispatches the workflow itself and the alert says so. About ten
minutes later the workflow posts the two documents to the same channel: the
**report PDF** (the research, every claim numbered and sourced) and the **email
draft** (the one big thing, footnoted to the report). A person reads both,
edits the draft, and sends it by hand. Nothing goes to the lead automatically.

Without `EXPOSURE_AUTORUN`, the alert carries a signed **Run the research**
link instead, and the same two documents post when someone clicks it. The
older **revise it** and **send it** links still work for the legacy brief
format. Either way, no laptop with six API keys on it.

**From a teammate's machine.** The `/one-thing` skill in `.claude/skills/one-thing/`
starts the same workflow through `gh`, downloads the finished run, and walks the
reviewer through the send gate. It needs only a GitHub login with write access to
this repo. See that folder's `SKILL.md`.

`.github/workflows/analysis.yml` is the runner. To turn it on:

**A GitHub token, in Vercel.** Fine-grained, this repository only, Repository
permissions → **Actions: Read and write**. Nothing else. Set it as
`GITHUB_DISPATCH_TOKEN`. Also set `PUBLIC_SITE_ORIGIN` to
`https://seesawgrowth.vercel.app`, or the alert cannot build absolute links and
falls back to printing commands.

**The pipeline keys, as Actions secrets** (Settings → Secrets and variables →
Actions): `FIRECRAWL_API_KEY`, `EXA_API_KEY`, `PERPLEXITY_API_KEY`,
`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `EXPOSURE_ANTHROPIC_KEY`,
`EXPOSURE_LINK_SECRET` (identical to the one in Vercel), `RESEND_TOKEN`,
`SLACK_WEBHOOK`, `BLOB_READ_WRITE_TOKEN`.

**And as Actions *variables*** (not secrets, since they are not secret):
`EXPOSURE_REPORT_BASE_URL`, `PUBLIC_SITE_ORIGIN`, `PUBLIC_CAL_LINK`, and
optionally `EXPOSURE_RUN_BUDGET_USD`.

The workflow only needs to exist on the branch it is dispatched against, which
defaults to `claude/seesaw-labs-growth-u5ou0b` — the repository's default
branch, and the one Vercel builds. Override with `GITHUB_DISPATCH_REF`.

Three things worth knowing about the design:

- **A GET never acts.** Slack fetches links to build previews, as do mail
  clients and phone prefetchers, so the link renders a confirmation page and the
  run needs a POST from it. The alert also asks Slack not to unfurl. One extra
  click is the price of a URL that cannot be spent by a bot.
- **The links are signed** with `EXPOSURE_LINK_SECRET`, and the action is inside
  the signature, so a "run" link cannot be edited into a "send" link. They are
  signed, not encrypted: the lead's name and email can be decoded out of one, so
  they belong in our Slack and nowhere else.
- **Runs are serialised per company** by a concurrency group, so a
  double-clicked link queues rather than spending twice.
- **A revise costs cents, not dollars.** It rereads stages 01-05 off a bundle
  the prior release uploaded next to the client's html (workflows start from a
  fresh checkout every time, so nothing on disk survives between clicks) and
  pays only for the writing stage — no Firecrawl, Exa, Perplexity or
  DataForSEO credential is even given to that step. Notes are typed on the
  confirmation page, not carried in the link: they are decided after reading
  the document, which is after the link was minted.

## 4. Where released briefs live

A brief is a document on the operator's machine until it is uploaded. The site
reads it from `EXPOSURE_REPORT_BASE_URL`.

The stored filename is **not** the report id. It is an HMAC of the id under
`EXPOSURE_LINK_SECRET`, because an object store serves over plain HTTPS with no
auth: a filename containing the client's domain is a brief anyone can guess at,
and a listable bucket exposes every one at once. The token stays the gate.

Practically, per request — both lines come out of the Slack alert verbatim:

```
cd sites/reality-check
npm run fulfil -- --domain acme.com --email dana@acme.com \
  --name "Dana Whitfield" --company "Acme" --category "…" --peer other.com

# nine minutes later it prints the path to the rendered brief. Read it. Then:
npm run fulfil -- --domain acme.com --release --send
```

The second line needs only the domain because the first one records the intake
into the run directory. Nothing is retyped, which matters: retyping a
recipient's address to release their analysis is how it reaches a stranger.

The first pass never uploads or emails anything. `--release` is a separate
decision made after reading, and it verifies the minted link serves a brief
before reporting success. `--send` is separate again, so a dry run cannot mail
a client. Release refuses a brief below the coverage threshold unless you pass
`--force` having read it — a thin brief to a good prospect is worse than none.

For a run generated by hand, with no recorded intake, `npm run release` still
takes the recipient explicitly.

## 5. Before the first real lead

- `curl /api/health` and confirm `blocking` is empty.
- Submit the form on production and confirm the Slack alert arrives. If it does
  not, the function log now distinguishes "skipped" (not configured) from
  "REJECTED 404: no_team" (configured, but Slack refused it).
- Release the brief for a domain you own and click the link from a phone, not
  just the machine that made it.
- Check the ack email in a client that strips styling — both emails ship a
  plain-text half for exactly that.
- `npm run check:prose && npm run check:email && npm run check:intake && npm run check:links`
- Submit the form once on production and book from the confirmation screen.
  With `EXPOSURE_AUTORUN` on, the alert should be followed about ten minutes
  later by the report PDF and the email draft in the same channel.

## Operator machine

Separate from Vercel. `tools/exposure/.env` needs the five research keys
(`FIRECRAWL_API_KEY`, `EXA_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`,
`DATAFORSEO_PASSWORD`, `ANTHROPIC_API_KEY`) plus `EXPOSURE_RUN_BUDGET_USD`.
`sites/reality-check/.env` needs `EXPOSURE_LINK_SECRET` (same value as Vercel),
`PUBLIC_SITE_ORIGIN`, `EXPOSURE_REPORT_BASE_URL`, `RESEND_TOKEN` and
`PUBLIC_CAL_LINK`.

A run currently costs about $1.90 and takes nine minutes, most of it in
synthesis. That is fine for a reviewed flow and would not be fine unattended.
