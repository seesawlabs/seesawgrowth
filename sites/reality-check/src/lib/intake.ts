/* ---------------------------------------------------------------------------
   One intake for the offer: the 45-minute session, and the report after it.

   WHAT IS ASKED, AND WHY (re-cut 2026-09-02). Who they are and where the
   research starts: name, work email, website. Their role, one tap. And three
   open questions, in their words, that the research cannot get from a website:

     changed   "What changed recently that made this worth your time right
               now?" Aims the research at what is actually live for them.
     burn      "Where does your team burn time in a way that feels dumb?"
               Points at where the buildable gap lives.
     tried     "Anything you've already tried, evaluated, or ruled out here?"
               Kills the accurate-but-obvious recommendation, which is the
               machine's most expensive failure.

   WHAT WAS DROPPED, AND WHY. Company name, the one-line description, industry,
   named competitors and the referral field. All of them were things the
   pipeline can read or infer from the website, and every field we ask for is
   a reason to stop typing. The company name comes from the homepage title;
   the category from the crawl; the competitive set from peer discovery. If
   any of those inferences proves weak in practice, the fix is in the
   pipeline, not another form field.

   SCORING IS RETIRED FROM THIS FLOW. `qualifier.ts` still holds the model and
   its spec (docs/06), but this module no longer calls it: every lead is
   researched and every lead sees the calendar, and the team reads the alert
   and decides.

   NO CHARACTER LIMITS THE VISITOR CAN HIT. The only ceiling is an abuse cap
   that exists so a pasted novel cannot break a Slack message or a prompt.
--------------------------------------------------------------------------- */

import {
  emailDomain,
  isFreeEmail,
  type Answers,
  /* Extension included on purpose: Vite resolves either, but the check
     scripts run under plain node, which does not. */
} from './qualifier.ts';

export interface Intake {
  /* who they are, and where the research starts */
  name: string;
  email: string;
  website: string;

  /* context, read by a person */
  role?: Answers['role'];
  roleTitle?: string;

  /* the three open questions, in their words */
  /** What changed recently that made this worth their time right now. */
  changed?: string;
  /** Where the team burns time in a way that feels dumb. */
  burn?: string;
  /** Anything already tried, evaluated, or ruled out. */
  tried?: string;

  attribution?: Record<string, string>;
}

export type FieldError = { field: keyof Intake; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Not a limit anyone types up to. It stops a pasted document from breaking
 * the Slack alert or ballooning a prompt, and that is all it is for.
 */
export const TEXT_ABUSE_CAP = 20_000;

/** The three questions, as the form asks them. One place, so the alert and the form agree. */
export const OPEN_QUESTIONS: { key: 'changed' | 'burn' | 'tried'; label: string; briefLabel: string }[] = [
  {
    key: 'changed',
    label: 'What changed recently that made this worth your time right now?',
    briefLabel: 'WHAT CHANGED RECENTLY',
  },
  {
    key: 'burn',
    label: 'Where does your team burn time in a way that feels dumb?',
    briefLabel: 'WHERE THE TEAM BURNS TIME',
  },
  {
    key: 'tried',
    label: 'Anything you’ve already tried, evaluated, or ruled out here?',
    briefLabel: 'ALREADY TRIED, EVALUATED OR RULED OUT',
  },
];

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

  return {
    name: str(input.name),
    email: str(input.email),
    website: str(input.website),
    role: pick(input.role, ['cto', 'ceo', 'caio', 'product', 'other'] as const),
    roleTitle: str(input.roleTitle) || undefined,
    changed: str(input.changed) || undefined,
    burn: str(input.burn) || undefined,
    tried: str(input.tried) || undefined,
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

  if (!input.website?.trim()) push('website', 'We need a website to read.');
  else if (!normaliseSite(input.website)) push('website', 'That does not look like a website address.');

  /* Role is the one qualifying answer that stays required: it is context the
     team reads, and one tap. Nothing else about them is gated. */
  if (!input.role) push('role', 'Pick the closest role.');

  for (const q of OPEN_QUESTIONS) {
    if ((input[q.key] ?? '').length > TEXT_ABUSE_CAP) {
      push(q.key, 'That is longer than we can take through this form. Email it to us instead.');
    }
  }

  return errors;
}

export interface NormalisedIntake extends Intake {
  domain: string;
  emailDomain: string;
  /** True when we could not derive a company domain from the email. */
  freeMail: boolean;
  /** Work address whose domain does not match the site they gave us. */
  domainMismatch: boolean;
}

/** Assumes validate() passed. */
export function normalise(input: Intake): NormalisedIntake {
  const domain = normaliseSite(input.website) ?? '';
  const email = input.email.trim().toLowerCase();
  const mailDomain = emailDomain(email);

  return {
    ...input,
    name: input.name.trim(),
    email,
    website: `https://${domain}`,
    domain,
    changed: input.changed?.trim() || undefined,
    burn: input.burn?.trim() || undefined,
    tried: input.tried?.trim() || undefined,
    emailDomain: mailDomain,
    freeMail: isFreeEmail(mailDomain),
    domainMismatch: isFreeEmail(mailDomain) ? false : Boolean(mailDomain) && mailDomain !== domain,
  };
}

/**
 * The three answers as one labelled text, for the research prompts.
 *
 * The pipeline takes a single `trigger` string; the labels are what let the
 * analyst treat the answers differently (what changed sets "why now", where
 * time burns points at the gap, what was ruled out is a list of things not to
 * recommend). Empty answers are omitted rather than labelled as empty.
 */
export function researchBrief(i: Intake): string {
  return OPEN_QUESTIONS.map((q) => (i[q.key]?.trim() ? `${q.briefLabel}: ${i[q.key]!.trim()}` : null))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The two commands that fulfil a request by hand, for when the runner is
 * misconfigured or someone wants to drive it from a laptop.
 *
 * Built from the same spec the form collects, so a field we ask for and a field
 * the pipeline receives cannot diverge. The first line carries the recipient as
 * well as the research arguments: the second pass reads them back from the run
 * directory, so nobody ever retypes an email address to release a client's
 * document. No --company and no --category: the pipeline derives both from
 * the site, which is the point of not asking.
 */
export function fulfilCommands(i: NormalisedIntake): { generate: string; release: string } {
  const q = (v: string) => JSON.stringify(v);
  const parts = ['npm run fulfil --', `--domain ${i.domain}`, `--email ${i.email}`, `--name ${q(i.name)}`];
  const brief = researchBrief(i);
  if (brief) parts.push(`--trigger ${q(brief.slice(0, 6_000))}`);

  return {
    generate: parts.join(' '),
    release: `npm run fulfil -- --domain ${i.domain} --release --send`,
  };
}
