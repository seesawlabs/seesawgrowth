/* ---------------------------------------------------------------------------
   POST /api/intake — someone asks for the session.

   ORDER MATTERS HERE. Log the raw submission first, before any integration,
   so a bug anywhere below cannot lose a lead. Then answer the visitor. The
   integrations fan out without the visitor waiting on them: a Slack outage
   must not turn into a spinner.

   NOT AWAITED IS NOT THE SAME AS NOT GUARANTEED. A first version fired the
   integrations with a bare `void Promise.allSettled(...)` and returned
   immediately after. On Vercel the function may be frozen the instant the
   response is sent, and whatever had not resolved — often the Slack POST —
   simply never finishes. `waitUntil`, from `@vercel/functions`, keeps the
   function alive until the promise settles.

   NOTHING IS SCORED. Every lead sees the calendar, every lead gets the ack
   email, and — when EXPOSURE_AUTORUN is on — every lead is researched the
   moment it lands, so the two documents the team decides from (the report and
   the email draft) arrive in Slack without anyone clicking anything. The
   alert says who they are and what they said. The team decides.

   WHY AUTORUN IS A SWITCH. A run costs a couple of dollars of third-party
   spend, and a public form gets junk. The switch exists so the team can fall
   back to the signed "run it" link if the junk ever costs more than the
   convenience saves. Both paths dispatch the same workflow.
--------------------------------------------------------------------------- */
import type { APIRoute } from 'astro';

import { coerceIntake, validate, normalise, type Intake, type NormalisedIntake, researchBrief } from '../../lib/intake';
import { ackEmail, sendEmail } from '../../lib/email';
import { serverEnv } from '../../lib/server-env';
import { bookingUrl } from '../../lib/booking';
import { dispatchAnalysis, DEFAULT_REF } from '../../lib/dispatch';
import { waitUntil } from '@vercel/functions';
import { mintActionToken, actionLink } from '../../lib/run-link';

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

  /* Before anything else, so a bug below never loses a lead. */
  console.log('[intake] submission', JSON.stringify({ intake }));

  const duplicate = isDuplicate(`${intake.email}|${intake.domain}`);

  if (!duplicate) {
    waitUntil(
      Promise.allSettled([alertAndRun(intake), acknowledge(intake)]).then((rs) =>
        rs.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`[intake] fanout ${i} failed`, r.reason);
        })
      )
    );
  }

  return json({ ok: true, duplicate, bookingUrl: bookingUrl() });
};

/* -- integrations: env-guarded, no-op loudly ---------------------------- */

/** Long pastes are welcome in the form and unwelcome in a Slack message. */
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()} …` : s);

/**
 * Tell the team, then start the research.
 *
 * The alert goes first and on its own, so a dispatch failure is reported in
 * the same channel as the lead rather than swallowing it. When autorun is on,
 * the workflow posts the report and the email draft back into Slack itself
 * when it finishes; this message just says that is coming.
 */
async function alertAndRun(intake: NormalisedIntake): Promise<void> {
  const hook = serverEnv('SLACK_WEBHOOK');
  const secret = serverEnv('EXPOSURE_LINK_SECRET');
  const origin = serverEnv('PUBLIC_SITE_ORIGIN');
  const ghToken = serverEnv('GITHUB_DISPATCH_TOKEN');
  const autorun = (serverEnv('EXPOSURE_AUTORUN') ?? '').toLowerCase() === 'true' || serverEnv('EXPOSURE_AUTORUN') === '1';

  /* Either the research starts now, or the alert carries the link that starts
     it. Decide before composing so the message can say which. */
  let runLine: string;
  if (autorun && ghToken) {
    const result = await dispatchAnalysis(
      {
        mode: 'run',
        domain: intake.domain,
        email: intake.email,
        name: intake.name,
        /* The domain stands in for the name; the pipeline reads the real one
           off the homepage and treats a company equal to its domain as
           "derive it". Category and peers are inferred there too. */
        company: intake.domain,
        trigger: researchBrief(intake),
      },
      { token: ghToken, ref: serverEnv('GITHUB_DISPATCH_REF') ?? DEFAULT_REF }
    );
    runLine = result.ok
      ? ':hourglass_flowing_sand: *Research is running.* The report (PDF) and an email draft post here when it finishes, about ten minutes.'
      : `:x: *Auto-run failed* (GitHub ${result.status}: ${clip(result.body, 160)}). Run it by hand from \`sites/reality-check\` with \`npm run fulfil\`.`;
    console.log(`[intake] autorun ${result.ok ? 'dispatched' : `FAILED ${result.status}`} for ${intake.domain}`);
  } else if (secret && origin) {
    const link = actionLink(
      origin,
      mintActionToken(
        {
          a: 'run',
          domain: intake.domain,
          email: intake.email,
          name: intake.name,
          company: intake.domain,
          category: '',
          peers: [],
          /* The token rides in a URL, so the brief is bounded here. The full
             text is in the alert above the link, and in the function log. */
          trigger: researchBrief(intake).slice(0, 1_500) || undefined,
        },
        secret
      )
    );
    runLine = `:arrow_forward: *<${link}|Run the research>* — about ten minutes, then the report and an email draft post back here.`;
  } else {
    runLine =
      ':warning: No runner configured: set EXPOSURE_AUTORUN with GITHUB_DISPATCH_TOKEN, or EXPOSURE_LINK_SECRET and PUBLIC_SITE_ORIGIN for a run link. See DEPLOY.md §3a.';
  }

  const answer = (label: string, text?: string) =>
    text ? `*${label}*\n> ${clip(text, 1_500).replace(/\n/g, '\n> ')}` : `*${label}*\n> _(left blank)_`;

  const lines = [
    `:large_blue_circle: *New opportunity* — ${intake.domain}`,
    `${intake.name}${intake.roleTitle ? `, ${intake.roleTitle}` : ''} · ${intake.email}${intake.role ? ` · ${intake.role}` : ''}`,
    '',
    answer('What changed recently', intake.changed),
    answer('Where the team burns time', intake.burn),
    answer('Already tried, evaluated or ruled out', intake.tried),
    intake.domainMismatch
      ? ':warning: work address on a different domain than the site — confirm the company before trusting the research'
      : null,
    intake.freeMail ? ':warning: consumer email address' : null,
    '',
    runLine,
  ].filter(Boolean);

  if (!hook) {
    console.log('[intake] Slack skipped — SLACK_WEBHOOK unset\n' + lines.join('\n'));
    return;
  }
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n'), unfurl_links: false, unfurl_media: false }),
  });
  const body = await res.text().catch(() => '');
  console.log(
    res.ok
      ? `[intake] Slack alerted (${body.slice(0, 20) || 'no body'})`
      : `[intake] Slack REJECTED ${res.status}: ${body.slice(0, 200)}`
  );
}

/**
 * The "we got it" email, sent immediately to everyone. It says what happens
 * next in the order that applies to them: booked already, or book now.
 */
async function acknowledge(intake: NormalisedIntake): Promise<void> {
  const message = ackEmail({
    name: intake.name,
    company: intake.domain,
    bookingUrl: bookingUrl(),
  });
  const result = await sendEmail(intake.email, message, {
    RESEND_TOKEN: serverEnv('RESEND_TOKEN'),
  });
  console.log(
    result.sent
      ? `[intake] ack email sent to ${intake.email} (${result.id ?? 'no id'})`
      : `[intake] ack email NOT sent to ${intake.email} — ${result.reason}`
  );
}
