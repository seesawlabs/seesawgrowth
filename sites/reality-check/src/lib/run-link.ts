/* ---------------------------------------------------------------------------
   Signed links that do something, for pasting into Slack.

   The alert used to carry two shell commands. This carries two links: one that
   runs the analysis, one that sends it. Same two stages, same review in the
   middle, no laptop with six API keys on it.

   WHY THEY ARE SIGNED. A run costs about $1.90 of third-party spend, and a
   Slack message is forwarded, screenshotted and synced to phones. An
   unauthenticated URL that spends money is a URL that eventually gets clicked
   by someone who should not have. The signature makes the link itself the
   authorisation: it covers every field, so nobody can change the domain, the
   recipient or the action without invalidating it.

   WHY THE INTAKE TRAVELS INSIDE THE TOKEN. The runner is a GitHub Actions job
   with no memory of the request, and the site is stateless. Putting the intake
   in the signed payload means no database, and means the values the pipeline
   receives are provably the values the form collected.

   WHAT THE TOKEN DOES NOT DO. The payload is signed, not encrypted: anyone
   holding the link can base64-decode the lead's name and email out of it. That
   is acceptable for a link that lives in our own Slack and nowhere else, and it
   is the trade for needing no database. It is not acceptable to put one of
   these in a client-facing email, and nothing does.

   WHY GET DOES NOT ACT. Slack fetches links to build previews, as do mail
   clients and phone prefetchers. A GET that starts a $1.90 job would be spent
   by a preview bot before a human saw the message. So GET renders a
   confirmation page and the action needs a POST from it. The alert also asks
   Slack not to unfurl, which helps and is not sufficient.
--------------------------------------------------------------------------- */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Default lifetime. Long enough for a weekend, short enough to expire. */
export const DEFAULT_ACTION_TTL_DAYS = 14;

export type RunAction = 'run' | 'send';

export interface RunPayload {
  /** What clicking does. Part of the signature, so a run link cannot send. */
  a: RunAction;
  domain: string;
  email: string;
  name: string;
  company: string;
  /** The one-liner. Aims peer discovery, so it must not be tamperable. */
  category: string;
  peers: string[];
  trigger?: string;
  /**
   * The run being acted on. Empty for a `run` link, filled in by the workflow
   * when it mints the `send` link — which is how sending needs no run
   * directory and no retyped identifier.
   */
  run?: string;
  /** Expiry, seconds since epoch. */
  x: number;
}

const b64u = (b: Buffer) => b.toString('base64url');
const sign = (body: string, secret: string) =>
  b64u(createHmac('sha256', secret).update(body).digest());

export function mintActionToken(
  payload: Omit<RunPayload, 'x'> & { ttlDays?: number },
  secret: string
): string {
  if (!secret) throw new Error('mintActionToken needs the link secret');
  const { ttlDays = DEFAULT_ACTION_TTL_DAYS, ...rest } = payload;
  const body: RunPayload = {
    ...rest,
    x: Math.floor(Date.now() / 1000) + Math.round(ttlDays * 86_400),
  };
  const encoded = b64u(Buffer.from(JSON.stringify(body), 'utf8'));
  return `${encoded}.${sign(encoded, secret)}`;
}

export type ActionVerdict =
  | { ok: true; payload: RunPayload }
  | { ok: false; reason: 'no_secret' | 'malformed' | 'bad_signature' | 'expired' };

export function verifyActionToken(token: string, secret: string): ActionVerdict {
  if (!secret) return { ok: false, reason: 'no_secret' };
  const [encoded, mac] = token.split('.');
  if (!encoded || !mac) return { ok: false, reason: 'malformed' };

  /* Signature before parsing, always: never hand attacker-controlled JSON to
     the rest of the program on the strength of a guess. */
  const expected = Buffer.from(sign(encoded, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: RunPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as RunPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload.a !== 'run' && payload.a !== 'send') return { ok: false, reason: 'malformed' };
  if (!payload.domain || !payload.email) return { ok: false, reason: 'malformed' };
  if (typeof payload.x !== 'number' || payload.x * 1000 < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}

export function actionLink(base: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/api/run?t=${encodeURIComponent(token)}`;
}
