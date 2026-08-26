/* ---------------------------------------------------------------------------
   One intake for the package: the brief and the 45-minute session.

   THERE USED TO BE TWO FORMS. The qualifier scored a lead and booked a call;
   the brief intake collected the research fields and scored nothing. Selling
   both halves as one package means one form, and merging them carefully,
   because the qualifier never asked the two questions the brief depends on
   most: the one-line description and the competitor names. Five of seven test
   targets derived a poor category query from their own meta description, and
   naming competitors took one target from a single evidenced peer to three.
   A merge that dropped those fields would have degraded every brief quietly.

   SCORING IS NOT REIMPLEMENTED HERE. `qualifier.ts` is the single source of
   truth for gates, weights and routing, validated against 14 personas in
   docs/06 §5. This module composes it with the research fields and the
   contact details. Never fork that logic (see CLAUDE.md).

   WHAT WE DELIBERATELY STILL DO NOT ASK. Volumes, cycle times, headcount,
   spend. Those are the blanks the brief leaves open on purpose, and they are
   the agenda for the session. Asking upfront would trade the reason for the
   call for arithmetic the reader does better than we do.

   Field order is deliberate. The one-liner sits immediately after the website,
   while the visitor is still fresh, because a rushed answer there costs more
   than a rushed answer anywhere else.
--------------------------------------------------------------------------- */

import {
  evaluate,
  emailDomain,
  isFreeEmail,
  type Answers,
  type Route,
  type Verdict,
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

  /* what qualifies them; the shapes come from qualifier.ts */
  industry?: string;
  role?: Answers['role'];
  roleTitle?: string;
  revenue?: Answers['revenue'];
  stage?: Answers['stage'];
  /** Free text: what they have already tried. Scored, and read by a human. */
  tried?: string;
  referredBy?: string;
  budgetAck?: boolean;

  attribution?: Record<string, string>;
}

export type FieldError = { field: keyof Intake; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ONE_LINER_MIN = 20;
export const ONE_LINER_MAX = 300;
export const MAX_COMPETITORS = 3;
export const TRIED_MAX = 600;

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
    revenue: pick(input.revenue, ['lt10', '10-50', '50-250', '250-1b', 'gt1b'] as const),
    stage: pick(input.stage, ['stalled', 'live_flat', 'scoping', 'planning', 'exploring'] as const),
    tried: str(input.tried) || undefined,
    referredBy: str(input.referredBy) || undefined,
    budgetAck: input.budgetAck === true || input.budgetAck === 'on',
    attribution:
      input.attribution && typeof input.attribution === 'object'
        ? (input.attribution as Record<string, string>)
        : undefined,
  };
}

export function validate(input: Partial<Intake>): FieldError[] {
  const errors: FieldError[] = [];
  const push = (field: keyof Intake, message: string) => errors.push({ field, message });

  if (!input.name?.trim()) push('name', 'We need a name to address the analysis to.');
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) push('email', 'We need an email to send the link to.');
  else if (!EMAIL.test(email)) push('email', 'That does not look like an email address.');

  if (!input.company?.trim()) push('company', 'We need the company name.');

  if (!input.website?.trim()) push('website', 'We need a website to read.');
  else if (!normaliseSite(input.website)) push('website', 'That does not look like a website address.');

  const one = (input.oneLiner ?? '').trim();
  if (!one) push('oneLiner', 'One line about what you do. This is what we search on.');
  else if (one.length < ONE_LINER_MIN)
    push('oneLiner', `A few more words, please — at least ${ONE_LINER_MIN} characters.`);
  else if (one.length > ONE_LINER_MAX)
    push('oneLiner', `Keep it under ${ONE_LINER_MAX} characters.`);

  if ((input.competitors ?? []).filter((c) => c.trim()).length > MAX_COMPETITORS) {
    push('competitors', `Up to ${MAX_COMPETITORS}, please.`);
  }

  /* The qualifying answers. Required, because they decide whether we offer the
     session at all, and a form that lets someone skip them puts the operator
     back to guessing from a domain name. */
  if (!input.role) push('role', 'Pick the closest role.');
  if (!input.revenue) push('revenue', 'Pick a revenue band.');
  if (!input.stage) push('stage', 'Pick where the initiative stands.');

  if ((input.tried ?? '').length > TRIED_MAX) {
    push('tried', `Keep it under ${TRIED_MAX} characters.`);
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
    competitors,
    /* A competitor may be typed as a name rather than a domain. Only the ones
       that parse as hosts can seed peer discovery; the rest still reach the
       operator, who can look them up. */
    competitorDomains: competitors
      .map((c) => normaliseSite(c))
      .filter((d): d is string => Boolean(d)),
    emailDomain: mailDomain,
    freeMail: isFreeEmail(mailDomain),
    domainMismatch: isFreeEmail(mailDomain) ? false : Boolean(mailDomain) && mailDomain !== domain,
  };
}

/** The qualifier's verdict for this intake. Thin wrapper, one import site. */
export function scoreIntake(intake: NormalisedIntake): Verdict {
  return evaluate({
    role: intake.role ?? null,
    roleTitle: intake.roleTitle,
    revenue: intake.revenue ?? null,
    stage: intake.stage ?? null,
    tried: intake.tried,
    name: intake.name,
    email: intake.email,
    company: intake.company,
    website: intake.website,
    industry: intake.industry,
    referredBy: intake.referredBy,
    budgetAck: intake.budgetAck,
  });
}

/**
 * Every lead sees the calendar.
 *
 * The scoring used to decide this: only `auto_book` was shown a scheduler, so
 * the page never put a calendar in front of someone we would then have to turn
 * down. That was reversed deliberately — see docs/10 — because a booked meeting
 * we cancel costs one email, and a qualified lead who was told to wait for one
 * costs the lead. The team reads the score in the alert and handles the few
 * that are not a fit by hand.
 *
 * The verdict is still computed and still recorded. It drives what the operator
 * is told to do, not what the visitor is allowed to do.
 */
export function operatorAction(route: Route | null): string {
  if (route === 'auto_book') return 'Good fit. Run the analysis before the call if you can.';
  if (route === 'manual_review')
    return 'Secondary ICP. Worth the call; decide on the analysis when you read this.';
  return 'Not a fit on the numbers. They can still book, so cancel the meeting and send the no.';
}

/**
 * The command that fulfils a request, built from the same spec the form
 * collects so a field we ask for and a field the pipeline receives cannot
 * diverge. It goes in the Slack alert verbatim: an alert that needs you to go
 * and look something up is an alert that gets ignored.
 */
export function fulfilCommand(i: NormalisedIntake): string {
  const parts = [
    'npm run report --',
    i.domain,
    `--company ${JSON.stringify(i.company)}`,
    `--category ${JSON.stringify(i.oneLiner)}`,
  ];
  for (const d of i.competitorDomains) parts.push(`--peer ${d}`);
  if (i.tried) parts.push(`--trigger ${JSON.stringify(i.tried.slice(0, 200))}`);
  return parts.join(' ');
}
