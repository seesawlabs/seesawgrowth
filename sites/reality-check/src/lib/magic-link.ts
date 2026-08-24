/* ---------------------------------------------------------------------------
   Magic links for Exposure Reports.

   An Exposure Report names a company, quotes their own pages back to them, and
   lists what we could not find out. It is not secret, but it is *theirs*, and
   it must not be indexable, guessable, or forwardable forever.

   STATELESS BY DESIGN. The token carries the report id, the recipient and an
   expiry, signed with an HMAC. Verification needs no database lookup, which
   means the link works before any storage decision is made and keeps working
   if that decision changes. There is no session, no cookie and no password —
   possession of the link is the credential, which is the correct bar for a
   document we are choosing to send someone.

   WHAT THIS DOES NOT DO, deliberately:

     - No per-link revocation. Killing one link early means rotating the secret
       (which kills all of them) or adding a denylist. For a sales artifact with
       a 30-day expiry that trade is right; if we ever attach something
       sensitive, this is the assumption to revisit first.
     - No rate limiting. That belongs at the edge, not here.

   The signature covers every field, so a recipient cannot extend their own
   expiry or read another company's report by editing the payload — any change
   invalidates the MAC. Comparison is constant-time.
--------------------------------------------------------------------------- */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Days a link stays live. Long enough to forward internally, short enough to rot. */
export const DEFAULT_TTL_DAYS = 30;

export interface LinkPayload {
  /** Report id — the key the store resolves. */
  r: string;
  /** Recipient email, lowercased. Recorded so a leaked link is attributable. */
  e: string;
  /** Expiry, seconds since epoch. */
  x: number;
  /** Issued at, seconds since epoch. */
  i: number;
}

export type VerifyFailure =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'no_secret';

export type VerifyResult =
  | { ok: true; payload: LinkPayload }
  | { ok: false; reason: VerifyFailure };

/* -- base64url ---------------------------------------------------------- */

function b64u(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64u(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/* -- signing ------------------------------------------------------------ */

function sign(body: string, secret: string): string {
  return b64u(createHmac('sha256', secret).update(body).digest());
}

/**
 * Mint a link token.
 *
 * `secret` is required rather than read from the environment here, so this
 * module stays pure and testable and the caller is forced to decide where the
 * secret comes from.
 */
export function mintToken(
  args: { reportId: string; email: string; ttlDays?: number; now?: Date },
  secret: string
): string {
  if (!secret) throw new Error('magic-link: refusing to mint without a secret');
  const nowMs = (args.now ?? new Date()).getTime();
  const ttl = args.ttlDays ?? DEFAULT_TTL_DAYS;
  const payload: LinkPayload = {
    r: args.reportId,
    e: args.email.trim().toLowerCase(),
    x: Math.floor(nowMs / 1000) + ttl * 86_400,
    i: Math.floor(nowMs / 1000),
  };
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(
  token: string,
  secret: string,
  now: Date = new Date()
): VerifyResult {
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (typeof token !== 'string' || token.length > 4096) return { ok: false, reason: 'malformed' };

  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return { ok: false, reason: 'malformed' };
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  // Verify the signature BEFORE parsing the payload: never hand attacker-
  // controlled bytes to JSON.parse on an unauthenticated path.
  const expected = sign(body, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: LinkPayload;
  try {
    payload = JSON.parse(unb64u(body).toString('utf8')) as LinkPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload || typeof payload.r !== 'string' || typeof payload.x !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (!isSafeReportId(payload.r)) return { ok: false, reason: 'malformed' };
  if (payload.x * 1000 <= now.getTime()) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}

/**
 * Report ids are used to build a storage path, so they are constrained here
 * rather than at the storage layer. A signed token cannot be forged, but an
 * *operator* could still mint one with a traversal sequence in it by mistake,
 * and this is the cheapest place to make that impossible.
 */
export function isSafeReportId(id: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(id) && !id.includes('..');
}

/** Stable, readable report id from a domain and a run timestamp. */
export function reportIdFor(domain: string, runId: string): string {
  const d = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  const r = runId.replace(/[^a-zA-Z0-9-]/g, '-');
  return `${d}--${r}`.slice(0, 120);
}

/** Absolute magic link. `base` is the site origin, no trailing slash needed. */
export function linkFor(base: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/r/${encodeURIComponent(token)}`;
}

export function daysUntil(expiry: number, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((expiry * 1000 - now.getTime()) / 86_400_000));
}
