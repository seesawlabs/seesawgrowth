/* ---------------------------------------------------------------------------
   The two emails in the package flow: the analysis, and the 45 minutes.

   Both live here rather than at their call sites, because the call sites are
   in different runtimes — one is an Astro route on Vercel, the other a Node
   script an operator runs on a laptop — and the one thing that must not drift
   between them is what we promised. The ack says a link is coming; the
   delivery has to be the thing the ack described.

   NO TURNAROUND PROMISE. There is a human review gate between the request and
   the send: a brief that came back thin gets routed to a call instead of
   emailed, and a run takes minutes but a review takes as long as it takes.
   "Shortly" is the most we can honestly say, and the confirmation screen says
   the same word, so the two agree.

   PLAIN TEXT IS NOT THE FALLBACK, it is the other half. Plenty of the people
   we are writing to read mail in a client that strips styling, and a brief
   whose whole pitch is "we actually looked at your business" should not arrive
   as a wall of broken markup. Every template returns both.
--------------------------------------------------------------------------- */

export interface Sender {
  from: string;
  replyTo?: string;
}

export interface Message {
  subject: string;
  text: string;
  html: string;
}

/** Same sender identity on both emails, so the second is not a stranger. */
export const SENDER: Sender = {
  from: 'SeeSaw Labs <hello@seesawlabs.com>',
  replyTo: 'calvin@seesawlabs.com',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * One shell for both messages. Inline styles only — every mail client that
 * matters ignores a stylesheet — and a max width rather than a table layout,
 * which is enough for two paragraphs and a button and degrades to a readable
 * single column everywhere else.
 */
function shell(bodyHtml: string, footer: string): string {
  return `<div style="margin:0;padding:24px;background:#f7f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;color:#1a1a1a;font-size:16px;line-height:1.6">
    ${bodyHtml}
  </div>
  <p style="max-width:520px;margin:16px auto 0;color:#6b6b6b;font-size:13px;line-height:1.5;text-align:center">
    ${footer}
  </p>
</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:600;font-size:15px">${esc(label)}</a></p>`;
}

const p = (text: string) => `<p style="margin:0 0 16px">${text}</p>`;

/**
 * Sent the moment someone asks. Its job is to stop them wondering whether the
 * form worked, and to get the session booked while they are still thinking
 * about us. The booking does not have to wait for the analysis: we would
 * rather hold the time and have read the document by then.
 *
 * `bookingUrl` present means they were offered a calendar on the page. Absent
 * means they were routed to review, and a time comes by hand — so the email
 * must not imply a calendar they were not given.
 */
export function ackEmail(args: {
  name: string;
  company: string;
  bookingUrl?: string;
}): Message {
  const first = args.name.trim().split(/\s+/)[0] || 'there';
  const lines = [
    `Thanks for asking, ${first}.`,
    `Two things are yours now. The first is the analysis: we're reading ${args.company}'s public material, what comparable companies have shipped and when, and what your category is searching for. One of us goes through the draft before it goes anywhere, which is the part that takes the time.`,
    `The second is 45 minutes with the people who wrote it. We'll open with what we found rather than asking you to explain the business, put the questions to you that would change our recommendation, and tell you what we've seen work and what we've watched fail.`,
  ];
  const closing = args.bookingUrl
    ? `Grab a time whenever suits. Before the analysis lands is fine — we'll have read it by then either way.`
    : `We'll come back to you with times for that session shortly, along with the link.`;

  return {
    subject: `Your analysis and session — ${args.company}`,
    text: [...lines, closing, args.bookingUrl ?? '', 'Calvin, SeeSaw Labs'].filter(Boolean).join('\n\n'),
    html: shell(
      lines.map(p).join('') +
        p(closing) +
        (args.bookingUrl ? button(args.bookingUrl, 'Book the 45 minutes') : '') +
        `<p style="margin:28px 0 0;color:#6b6b6b">Calvin, SeeSaw Labs</p>`,
      'You asked for this at seesawlabs.com. No list, no sequence — this and one more email.'
    ),
  };
}

/**
 * Sent when a brief has been read and released. Says what it is, says the two
 * things that make it worth opening, and asks for the correction — the honest
 * ask, since the document was written entirely from outside.
 */
export function readyEmail(args: {
  name: string;
  company: string;
  link: string;
  ttlDays: number;
  bookingUrl?: string;
}): Message {
  const first = args.name.trim().split(/\s+/)[0] || 'there';
  const lines = [
    `It's ready, ${first}.`,
    `What we'd build at ${args.company} if it were ours, what each one might be worth, and the questions we'd want answered first. Every figure links to where we found it, or sits there as a declared blank only you can fill.`,
    `The last section is the one to read first: what your context would sharpen. That is the agenda for the 45 minutes, and it is where a directional recommendation turns into a costed one.`,
  ];

  return {
    subject: `Your AI analysis — ${args.company}`,
    text: [
      ...lines,
      args.link,
      `The link is private to you and expires in ${args.ttlDays} days.`,
      args.bookingUrl ? `If we haven't got time in the diary yet: ${args.bookingUrl}` : '',
      'Calvin, SeeSaw Labs',
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: shell(
      lines.map(p).join('') +
        button(args.link, 'Read your brief') +
        `<p style="margin:16px 0 0;color:#6b6b6b;font-size:14px">Private to you, and it expires in ${args.ttlDays} days.</p>` +
        (args.bookingUrl
          ? p(
              `<a href="${esc(args.bookingUrl)}" style="color:#1a1a1a">If we haven&rsquo;t got time in the diary yet, grab it here &rarr;</a>`
            )
          : '') +
        `<p style="margin:28px 0 0;color:#6b6b6b">Calvin, SeeSaw Labs</p>`,
      `Sent because you asked for a brief on ${esc(args.company)}. That's the last one.`
    ),
  };
}

export interface SendResult {
  sent: boolean;
  /** Why not, when `sent` is false — an unset token is normal, not an error. */
  reason?: string;
  id?: string;
}

/**
 * Hands a message to Resend. Returns rather than throws on a missing token:
 * the flow has to survive an unconfigured environment, because losing a lead
 * to a 500 is worse than sending its email by hand.
 */
export async function sendEmail(
  to: string,
  message: Message,
  env: { RESEND_TOKEN?: string; sender?: Sender } = {}
): Promise<SendResult> {
  const token = env.RESEND_TOKEN;
  if (!token) return { sent: false, reason: 'RESEND_TOKEN unset' };

  const sender = env.sender ?? SENDER;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: sender.from,
      reply_to: sender.replyTo,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    return { sent: false, reason: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: body.id };
}
