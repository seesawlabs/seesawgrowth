# AI Reality Check — standalone site

Astro site for the free AI Reality Check offer. Built standalone so it can ship
without touching the main site, and lift onto `seesawlabs.com` later.

Specs live in this repo: `docs/05-reality-check-spec.md` (the offer),
`docs/06-qualifier-spec.md` (the form), `docs/07-interview-guide.md` (the call).

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
| `/` | The pitch — hero, problem, what you get, the hour, fit, FAQ, close |
| `/sample` | Report walkthrough. **Structure, not a filled example** — see below |
| `/book` | The qualifier and the three outcome states |
| `/privacy` | Required. **Not lawyer-reviewed yet** |

`/office-hours` is deliberately absent — deferred. Sub-threshold leads route to
a "not yet" state inside `/book` that gives them the report walkthrough and
captures interest in the future group session, rather than promising a session
that doesn't exist.

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

One event type: **AI Reality Check, 60 minutes.**

| Setting | Value | Why |
|---|---|---|
| Scheduling type | **Collective** — Jeff **and** Calvin, both required | Round-robin would book one person alone and silently kill the live workflow sketch, which is the differentiator |
| Availability | **Only the daily priority windows** | Not "working hours". The window is the offer's capacity |
| Buffer after | 15 min | The five-minute debrief plus notes |
| Minimum notice | **2 business days** | The research brief needs 24h. Without this someone books 9am tomorrow and you walk in cold |
| Max per week | **3** | Enforces the 8/month cap in the calendar rather than by willpower |
| Booking questions | **None** | The qualifier already has everything. Adding questions here is the most common way to lose a booking |
| Description | The bring-one-person ask **and** the recording consent line | Consent appears here, in the confirmation email, and verbally on the call |

### The priority-window gotcha

The windows are meant to take precedence over other meetings, which means
holding them on both calendars. **Those holds must be marked `Free`, not
`Busy`.** Cal.com reads a Busy event as a conflict and will offer no slots at
all — the window looks protected and is actually dead. Set the holds to Free and
restrict Cal.com's availability to exactly those windows.

Verify after setup: open the public booking link in a private window and confirm
slots appear, that they only appear inside the windows, and that nothing is
offered inside the next two business days.

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
- [ ] `PUBLIC_CAL_LINK` set; collective scheduling verified per above
- [ ] Logo SVG replacing the header placeholder
- [ ] OG image (this page gets forwarded into Slacks)
- [ ] Privacy policy read by someone qualified
- [ ] CRM, email, and Slack wired (project 07)
- [ ] The 20-case test matrix in `docs/08-website-build-runbook.md` §9 — cases
      17, 19 and 20 are the ones that get skipped and shouldn't
- [ ] Cross-domain attribution, or a knowing decision to skip it
