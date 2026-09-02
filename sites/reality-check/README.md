# AI Reality Check — standalone site

Astro site for the free offer: a 45-minute session with the team, and shortly
after it a report of the one big thing we would build, every claim sourced. Built
standalone so it can ship without touching the main site, and lift onto
`seesawlabs.com` later. Operations (env, Slack, the runner) are in `DEPLOY.md`.

Specs live in this repo: `docs/05-reality-check-spec.md` (the offer),
`docs/06-qualifier-spec.md` (the form; its scoring is retired, see §5 there),
`docs/07-interview-guide.md` (the call). `docs/00-status.md` has the re-cut of
2026-08-31 that this page now follows.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
npm run check:prose   # after a build — see below
```

## Editing prose: the spacing trap

Astro trims the whitespace between an inline tag and a following newline, so
this — which looks completely fine — ships without the space:

```astro
reach production about <strong>twice as often</strong>
as internal ones.
```

It renders as "twice as often**as** internal ones". Invisible in the source,
obvious to a visitor. Five instances of it shipped in the first build.

Keep the closing tag off the end of the line. `npm run check:prose` scans the
built HTML for the pattern and exits non-zero if any come back — run it after
`npm run build` whenever you've touched copy. It isn't wired into `build`, so it
can't break a deploy on a false positive.

## Pages

| Route | |
|---|---|
| `/` | The pitch and the form — the call, the report, the people, the four questions, how discovery runs, then the questions, then the calendar |
| `/book-call` | Straight to the calendar (`PUBLIC_CAL_LINK`), for someone arriving from a released report |
| `/sample-brief` | The brief we ran on ourselves. **Old multi-section format; unlinked until regenerated** |
| `/privacy` | Required. **Not lawyer-reviewed yet** |
| `/api/intake` | Accepts the form, alerts Slack, sends the ack, and (with `EXPOSURE_AUTORUN`) starts the research |
| `/api/booking` | Returns the calendar URL so the form can mount it on the confirmation screen |
| `/api/run` | The signed run / revise / send links from the Slack alert |

`/reality-check`, `/book`, `/brief` and `/sample` are redirects. There is no
"not yet" state and no routing by fit any more: every lead sees the calendar,
every lead is researched, and the team decides from the alert.

## Brand

Tokens in `src/styles/tokens.css` are lifted verbatim from the production
seesawlabs.com Panda CSS build, so this reads as the same company when it moves
behind the main domain. Primary is **`#1061DF`**; body font **Outfit**, accent
**Pixelify Sans** — both self-hosted via `@fontsource`, no external requests.

Light-only, matching the parent site. Every colour is painted explicitly.

**Don't invent values here.** If you need a colour that isn't on a scale in
`tokens.css`, take it from the parent site rather than eyeballing one.

### The dot grid

The page texture is the parent site's, lifted the same way: a 1.5px radial dot
on a 40px lattice (`--dot-grid` / `--dot-step`), `neutral-200` dots on a
`neutral-100` surface. That pairing is production's — it's the treatment behind
the main site's menu overlay (`--gradients-grid-dot-light` over
`[data-modal-bg]`).

It carries `--bg-sunk`, so it lands on the alternating sections and on both page
heroes, where the hero's blue wash layers over the top. `/book` deliberately
stays plain white: it's the conversion surface, and the ack and scheduler boxes
inside the form use `--bg-sunk` themselves, so they'd disappear on it.

Worth knowing if it looks off next to the parent site: `neutral-100` is
`#EDEDED`, a neutral grey. It reads warm against the main site's dark navy, but
there is no cream in the brand scales — the amber ramp is the only warm one, and
it isn't used for surfaces.

**Still to drop in:** the primary logo SVG from the brand folder. The header
currently renders a blue square placeholder (`.site-head__mark`).

## Deploy

**Ready to deploy.** The Vercel adapter is installed and `npm run build` emits
Vercel's Build Output API format with `/api/reality-check` mapped to a serverless
function. See [DEPLOY.md](DEPLOY.md) — it's `npx vercel` from this directory.

