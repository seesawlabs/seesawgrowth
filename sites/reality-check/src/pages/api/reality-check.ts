/* ---------------------------------------------------------------------------
   POST /api/reality-check

   Scores, gates, routes, responds — then fans out to CRM, email, and Slack
   without blocking the response.

   REQUIRES A SERVER ADAPTER. With `output: 'static'` in astro.config.mjs this
   file is not built, the client fetch 404s, and the form falls back to
   client-side routing (see Qualifier.astro). That fallback shows the visitor
   the right outcome but LOSES THE SUBMISSION — so adding the adapter is the
   first thing to do once a host is chosen:

     npx astro add vercel     # or netlify
     # then set output: 'server' (or 'hybrid') and keep this export:

   Spec: docs/06-qualifier-spec.md §5 in the seesawgrowth repo.
--------------------------------------------------------------------------- */

import type { APIRoute } from 'astro';
import { evaluate, type Answers, type Route } from '../../lib/qualifier';

export const prerender = false;

interface Payload extends Answers {
  attribution?: Record<string, string>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/* Naive in-memory guard against double-submits from a double-click. Serverless
   instances are short-lived so this is best-effort; the real idempotency key
   should be enforced on the CRM side by email + day. */
const recent = new Map<string, number>();
const DEDUPE_MS = 20_000;

function isDuplicate(email: string): boolean {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  if (recent.has(email)) return true;
  recent.set(email, now);
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  let p: Payload;
  try {
    p = (await request.json()) as Payload;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const email = (p.email ?? '').trim().toLowerCase();
  if (!p.name?.trim() || !email || !p.company?.trim() || !p.website?.trim() || !p.industry) {
    return json({ error: 'missing_fields' }, 422);
  }
  if (!p.role || !p.revenue || !p.stage) {
    return json({ error: 'missing_answers' }, 422);
  }

  /* Log the raw submission BEFORE scoring, so a scoring bug is recoverable. */
  console.log('[reality-check] submission', JSON.stringify({ ...p, email }));

  if (isDuplicate(email)) {
    // Same answer, same person, seconds apart — treat as the same submission.
    const v = evaluate(p);
    return json({ route: v.route, bookingUrl: bookingUrlFor(v.route), duplicate: true });
  }

  /* Deterministic score only. The prior-attempt text is scored by a model
     asynchronously below — it is NOT on the critical path, because the
     deterministic signals reach 7 and auto-book triggers at 6. A model timeout
     can therefore never delay or misroute a booking. */
  const verdict = evaluate(p);
  const route = verdict.route ?? 'manual_review';

  const record = {
    contact: {
      name: p.name.trim(),
      email,
      company: p.company.trim(),
      website: normaliseUrl(p.website),
      title: p.roleTitle?.trim() || null,
      role_bucket: p.role,
    },
    firm: {
      revenue_band: p.revenue,
      industry: p.industry,
      email_domain: email.split('@')[1] ?? '',
      website_source: p.websiteSource ?? 'blank',
    },
    qualification: {
      stage: p.stage,
      tried_raw_text: p.tried?.trim() || null,
      tried_score: verdict.points.tried,
      budget_ack: Boolean(p.budgetAck),
      total_score: verdict.total,
      route,
      gate_applied: verdict.gate,
      icp_override: verdict.icpOverride,
    },
    attribution: {
      ...(p.attribution ?? {}),
      referred_by: p.referredBy?.trim() || null,
    },
    submitted_at: new Date().toISOString(),
  };

  /* Fan out without blocking. A downstream outage must never stop the visitor
     from seeing the scheduler — the submission is already logged above. */
  void Promise.allSettled([
    pushToCrm(record),
    sendConfirmation(route, record),
    route === 'manual_review' ? alertSlack(record) : Promise.resolve(),
    scoreTriedWithModel(record),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[reality-check] fanout ${i} failed`, r.reason);
      }
    });
  });

  return json({ route, bookingUrl: bookingUrlFor(route) });
};

/* -- helpers ----------------------------------------------------------- */

function normaliseUrl(raw: string): string {
  const t = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return t ? `https://${t}` : '';
}

function bookingUrlFor(route: Route | null): string | undefined {
  if (route !== 'auto_book') return undefined;
  const link = import.meta.env.PUBLIC_CAL_LINK;
  return link ? `${link}?hide_event_type_details=1` : undefined;
}

/* -- integrations: wire these once accounts exist (project 07) ---------- */

async function pushToCrm(record: unknown): Promise<void> {
  const key = import.meta.env.HUBSPOT_TOKEN;
  if (!key) {
    console.log('[reality-check] CRM skipped — HUBSPOT_TOKEN unset');
    return;
  }
  // TODO: create/update contact + deal. Property map in docs/06 §8.
  console.log('[reality-check] CRM push pending implementation', record);
}

async function sendConfirmation(route: Route, record: unknown): Promise<void> {
  const key = import.meta.env.RESEND_TOKEN;
  if (!key) {
    console.log(`[reality-check] email skipped (${route}) — RESEND_TOKEN unset`);
    return;
  }
  // TODO: three templates — booked / under review / not yet. docs/06 §7.
  // The booked template MUST restate recording consent and the
  // bring-one-person ask.
  console.log('[reality-check] email pending implementation', route, record);
}

async function alertSlack(record: unknown): Promise<void> {
  const hook = import.meta.env.SLACK_WEBHOOK;
  if (!hook) {
    console.log('[reality-check] Slack skipped — SLACK_WEBHOOK unset');
    return;
  }
  // Must include the raw prior-attempt text so the reviewer reads their words,
  // not just a score. One business day SLA starts now.
  await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `New Reality Check needs review within 1 business day:\n\`\`\`${JSON.stringify(record, null, 2)}\`\`\``,
    }),
  });
}

async function scoreTriedWithModel(record: unknown): Promise<void> {
  const key = import.meta.env.ANTHROPIC_API_KEY;
  if (!key) return;
  /* Async enrichment only — never gates the response.
     The rubric must state explicitly that LENGTH IS NOT A CRITERION:
     "Pilot stalled at integration" is four words and fully specific. */
  console.log('[reality-check] model scoring pending implementation', record);
}
