/* ---------------------------------------------------------------------------
   One intake for the offer: the 45-minute session, and the report after it.

   WHAT IS ASKED, AND WHY. Who they are and where the research starts (name,
   work email, company, website); the two fields that aim the research (the
   one-line description and the competitors they name); their role and
   industry, for context; and one open question — what they have already
   tried and what makes this worth their time now. That question replaced two
   multiple-choice ones about revenue and stage. Those existed to feed a score,
   and nothing is scored any more.

   SCORING IS RETIRED FROM THIS FLOW. `qualifier.ts` still holds the model and
   its spec (docs/06), but this module no longer calls it: every lead is
   researched and every lead sees the calendar, and the team reads the alert
   and decides. Reintroduce a gate deliberately, in one place, or not at all.

   NO CHARACTER LIMITS THE VISITOR CAN HIT. The one-liner keeps a minimum,
   because a three-word description makes the research about an industry
   rather than a company. Nothing has a maximum a person would reach; the only
   ceiling is an abuse cap that exists so a pasted novel cannot break a Slack
   message or a prompt.

   WHAT WE DELIBERATELY STILL DO NOT ASK. Volumes, cycle times, headcount,
   spend. Those are the questions the call is for.
--------------------------------------------------------------------------- */

import {
  emailDomain,
  isFreeEmail,
  type Answers,
  /* Extension included on purpose: Vite resolves either, but the check
     scripts run under plain node, which does not. */
} from './qualifier.ts';

export interface Intake {
  /* who they are */
  name: string;
  email: string;
  company: string;
  website: string;

  /* what aims the research */
  /** "In one line, what does your company do?" The highest-value field. */
  oneLiner: string;
  /** Up to three competitor domains or names. */
  competitors: string[];

  /* context, read by a person */
  industry?: string;
  role?: Answers['role'];
  roleTitle?: string;
  /** Free text: what they have tried, and what is driving this now. */
  tried?: string;
  referredBy?: string;
  budgetAck?: boolean;
  /** True when they picked a time on the calendar before answering. */
  bookedFirst?: boolean;

  attribution?: Record<string, string>;
}

export type FieldError = { field: keyof Intake; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ONE_LINER_MIN = 20;
export const MAX_COMPETITORS = 3;
/**
 * Not a limit anyone types up to. It stops a pasted document from breaking
 * the Slack alert or ballooning a prompt, and that is all it is for.
 */
export const TEXT_ABUSE_CAP = 20_000;

/**
 * Bare registrable host, or null. Accepts what people paste — a full URL, a
 * `www.` prefix, a trailing path — and rejects anything that is not a
 * hostname, because the next thing we do with it is crawl it.
 */
export function normaliseSite(raw: string): string | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '');
  if (!t || t.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(t)) return null;
  if (!/\.[a-z]{2,}$/.test(t)) return null;
  return t;
}

/**
 * Force arbitrary JSON into the shape the rest of this module assumes.
 *
 * The form is not the only thing that posts here. A string where the spec says
 * list once crashed validation on `.filter is not a function`, which is a 500
 * on a public lead form — the one failure mode that loses a lead without
 * leaving a trace. So the boundary coerces rather than trusts.
 */
export function coerceIntake(raw: unknown): Partial<Intake> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => {
    const s = str(v);
    return (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
  };
  const bool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

  const list = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(str).filter(Boolean);
    const one = str(v);
    return one
      ? one
          .split(/[,\n;]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  };

  return {
    name: str(input.name),
    email: str(input.email),
    company: str(input.company),
    website: str(input.website),
    oneLiner: str(input.oneLiner),
    competitors: list(input.competitors),
    industry: str(input.industry) || undefined,
    role: pick(input.role, ['cto', 'ceo', 'caio', 'product', 'other'] as const),
    roleTitle: str(input.roleTitle) || undefined,
    tried: str(input.tried) || undefined,
    referredBy: str(input.referredBy) || undefined,
    budgetAck: bool(input.budgetAck),
    bookedFirst: bool(input.bookedFirst),
    attribution:
      input.attribution && typeof input.attribution === 'object'
        ? (input.attribution as Record<string, string>)
        : undefined,
  };
}

