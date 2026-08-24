/* ---------------------------------------------------------------------------
   POST /api/exposure-request

   Someone asks for an Exposure Report on their own company. This endpoint
   records the request, tells a human, and answers honestly about timing. It
   does NOT generate the report.

   WHY NOT GENERATE IT HERE. The pipeline crawls a site, calls four paid APIs,
   takes two to three minutes and costs about $0.12 a run. None of that belongs
   in a request handler: the visitor would stare at a spinner past most
   serverless timeouts, a retry would double-charge, and an unattended crawler
   fired by an unvalidated form is a way to get our IP blocked by a company we
   want to sell to.

   The stronger reason is the review gate. tools/exposure/README.md commits to a
   human read before every send, dropped only after twenty consecutive reports
   with zero fabricated figures. We are on run one. So a request lands in Slack,
   an operator runs the pipeline and reads the output, and only then releases a
   link. Automating this end to end is a deliberate later change — see
   `scripts/release-report.mjs` for the step a human currently performs.

   Mirrors the shape of ./reality-check.ts on purpose: same JSON helper, same
   log-before-anything-else rule, same env-guarded integrations that no-op
   loudly rather than failing a submission.
--------------------------------------------------------------------------- */

import type { APIRoute } from 'astro';

export const prerender = false;

interface Payload {
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  /** Free text: what's driving this right now. Feeds the report's opening. */
  trigger?: string;
  /** Whether they also want a call, chosen on the same form. */
  wantsCall?: boolean;
  attribution?: Record<string, string>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/* Same best-effort double-click guard as the qualifier: serverless instances
   are short-lived, so real idempotency has to live in the CRM. */
const recent = new Map<string, number>();
const DEDUPE_MS = 20_000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Bare registrable-looking host, or nothing. Rejects paths and junk early. */
export function normaliseSite(raw: string): string | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '');
  if (!t || t.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(t)) return null;
  if (!/\.[a-z]{2,}$/.test(t)) return null;
  return t;
}

/**
 * Free-mail domains. Not a rejection — a plumber with a Gmail address is still
 * a person — but the report is about a *company*, so a free-mail request
 * whose website we cannot corroborate goes to a human rather than the queue.
 */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
  'yandex.com', 'zoho.com', 'msn.com', 'comcast.net', 'verizon.net', 'sbcglobal.net',
]);

export function needsHumanFirst(email: string, site: string): boolean {
  const domain = email.split('@')[1] ?? '';
  if (!FREE_MAIL.has(domain)) return false;
  // A free-mail address that at least matches the site's brand is plausible.
  const brand = site.split('.')[0] ?? '';
  return !(brand.length >= 4 && email.split('@')[0].includes(brand));
}

export const POST: APIRoute = async ({ request }) => {
  let p: Payload;
  try {
    p = (await request.json()) as Payload;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const email = (p.email ?? '').trim().toLowerCase();
  const site = normaliseSite(p.website ?? '');

  if (!p.name?.trim() || !email || !p.company?.trim()) {
    return json({ error: 'missing_fields' }, 422);
  }
  if (!EMAIL.test(email)) return json({ error: 'bad_email' }, 422);
  if (!site) return json({ error: 'bad_website' }, 422);

  /* Log the raw request before any judgement, so a bug in the routing below
     never loses a lead. */
  console.log('[exposure-request] submission', JSON.stringify({ ...p, email, site }));

  const record = {
    contact: {
      name: p.name.trim(),
      email,
      company: p.company.trim(),
      website: `https://${site}`,
      domain: site,
    },
    intake: {
      trigger: p.trigger?.trim() || null,
      wants_call: Boolean(p.wantsCall),
      email_domain: email.split('@')[1] ?? '',
      free_mail_mismatch: needsHumanFirst(email, site),
    },
    attribution: p.attribution ?? {},
    requested_at: new Date().toISOString(),
  };

  const duplicate = isDuplicate(`${email}|${site}`);

  if (!duplicate) {
    /* Fan out without blocking. A Slack outage must never stop the visitor
       seeing their confirmation — the request is already logged above. */
    void Promise.allSettled([
      alertOperator(record),
      pushToCrm(record),
      acknowledge(record),
    ]).then((rs) =>
      rs.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`[exposure-request] fanout ${i} failed`, r.reason);
      })
    );
  }

  return json({
    ok: true,
    duplicate,
    /* Honest, and deliberately not a promise of minutes. The gate is a person. */
    eta: 'one business day',
    bookingUrl: p.wantsCall ? bookingUrl() : undefined,
  });
};

/* -- integrations: env-guarded, no-op loudly ---------------------------- */

function bookingUrl(): string | undefined {
  const link = import.meta.env.PUBLIC_CAL_LINK;
  return link ? `${link}?hide_event_type_details=1` : undefined;
}

/**
 * The human gate. This message IS the queue until there is a real one, so it
 * carries the exact command an operator runs — a Slack alert that needs you to
 * go and look something up is an alert that gets ignored.
 */
async function alertOperator(record: {
  contact: { name: string; email: string; company: string; domain: string };
  intake: { trigger: string | null; wants_call: boolean; free_mail_mismatch: boolean };
}): Promise<void> {
  const hook = import.meta.env.SLACK_WEBHOOK;
  const { contact, intake } = record;
  const lines = [
    `*Exposure Report requested* — ${contact.company} (${contact.domain})`,
    `${contact.name} · ${contact.email}${intake.wants_call ? ' · also asked for a call' : ''}`,
    intake.trigger ? `> ${intake.trigger}` : null,
    intake.free_mail_mismatch
      ? ':warning: free-mail address that does not match the site — confirm the company before crawling'
      : null,
    '',
    'To fulfil:',
    '```',
    `cd tools/exposure && npm run report -- ${contact.domain}`,
    '# read it. then, from sites/reality-check:',
    `node scripts/release-report.mjs --domain ${contact.domain} --email ${contact.email}`,
    '```',
    'Reports below the coverage threshold route to a call instead of a send.',
  ].filter(Boolean);

  if (!hook) {
    console.log('[exposure-request] Slack skipped — SLACK_WEBHOOK unset\n' + lines.join('\n'));
    return;
  }
  await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') }),
  });
}

async function pushToCrm(record: unknown): Promise<void> {
  if (!import.meta.env.HUBSPOT_TOKEN) {
    console.log('[exposure-request] CRM skipped — HUBSPOT_TOKEN unset');
    return;
  }
  // TODO: same contact object as the qualifier, lifecycle = exposure_requested.
  console.log('[exposure-request] CRM push pending implementation', record);
}

async function acknowledge(record: unknown): Promise<void> {
  if (!import.meta.env.RESEND_TOKEN) {
    console.log('[exposure-request] ack email skipped — RESEND_TOKEN unset');
    return;
  }
  // TODO: one template. Must say a person reads it before it is sent, and must
  // not promise a turnaround the review gate cannot keep.
  console.log('[exposure-request] ack email pending implementation', record);
}