Every integration degrades to a log line when its token is unset, so the site is
deployable and pokeable before any accounts exist. The one consequence: with
`HUBSPOT_TOKEN` unset, submissions live only in the function logs.

If the endpoint is ever unreachable, the form falls back to client-side routing —
it shows the visitor the correct outcome, since the logic is shared and
deterministic, **but the submission is lost.** DEPLOY.md's verification step 6
is how you confirm the endpoint is actually being hit.

### Subdomain now, path later

Deploy to `realitycheck.seesawlabs.com` to move fast. But a subdomain inherits
almost none of the main domain's authority, and for LLM citation a path is
strictly better. When this is proven, reverse-proxy it onto
`seesawlabs.com/ai-reality-check` with a host rewrite — same codebase, same
deploy, main-domain SEO.

Cross-domain caveat while it's on a subdomain: a visitor who lands on
seesawlabs.com and clicks through will show as `direct` unless cross-domain
tracking is configured. That defeats the attribution work, so set it up or
accept the gap knowingly.

## Environment

Copy `.env.example` to `.env`. Everything except `PUBLIC_CAL_LINK` is optional —
the endpoint logs and skips any integration whose token is unset, so it degrades
gracefully rather than failing.

## Scheduler setup — read this part carefully

One event type: **the 45-minute session** that is the other half of the package.

| Setting | Value | Why |
|---|---|---|
| Scheduling type | **Single host**, who adds the rest of the team to the invite as needed | A collective event only offers times every host is free, which closes most of the window. One host keeps it open; anyone else joins the invite |
| Duration | **45 minutes** | 45 rather than an hour is itself a claim — we know what we are doing with the time. See `docs/10-package-plan.md` |
| Availability | **10:00–15:00 `America/Chicago`, weekdays** | The window is the offer's capacity. Leads take precedence over other meetings inside it |
| Minimum notice | **1 business day** | Load-bearing. The confirmation screen and the ack email both promise the analysis is read before the call. Without notice, someone books forty minutes out and both promises are false |
| Buffer after | 15 min | The debrief plus notes |
| Booking questions | **None** | The intake form already has everything. Adding questions here is the most common way to lose a booking |

### The priority-window gotcha

The window is meant to take precedence over other meetings, which means holding
it on the calendar. **Those holds must be marked `Free`, not `Busy`.** Cal.com
reads a Busy event as a conflict and will offer no slots at all — the window
looks protected and is actually dead. Set the holds to Free and restrict
Cal.com's availability to exactly the window.

Verify after setup: open the public booking link in a private window and confirm
slots appear, that they only appear inside the window, and that nothing is
offered inside the minimum notice period.

## The sample report

`/sample` is the report's **structure**, annotated section by section — not a
filled-in example. That's deliberate: no Reality Check has been delivered yet,
and mocking up a fake company means inventing metrics, which is the one thing
these assessments must never contain.

Replace it with the real thing after the dry run on SeeSaw's own AI operations.
"We ran it on ourselves first" is a stronger artifact than any invented example,
and it doubles as the internal AI-ops case study the audit asked for.

## Before launch

- [ ] `npm run check:prose` clean against the final build
- [ ] Deployed, and the `[reality-check] submission` log line confirms the
      endpoint is being hit rather than the client-side fallback
- [ ] `PUBLIC_CAL_LINK` set; window and minimum notice verified per above
- [ ] Logo SVG replacing the header placeholder
- [ ] OG image (this page gets forwarded into Slacks)
- [ ] Privacy policy read by someone qualified
- [ ] CRM, email, and Slack wired (project 07)
- [ ] The 20-case test matrix in `docs/08-website-build-runbook.md` §9 — cases
      17, 19 and 20 are the ones that get skipped and shouldn't
- [ ] Cross-domain attribution, or a knowing decision to skip it
