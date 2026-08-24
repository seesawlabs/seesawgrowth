/* ---------------------------------------------------------------------------
   What we ask for, and why each field exists.

   DERIVED BACKWARDS FROM THE REPORT, not from what a form usually asks. Every
   field here changes the output; nothing here is collected because it is nice
   to have. The pipeline was run against seven real companies first and this is
   what those runs said it needed.

     website      everything. The crawl, the peer search, the demand pull.
     company      what we call them in the document.
     name/email   where the private link goes.

     oneLiner     THE make-or-break field. Peer discovery is driven by a
                  natural-language description of the category, and by default
                  we infer it from the site's own meta description. Five of
                  seven live targets had a meta description that was marketing
                  copy — "Caring provides exceptional in home health care for
                  patients across the U.S. Contact us today!" produced a report
                  with no comparable companies at all, while the one target
                  where we supplied the line by hand went from 80% to 100%
                  coverage. One sentence from the visitor fixes what no amount
                  of query tuning reliably fixes.

     competitors  the second-highest-value field, for the same stage. They know
                  their market; we are inferring it. Named peers skip discovery
                  but not validation — see `namedPeers` in stage 02.

     trigger      steers what the analysis leads with. Not evidence, and the
                  model is told so.

   WHAT WE DELIBERATELY DO NOT ASK. Case volumes, cycle times, headcount, spend.
   Those are the blanks the report leaves open on purpose — they are the agenda
   for the call, and the boundary section is the most persuasive part of the
   document. Asking for them upfront would trade the whole point of the report
   for data we would only use to fill in arithmetic the reader does better.
--------------------------------------------------------------------------- */

export interface Intake {
  name: string;
  email: string;
  company: string;
  website: string;
  /** "In one line, what does your company do?" */
  oneLiner: string;
  /** Up to three competitor domains or names. */
  competitors: string[];
  /** "What's driving this right now?" */
  trigger?: string;
  /** They also want a call. Not exclusive with the report. */
  wantsCall?: boolean;
  attribution?: Record<string, string>;
}

export type FieldError = { field: keyof Intake; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Bare registrable host, or null. Accepts what people actually paste — a full
 * URL, a `www.` prefix, a trailing path — and rejects anything that is not a
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
 * The one-liner has to be worth sending to a search API. Too short and it
 * describes nothing; a bare company name describes nothing either. This is a
 * floor, not a quality judgement — the visitor's own words beat our inference
 * even when they are clumsy.
 */
export const ONE_LINER_MIN = 20;
export const ONE_LINER_MAX = 300;

export const MAX_COMPETITORS = 3;
export const TRIGGER_MAX = 500;

export function validate(input: Partial<Intake>): FieldError[] {
  const errors: FieldError[] = [];
  const push = (field: keyof Intake, message: string) => errors.push({ field, message });

  if (!input.name?.trim()) push('name', 'We need a name to address the report to.');
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) push('email', 'We need an email to send the link to.');
  else if (!EMAIL.test(email)) push('email', 'That does not look like an email address.');

  if (!input.company?.trim()) push('company', 'We need the company name.');

  if (!input.website?.trim()) push('website', 'We need a website to read.');
  else if (!normaliseSite(input.website)) push('website', 'That does not look like a website address.');

  const one = (input.oneLiner ?? '').trim();
  if (!one) push('oneLiner', 'One line about what you do — this is what we search on.');
  else if (one.length < ONE_LINER_MIN)
    push('oneLiner', `A few more words, please — at least ${ONE_LINER_MIN} characters.`);
  else if (one.length > ONE_LINER_MAX)
    push('oneLiner', `Keep it under ${ONE_LINER_MAX} characters.`);

  if ((input.competitors ?? []).filter((c) => c.trim()).length > MAX_COMPETITORS) {
    push('competitors', `Up to ${MAX_COMPETITORS}, please.`);
  }
  if ((input.trigger ?? '').length > TRIGGER_MAX) {
    push('trigger', `Keep it under ${TRIGGER_MAX} characters.`);
  }

  return errors;
}

/** Normalised intake, ready to hand to the pipeline. Assumes validate() passed. */
export function normalise(input: Intake): Intake & { domain: string; competitorDomains: string[] } {
  const domain = normaliseSite(input.website) ?? '';
  return {
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company.trim(),
    website: `https://${domain}`,
    domain,
    oneLiner: input.oneLiner.trim(),
    competitors: (input.competitors ?? []).map((c) => c.trim()).filter(Boolean).slice(0, MAX_COMPETITORS),
    /* A competitor may be typed as a name rather than a domain. Only the ones
       that parse as hosts can seed stage 02; the rest still reach the operator,
       who can look them up. */
    competitorDomains: (input.competitors ?? [])
      .map((c) => normaliseSite(c))
      .filter((d): d is string => Boolean(d))
      .slice(0, MAX_COMPETITORS),
    trigger: input.trigger?.trim() || undefined,
  };
}

/**
 * The command an operator runs to fulfil a request. Kept next to the intake
 * spec so the two cannot drift: every field the form collects appears here, and
 * a field that appears in neither place is a field we should stop asking for.
 */
export function fulfilCommand(i: ReturnType<typeof normalise>): string {
  const parts = [
    'npm run report --',
    i.domain,
    `--company ${JSON.stringify(i.company)}`,
    `--category ${JSON.stringify(i.oneLiner)}`,
  ];
  for (const d of i.competitorDomains) parts.push(`--peer ${d}`);
  if (i.trigger) parts.push(`--trigger ${JSON.stringify(i.trigger)}`);
  return parts.join(' ');
}
