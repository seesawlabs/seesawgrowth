/* ---------------------------------------------------------------------------
   POST /api/intake — someone asks for the package.

   ONE ENDPOINT FOR ONE OFFER. It replaces /api/exposure-request and
   /api/reality-check, which existed when the analysis and the call were sold
   separately. Neither had a real submission other than a deploy smoke test, so
   they are gone rather than aliased.

   ORDER MATTERS HERE. Log the raw submission first, before scoring, routing or
   any integration, so a bug anywhere below cannot lose a lead. Then score,
   then answer the visitor. The integrations fan out without being awaited: a
   Slack outage must not turn into a visitor staring at a spinner.

   THE SCORE DECIDES NOTHING THE VISITOR SEES. Everyone is offered the calendar
   and everyone gets the ack email; the score tells the operator what to do,
   including cancelling a meeting a poor-fit lead has booked. A cancelled
   meeting costs one email. A qualified lead told to wait for one costs the
   lead. See `operatorAction` in lib/intake.ts.
--------------------------------------------------------------------------- */
import type { APIRoute } from 'astro';

import {
  coerceIntake,
  validate,
  normalise,
  scoreIntake,
  operatorAction,
  fulfilCommand,
  type Intake,
  type NormalisedIntake,
} from '../../lib/intake';
import { ackEmail, sendEmail } from '../../lib/email';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/* Same-shape repeat submissions inside one deploy's lifetime. In-memory and
   therefore per-instance, which is the right amount of effort: it stops a
   double-clicked button, and it is not pretending to be a database. */
const seen = new Set<string>();
function isDuplicate(key: string): boolean {
  if (seen.has(key)) return true;
  seen.add(key);
  if (seen.size > 500) seen.clear();
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const raw = coerceIntake(body);
  const errors = validate(raw);
  if (errors.length > 0) {
    console.log('[intake] rejected', JSON.stringify({ errors, email: raw.email }));
    return json({ error: 'invalid', errors }, 422);
  }

  const intake = normalise(raw as Intake);
  const verdict = scoreIntake(intake);

  /* Before any judgement, so a bug in the routing below never loses a lead. */
  console.log(
    '[intake] submission',
    JSON.stringify({ intake, score: verdict.total, route: verdict.route, gate: verdict.gate })
  );

  const duplicate = isDuplicate(`${intake.email}|${intake.domain}`);

  if (!duplicate) {
    void Promise.allSettled([alertOperator(intake, verdict), acknowledge(intake)]).then((rs) =>
      rs.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`[intake] fanout ${i} failed`, r.reason);
      })
    );
  }

  return json({
    ok: true,
    duplicate,
    /* The score and the gate stay server-side. A visitor has no use for a mark
       out of nine, and it is not a number we would want forwarded. */
    bookingUrl: bookingUrl(),
  });
};

/* -- integrations: env-guarded, no-op loudly ---------------------------- */

function bookingUrl(): string | undefined {
  const link = import.meta.env.PUBLIC_CAL_LINK;
  if (!link) return undefined;
  const url = new URL(link);
  url.searchParams.set('hide_event_type_details', '1');
  return url.toString();
}

/**
 * The human gate. This message IS the queue until there is a real one, so it
 * carries the score, the routing, and the exact command to fulfil the request.
 * The command is built by `fulfilCommand` from the same spec the form collects,
 * so a field we ask for and a field the pipeline receives cannot diverge.
 */
async function alertOperator(
  intake: NormalisedIntake,
  verdict: ReturnType<typeof scoreIntake>
): Promise<void> {
  const hook = import.meta.env.SLACK_WEBHOOK;
  const route = verdict.route ?? 'unrouted';
  const emoji =
    route === 'auto_book' ? ':large_green_circle:' : route === 'manual_review' ? ':large_yellow_circle:' : ':white_circle:';

  const lines = [
    `${emoji} *Package requested* — ${intake.company} (${intake.domain})`,
    `${intake.name}${intake.roleTitle ? `, ${intake.roleTitle}` : ''} · ${intake.email}`,
    `Score *${verdict.total}/9* · route *${route}*${verdict.icpOverride ? ' · ICP override' : ''}`,
    verdict.gate ? `Gate: ${verdict.gate}` : null,
    '',
    `> ${intake.oneLiner}`,
    intake.industry ? `Industry: ${intake.industry}` : null,
    intake.stage ? `Stage: ${intake.stage} · revenue ${intake.revenue} · role ${intake.role}` : null,
    intake.tried ? `Tried already: ${intake.tried.slice(0, 400)}` : null,
    intake.competitors.length ? `Named competitors: ${intake.competitors.join(', ')}` : null,
    intake.referredBy ? `Referred by: ${intake.referredBy}` : null,
    intake.domainMismatch
      ? ':warning: work address on a different domain than the site — confirm the company before crawling'
      : null,
    intake.freeMail ? ':warning: consumer email address' : null,
    '',
    /* Everyone can book, so the alert has to say what to do about it. */
    operatorAction(route === 'unrouted' ? null : verdict.route),
    '',
    'To fulfil — read it before releasing:',
    '```',
    `cd tools/exposure && ${fulfilCommand(intake)}`,
    '```',
  ].filter(Boolean);

  if (!hook) {
    console.log('[intake] Slack skipped — SLACK_WEBHOOK unset\n' + lines.join('\n'));
    return;
  }
  await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') }),
  });
}

/**
 * The "we got it" email, sent immediately to everyone. A lead the team decides
 * against gets a separate note from a person, which is a better rejection than
 * silence from a form and better than an autoresponder trying to soften it.
 */
async function acknowledge(intake: NormalisedIntake): Promise<void> {
  const message = ackEmail({
    name: intake.name,
    company: intake.company,
    bookingUrl: bookingUrl(),
  });
  const result = await sendEmail(intake.email, message, {
    RESEND_TOKEN: import.meta.env.RESEND_TOKEN,
  });
  console.log(
    result.sent
      ? `[intake] ack email sent to ${intake.email} (${result.id ?? 'no id'})`
      : `[intake] ack email NOT sent to ${intake.email} — ${result.reason}`
  );
}
