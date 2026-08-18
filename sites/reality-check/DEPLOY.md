# Deploying to Vercel

The Vercel adapter is installed and `npm run build` already emits Vercel's Build
Output API format (`.vercel/output/`), with `/api/reality-check` mapped to a
serverless function. Nothing else needs configuring.

## Option A — from your machine (fastest)

```bash
cd sites/reality-check
npx vercel            # first run: links/creates the project, deploys a preview
npx vercel --prod     # promote to production
```

First run asks a few questions. Answers:

| Prompt | Answer |
|---|---|
| Set up and deploy? | **yes** |
| Which scope? | your SeeSaw team |
| Link to existing project? | **no** |
| Project name | `reality-check` |
| In which directory is your code? | `./` *(you're already in it)* |
| Override build settings? | **no** — the adapter handles it |

## Option B — from GitHub

Vercel → **Add New → Project** → pick the repo → set **Root Directory** to
`sites/reality-check`. Framework preset auto-detects as Astro. Deploy.

This is the better option once the site has its own repo, because it gives you a
preview URL per pull request.

## Environment variables

Set in Vercel → Project → Settings → Environment Variables. Only the first one
matters for a first look:

| Variable | Needed for | Notes |
|---|---|---|
| `PUBLIC_CAL_LINK` | The scheduler to appear | Until set, the auto-book outcome shows a placeholder where the embed goes |
| `HUBSPOT_TOKEN` | CRM records | Unset → the endpoint logs and skips |
| `RESEND_TOKEN` | Confirmation emails | Unset → logs and skips |
| `SLACK_WEBHOOK` | Manual-review alerts | Unset → logs and skips |
| `ANTHROPIC_API_KEY` | Async scoring of the text box | Optional; never on the critical path |

**The site works with none of them set.** Every integration degrades to a log
line, so you can deploy now and wire them as accounts come online. The one real
consequence: with `HUBSPOT_TOKEN` unset, submissions exist only in the Vercel
function logs — fine for poking around, not fine once you point a channel at it.

## Domain

Vercel → Settings → Domains → add `realitycheck.seesawlabs.com`, then add the
CNAME it gives you at your DNS provider.

### Later: move it to a path on the main domain

A subdomain inherits almost none of seesawlabs.com's authority, and for LLM
citation a path is strictly better. When this is proven, add a rewrite in the
**main site's** `vercel.json` and point the subdomain's DNS at it:

```json
{
  "rewrites": [
    {
      "source": "/ai-reality-check/:path*",
      "destination": "https://realitycheck.seesawlabs.com/:path*"
    }
  ]
}
```

Same codebase, same deploy, main-domain SEO. Also fixes the cross-domain
attribution gap, since visitors never leave the origin.

## Verify after deploying

1. All four routes load: `/`, `/sample`, `/book`, `/privacy`.
2. Fonts render as Outfit, not a system fallback.
3. Fill the qualifier as **CTO / $180M / stalled** → should reach the
   *Let's talk* outcome.
4. Fill it as **CTO / under $10M / stalled** → should reach *Here's what we'd
   suggest instead*. That's the gate firing; if a sub-$10M submission reaches
   the scheduler, the gate is broken.
5. Leave the text box **empty** with an otherwise strong answer set → should
   still auto-book. If it doesn't, the bonus-only scoring has regressed.
6. Check the function log in Vercel for the `[reality-check] submission` line —
   that confirms the endpoint ran rather than the client-side fallback.

Step 6 is the one that matters most on the first deploy: if you only see the
outcome screen and no log line, the endpoint isn't being hit and submissions are
being silently dropped.