export function validate(input: Partial<Intake>): FieldError[] {
  const errors: FieldError[] = [];
  const push = (field: keyof Intake, message: string) => errors.push({ field, message });

  if (!input.name?.trim()) push('name', 'We need a name to address the report to.');
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) push('email', 'We need an email to send the report to.');
  else if (!EMAIL.test(email)) push('email', 'That does not look like an email address.');

  if (!input.company?.trim()) push('company', 'We need the company name.');

  if (!input.website?.trim()) push('website', 'We need a website to read.');
  else if (!normaliseSite(input.website)) push('website', 'That does not look like a website address.');

  const one = (input.oneLiner ?? '').trim();
  if (!one) push('oneLiner', 'One line about what you do. This is what we search on.');
  else if (one.length < ONE_LINER_MIN)
    push('oneLiner', `A few more words, please. At least ${ONE_LINER_MIN} characters.`);
  else if (one.length > TEXT_ABUSE_CAP) push('oneLiner', 'That is longer than a description.');

  if ((input.competitors ?? []).filter((c) => c.trim()).length > MAX_COMPETITORS) {
    push('competitors', `Up to ${MAX_COMPETITORS}, please.`);
  }

  /* Role is the one qualifying answer that stays required: it is context the
     team reads, and one tap. Nothing else about them is gated. */
  if (!input.role) push('role', 'Pick the closest role.');

  if ((input.tried ?? '').length > TEXT_ABUSE_CAP) {
    push('tried', 'That is longer than we can take through this form. Email it to us instead.');
  }

  return errors;
}

export interface NormalisedIntake extends Intake {
  domain: string;
  competitorDomains: string[];
  emailDomain: string;
  /** True when we could not derive a company domain from the email. */
  freeMail: boolean;
  /** Free-mail address whose domain does not match the site they gave us. */
  domainMismatch: boolean;
}

/** Assumes validate() passed. */
export function normalise(input: Intake): NormalisedIntake {
  const domain = normaliseSite(input.website) ?? '';
  const email = input.email.trim().toLowerCase();
  const mailDomain = emailDomain(email);
  const competitors = (input.competitors ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPETITORS);

  return {
    ...input,
    name: input.name.trim(),
    email,
    company: input.company.trim(),
    website: `https://${domain}`,
    domain,
    oneLiner: input.oneLiner.trim(),
    tried: input.tried?.trim() || undefined,
    competitors,
    /* A competitor may be typed as a name rather than a domain. Only the ones
       that parse as hosts can seed peer discovery; the rest still reach the
       team, who can look them up. */
    competitorDomains: competitors
      .map((c) => normaliseSite(c))
      .filter((d): d is string => Boolean(d)),
    emailDomain: mailDomain,
    freeMail: isFreeEmail(mailDomain),
    domainMismatch: isFreeEmail(mailDomain) ? false : Boolean(mailDomain) && mailDomain !== domain,
  };
}

/**
 * The two commands that fulfil a request by hand, for when the runner is
 * misconfigured or someone wants to drive it from a laptop.
 *
 * Built from the same spec the form collects, so a field we ask for and a field
 * the pipeline receives cannot diverge. The first line carries the recipient as
 * well as the research arguments: the second pass reads them back from the run
 * directory, so nobody ever retypes an email address to release a client's
 * document.
 */
export function fulfilCommands(i: NormalisedIntake): { generate: string; release: string } {
  const q = (v: string) => JSON.stringify(v);
  const parts = [
    'npm run fulfil --',
    `--domain ${i.domain}`,
    `--email ${i.email}`,
    `--name ${q(i.name)}`,
    `--company ${q(i.company)}`,
    `--category ${q(i.oneLiner)}`,
  ];
  for (const d of i.competitorDomains) parts.push(`--peer ${d}`);
  if (i.tried) parts.push(`--trigger ${q(i.tried.slice(0, 2_000))}`);

  return {
    generate: parts.join(' '),
    release: `npm run fulfil -- --domain ${i.domain} --release --send`,
  };
}
