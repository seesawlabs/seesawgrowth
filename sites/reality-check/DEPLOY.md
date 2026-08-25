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
| `/` | the Opportunity Brief offer, with the intake form |
| `/brief` | 301 to `/` |
| `/reality-check` | the hour |
| `/sample-brief` | the brief we ran on ourselves |
| `/book-call` | 302 to the calendar |

## 2. Environment variables

Vercel → Settings → Environment Variables. Set for Production **and** Preview,
otherwise a preview deploy silently behaves differently from production.

| Variable | Without it | Notes |
|---|---|---|
| `SLACK_WEBHOOK` | **A submitted request reaches nobody.** It is logged to the Vercel function log and that is all | Effectively required. The alert carries the exact command to fulfil the request |
| `EXPOSURE_LINK_SECRET` | **Every magic link fails to verify.** The route logs it loudly | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. The operator machine needs the *same* value |
| `EXPOSURE_REPORT_BASE_URL` | A verified link 404s: the site has nowhere to read briefs from | Public prefix of the bucket or blob store, e.g. `https://….public.blob.vercel-storage.com/briefs` |
| `PUBLIC_CAL_LINK` | The booking block is hidden on the confirmation, and `/book-call` falls back to `/book` | See §3 |
| `RESEND_TOKEN` | Neither email sends. Both no-op loudly in the log | Sender domain must be verified in Resend first |
| `PUBLIC_PLAUSIBLE_DOMAIN` | No analytics | Optional |
| `EXPOSURE_DELIVERY` | Stays `reviewed`, which is what we want | Only set to `instant` when the review gate retires |
| `HUBSPOT_TOKEN` | No CRM push | The CRM function is still a stub — leave unset |

Nothing above is read at build time, so a change needs a redeploy only to take
effect on already-built pages; the API routes and `/r/<token>` pick it up on the
next request.

## 3. The calendar

`.env.example` has always named the intended event:
`https://cal.com/seesawlabs/reality-check`, a **collective** event on Jeff and
Calvin. Two things to do:

1. Create it (or confirm it exists) and open the URL in a private window. If it
   does not load for a stranger, it will not load for a lead.
2. Put it in `PUBLIC_CAL_LINK`. Both flows read that one value — the
   confirmation screen and `/book-call`, which is what briefs link to.

Briefs point at `/book-call` on our own origin rather than at the calendar
directly, so changing tools later is one variable and every brief already in
someone's inbox follows it. Nothing needs reissuing.

The qualifier at `/book` embeds the same link as an iframe after its questions.
Someone arriving from a brief skips that and goes straight to the calendar —
they have already told us who they are.

## 4. Where released briefs live

A brief is a document on the operator's machine until it is uploaded. The site
reads it from `EXPOSURE_REPORT_BASE_URL`.

The stored filename is **not** the report id. It is an HMAC of the id under
`EXPOSURE_LINK_SECRET`, because an object store serves over plain HTTPS with no
auth: a filename containing the client's domain is a brief anyone can guess at,
and a listable bucket exposes every one at once. The token stays the gate.

Practically, per release:

```
cd tools/exposure && npm run report -- <domain> …      # the Slack alert has this line verbatim
cd sites/reality-check
npm run release -- --domain <domain> --email <them> --name "<Name>" --company "<Co>"
# it prints the upload command for the configured store, then:
npm run release -- --domain <domain> --email <them> --verify --send
```

`--verify` fetches the minted link and requires a brief at the other end before
reporting success. `--send` is separate so a dry run cannot mail a client.
Release refuses a brief below the coverage threshold unless you pass `--force`
having read it — a thin brief to a good prospect is worse than none.

## 5. Before the first real lead

- Submit the form on production and confirm the Slack alert arrives.
- Release the brief for a domain you own and click the link from a phone, not
  just the machine that made it.
- Check the ack email in a client that strips styling — both emails ship a
  plain-text half for exactly that.
- `npm run check:prose && npm run check:email && npm run check:intake && npm run check:links`

## Operator machine

Separate from Vercel. `tools/exposure/.env` needs the five research keys
(`FIRECRAWL_API_KEY`, `EXA_API_KEY`, `PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`,
`DATAFORSEO_PASSWORD`, `ANTHROPIC_API_KEY`) plus `EXPOSURE_RUN_BUDGET_USD`.
`sites/reality-check/.env` needs `EXPOSURE_LINK_SECRET` (same value as Vercel),
`PUBLIC_SITE_ORIGIN`, `EXPOSURE_REPORT_BASE_URL`, `RESEND_TOKEN` and
`PUBLIC_CAL_LINK`.

A run currently costs about $1.90 and takes nine minutes, most of it in
synthesis. That is fine for a reviewed flow and would not be fine unattended.
