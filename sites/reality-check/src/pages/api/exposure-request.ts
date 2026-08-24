/* ---------------------------------------------------------------------------
   POST /api/exposure-request

   Someone asks for an Exposure Report on their own company. This endpoint
   validates the intake, records it, tells a human, and answers honestly about
   timing. It does not generate the report.

   WHY NOT GENERATE IT HERE. A measured run is about two minutes and calls five
   paid APIs. None of that belongs in a request handler: the visitor would wait
   past most serverless timeouts, a retry would double-charge, and an unattended
   crawler fired by an unvalidated form is a way to get our IP blocked by a
   company we want to sell to.

   The stronger reason is the review gate. tools/exposure/README.md commits to a
   human read before every send, dropped only after twenty consecutive reports
   with zero fabricated figures. We are early in that count, and the last two
   defects we found were exactly the kind a person catches and a pipeline does
   not — a job advert quoted as a process, a disclaimer counted as evidence. So
   a request lands in Slack with the exact command to fulfil it, an operator runs
   it and reads the output, and only then is a link released.

   Mirrors the shape of ./reality-check.ts on purpose: same JSON helper, same
   log-before-anything-else rule, same env-guarded integrations that no-op
   loudly rather than failing a submission.

   Validation lives in ../../lib/exposure-intake and is shared with the form, so
   the message a visitor sees and the rule we enforce cannot drift.
--------------------------------------------------------------------------- */

import type { APIRoute } from 'astro';

import { validate, normalise, fulfilCommand, type Intake } from '../../lib/exposure-intake';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/* Best-effort double-click guard, as in the qualifier: serverless instances are
   short-lived, so real idempotency has to live in the CRM. */
const recent = new Map<string, number>();
const DEDUPE_MS = 20_000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

/**
 * Free-mail domains. Not a rejection — a founder with a Gmail address is still
 * a founder — but the report is about a *company*, so a free-mail request whose
 * website we cannot corroborate is flagged for a human before we crawl anything.
 */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
  'yandex.com', 'zoho.com', 'msn.com', 'comcast.net', 'verizon.net', 'sbcglobal.net',
]);

export function needsHumanFirst(email: string, site: string): boolean {
  const domain = email.split('@')[1] ?? '';
  if (!FREE_MAIL.has(domain)) return false;
  const brand = site.split('.')[0] ?? '';
  return !(brand.length >= 4 && email.split('@')[0].includes(brand));
}

/**
 * How a report gets produced, and therefore what the confirmation promises.
 *
 * `reviewed` is the default and the honest one today — a person runs the
 * pipeline and reads the output before a link is released. `instant` is the same
 * flow with the human step removed, and it is a deliberate switch rather than a
 * drift: set EXPOSURE_DELIVERY=instant once the review gate is retired.
 *
 * A run is about two minutes end to end, so `instant` promises minutes and
 * `reviewed` promises a business day. Only the confirmation copy changes.
 */
export type DeliveryMode = 'instant' | 'reviewed';

export function deliveryMode(): DeliveryMode {
  return import.meta.env.EXPOSURE_DELIVERY === 'instant' ? 'instant' : 'reviewed';
}

export const POST: APIRoute = async ({ request }) => {
  let raw: Partial<Intake>;
  try {
    raw = (await request.json()) as Partial<Intake>;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const errors = validate(raw);
  if (errors.length > 0) {
    console.log('[exposure-request] rejected', JSON.stringify({ errors, email: raw.email }));
    return json({ error: 'invalid', errors }, 422);
  }

  const intake = normalise(raw as Intake);

  /* Log before any judgement, so a bug in the routing below never loses a lead. */
  console.log('[exposure-request] submission', JSON.stringify(intake));

  const record = {
    contact: {
      name: intake.name,
      email: intake.email,
      company: intake.company,
      website: intake.website,
      domain: intake.domain,
    },
    intake: {
      one_liner: intake.oneLiner,
      competitors: intake.competitors,
      competitor_domains: intake.competitorDomains,
      trigger: intake.trigger ?? null,
      wants_call: Boolean(intake.wantsCall),
      email_domain: intake.email.split('@')[1] ?? '',
      free_mail_mismatch: needsHumanFirst(intake.email, intake.domain),
    },
    attribution: intake.attribution ?? {},
    requested_at: new Date().toISOString(),
  };

  const duplicate = isDuplicate(`${intake.email}|${intake.domain}`);
  const mode = deliveryMode();

  if (!duplicate) {
    /* Fan out without blocking. A Slack outage must never stop the visitor
       seeing their confirmation — the request is already logged above. */
    void Promise.allSettled([
      alertOperator(record, intake),
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
    mode,
    eta: mode === 'instant' ? 'two minutes' : 'one business day',
    /* Returned to everyone, not only those who ticked the box: a run is long
       enough that the wait may as well be spent booking the hour that fixes
       the report. */
    bookingUrl: bookingUrl(),
  });
};

/* -- integrations: env-guarded, no-op loudly ---------------------------- */

function bookingUrl(): string | undefined {
  const link = import.meta.env.PUBLIC_CAL_LINK;
  return link ? `${link}?hide_event_type_details=1` : undefined;
}

/**
 * The human gate. This message IS the queue until there is a real one, so it
 * carries the exact command to fulfil the request — built by `fulfilCommand`
 * from the same intake spec the form collects, so a field we ask for and a
 * field the pipeline receives cannot diverge. An alert that needs you to go and
 * look something up is an alert that gets ignored.
 */
async function alertOperator(
  record: {
    contact: { name: string; email: string; company: string; domain: string };
    intake: { trigger: string | null; wants_call: boolean; free_mail_mismatch: boolean };
  },
  intake: ReturnType<typeof normalise>
): Promise<void> {
  const hook = import.meta.env.SLACK_WEBHOOK;
  const { contact, intake: meta } = record;
  const lines = [
    `*Exposure Report requested* — ${contact.company} (${contact.domain})`,
    `${contact.name} · ${contact.email}${meta.wants_call ? ' · also asked for a call' : ''}`,
    `> ${intake.oneLiner}`,
    meta.trigger ? `Driving it: ${meta.trigger}` : null,
    intake.competitors.length ? `Named competitors: ${intake.competitors.join(', ')}` : null,
    meta.free_mail_mismatch
      ? ':warning: free-mail address that does not match the site — confirm the company before crawling'
      : null,
    '',
    'To fulfil — about two minutes, then read it before releasing:',
    '```',
    `cd tools/exposure && ${fulfilCommand(intake)}`,
    '# then, from sites/reality-check:',
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
