/* ---------------------------------------------------------------------------
   The two emails in the Opportunity Brief flow.

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
 * form worked, and to put the calendar in front of them while they are still
 * thinking about us — the booking is worth more to both sides than the brief
 * is, and it does not have to wait for it.
 */
export function ackEmail(args: {
  name: string;
  company: string;
  bookingUrl?: string;
}): Message {
  const first = args.name.trim().split(/\s+/)[0] || 'there';
  const lines = [
    `Thanks for asking, ${first}.`,
    `We're reading ${args.company}'s public material now: your own pages, what comparable companies have announced and when, and what people in your field are searching for. Then one of us goes through the draft before it goes anywhere, which is the part that takes the time.`,
    `You'll get a private link shortly. If we can't put together something worth your time, we'll tell you that instead of padding it out.`,
  ];
  const closing = args.bookingUrl
    ? `No need to wait for it, though. If you'd rather just talk, grab an hour.`
    : `Reply to this and we'll pick it up from there.`;

  return {
    subject: `We're putting together your AI Opportunity Brief`,
    text: [...lines, closing, args.bookingUrl ?? '', 'Calvin, SeeSaw Labs'].filter(Boolean).join('\n\n'),
    html: shell(
      lines.map(p).join('') +
        p(closing) +
        (args.bookingUrl ? button(args.bookingUrl, 'Book an hour') : '') +
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
    `Three things we'd build at ${args.company} if it were ours, a rough size on each, and the questions we'd want answered first. Every figure links to where we found it, or sits there as a blank we couldn't fill from outside.`,
    `Some of it will be wrong. We only had your website to go on, and there's a section at the end listing what we couldn't see. Telling us which parts we got wrong is the fastest hour either of us could spend.`,
  ];

  return {
    subject: `Your AI Opportunity Brief — ${args.company}`,
    text: [
      ...lines,
      args.link,
      `The link is private to you and expires in ${args.ttlDays} days.`,
      args.bookingUrl ? `Book an hour: ${args.bookingUrl}` : '',
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
              `<a href="${esc(args.bookingUrl)}" style="color:#1a1a1a">Or book the hour straight away &rarr;</a>`
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
