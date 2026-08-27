/* ---------------------------------------------------------------------------
   The qualifier: questions, scoring, gates, routing.

   Single source of truth. The client form and the server endpoint both import
   from here, so the score a visitor's answers produce in the browser is the
   same one the endpoint records. Never fork this logic.

   Spec: docs/06-qualifier-spec.md in the seesawgrowth repo.
   Validated against 14 personas — see §5 of that doc.
--------------------------------------------------------------------------- */

export type RevenueBand = 'lt10' | '10-50' | '50-250' | '250-1b' | 'gt1b';
export type Role = 'cto' | 'ceo' | 'caio' | 'product' | 'other';
export type Stage = 'stalled' | 'live_flat' | 'scoping' | 'planning' | 'exploring';
export type TriedScore = 0 | 1 | 2;
export type Route = 'auto_book' | 'manual_review' | 'not_yet';

export interface Answers {
  role: Role | null;
  roleTitle?: string;
  revenue: RevenueBand | null;
  stage: Stage | null;
  tried?: string;
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  websiteSource?: 'blank' | 'prefilled' | 'user_corrected';
  industry?: string;
  referredBy?: string;
  budgetAck?: boolean;
}

export interface Verdict {
  points: {
    revenue: number | null;
    role: number | null;
    stage: number | null;
    tried: number;
    budgetAck: number;
  };
  total: number;
  route: Route | null;
  gate: string | null;
  icpOverride: boolean;
}

/* -- options, in display order ---------------------------------------- */

export const ROLES: { value: Role; label: string }[] = [
  { value: 'cto', label: 'CTO / VP Engineering' },
  { value: 'ceo', label: 'CEO / COO / Owner' },
  { value: 'caio', label: 'Chief AI, Data, or Digital Officer' },
  { value: 'product', label: 'Product leadership' },
  { value: 'other', label: 'Something else' },
];

export const REVENUE_BANDS: { value: RevenueBand; label: string }[] = [
  { value: 'lt10', label: 'Under $10M' },
  { value: '10-50', label: '$10M – $50M' },
  { value: '50-250', label: '$50M – $250M' },
  { value: '250-1b', label: '$250M – $1B' },
  { value: 'gt1b', label: 'Over $1B' },
];

export const STAGES: { value: Stage; label: string }[] = [
  { value: 'stalled', label: 'We tried something and it stalled' },
  { value: 'live_flat', label: "Something's live but it isn't delivering" },
  { value: 'scoping', label: "We're scoping a build now" },
  { value: 'planning', label: 'Planning for later this year' },
  { value: 'exploring', label: 'Still exploring' },
];

/* Grouped wedge-first. [WEDGE] — the grouping and the first four depend on
   the positioning decision. Swap the groups if it lands elsewhere; the field
   itself stays. */
export const INDUSTRY_GROUPS: { group: string; options: { value: string; label: string }[] }[] = [
  {
    group: 'Care operations',
    options: [
      { value: 'pharmacy', label: 'Pharmacy / PBM / medication management' },
      { value: 'hospice', label: 'Hospice, palliative & post-acute' },
      { value: 'renal', label: 'Dialysis & renal' },
      { value: 'care_mgmt', label: 'Care management / value-based care' },
    ],
  },
  {
    group: 'Healthcare, other',
    options: [
      { value: 'payer', label: 'Payer / health plan / insurtech' },
      { value: 'provider', label: 'Provider group / health system' },
      { value: 'healthtech', label: 'Health tech / digital health' },
      { value: 'hc_other', label: 'Other healthcare' },
    ],
  },
  {
    group: 'Other industries',
    options: [
      { value: 'ecommerce', label: 'Ecommerce / retail' },
      { value: 'media', label: 'Media, entertainment & social' },
      { value: 'edtech', label: 'Ed tech / education' },
      { value: 'proptech', label: 'Real estate / proptech' },
      { value: 'travel', label: 'Travel & hospitality' },
      { value: 'adtech', label: 'Marketing / adtech' },
      { value: 'fintech', label: 'Financial services / fintech' },
      { value: 'insurance', label: 'Insurance (non-health)' },
      { value: 'logistics', label: 'Logistics & supply chain' },
      { value: 'manufacturing', label: 'Manufacturing / industrial' },
      { value: 'proservices', label: 'Professional services' },
      { value: 'ind_other', label: 'Something else' },
    ],
  },
];

/* -- weights ----------------------------------------------------------- */

const REVENUE_POINTS: Record<RevenueBand, number> = {
  lt10: 0, // gated out before scoring
  '10-50': 1,
  '50-250': 1,
  '250-1b': 1,
  gt1b: 1,
};

const ROLE_POINTS: Record<Role, number> = {
  cto: 2,
  ceo: 2,
  caio: 2,
  product: 1,
  other: 1, // a CMO at a $400M system is a good lead — never zero this
};

/* The heaviest input: this tap carries the ICP detection, so the exact buyer
   is identified by a click rather than by how well they write. */
const STAGE_POINTS: Record<Stage, number> = {
  stalled: 3,
  live_flat: 3,
  scoping: 2,
  planning: 1,
  exploring: 0,
};

/** The two flavours of burned buyer. Either auto-books past the gates. */
export const ICP_STAGES: Stage[] = ['stalled', 'live_flat'];

export const AUTO_BOOK_AT = 6;
export const MANUAL_REVIEW_AT = 3;
export const MAX_SCORE = 9;

export const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'proton.me', 'protonmail.com', 'live.com', 'msn.com',
];

/* -- prior-attempt scoring --------------------------------------------
   A bonus that can only add. Blank costs nothing it could have earned and
   never subtracts — that property is what stops the form punishing people
   who'd rather talk than type.

   LENGTH IS NOT A CRITERION. "Pilot stalled at integration" is four words and
   fully specific. This heuristic stands in for the LLM rubric; production
   scores it server-side and async, and the raw text always reaches the human
   reviewer alongside the score.
--------------------------------------------------------------------------- */

const SPECIFIC_SIGNALS =
  /(stalled|stopped|abandoned|shelved|paused|failed|didn'?t|never|reverted|went back|dropped|shut|integration|adoption|rollout|pilot|poc|prototype|epic|cerner|salesforce|sharepoint|snowflake|copilot|chatgpt|claude|openai|azure|aws|rpa|ehr|emr|crm|api|prior auth|intake|claims|scheduling|billing|documentation|eligibility|denial)/i;

export function scoreTried(text?: string): TriedScore {
  const t = (text ?? '').trim();
  if (!t) return 0;
  if (/\d/.test(t) || SPECIFIC_SIGNALS.test(t)) return 2;
  return 1;
}

/* -- gates, then score ------------------------------------------------
   Scoring alone misroutes: a $6M startup with a perfect stall story scores
   7/9 on merit and would auto-book — precisely the anti-ICP. So revenue runs
   as a hard gate ahead of the score.
--------------------------------------------------------------------------- */

export function evaluate(a: Answers): Verdict {
  const triedPts = scoreTried(a.tried);
  const ackPts = a.budgetAck ? 1 : 0;

  const points = {
    revenue: a.revenue ? REVENUE_POINTS[a.revenue] : null,
    role: a.role ? ROLE_POINTS[a.role] : null,
    stage: a.stage ? STAGE_POINTS[a.stage] : null,
    tried: triedPts,
    budgetAck: ackPts,
  };

  const total =
    (points.revenue ?? 0) + (points.role ?? 0) + (points.stage ?? 0) + triedPts + ackPts;

  const icpOverride = a.stage != null && ICP_STAGES.includes(a.stage);

  // Gate 1 — cannot clear a $50k build floor.
  if (a.revenue === 'lt10') {
    return {
      points,
      total,
      route: 'not_yet',
      gate: 'Under $10M cannot clear a $50k build floor.',
      icpOverride,
    };
  }

  // Gate 2 — secondary ICP: the $10–20k/mo tier, not the growth engine.
  if (a.revenue === '10-50') {
    return {
      points,
      total,
      route: 'manual_review',
      gate: '$10–50M is secondary ICP — capped at manual review.',
      icpOverride,
    };
  }

  if (!a.revenue || !a.role || !a.stage) {
    return { points, total, route: null, gate: null, icpOverride };
  }

  if (total >= AUTO_BOOK_AT || icpOverride) {
    return {
      points,
      total,
      route: 'auto_book',
      gate:
        icpOverride && total < AUTO_BOOK_AT
          ? 'ICP override — a stalled or under-delivering initiative books at any score.'
          : null,
      icpOverride,
    };
  }

  if (total >= MANUAL_REVIEW_AT) {
    return { points, total, route: 'manual_review', gate: null, icpOverride };
  }

  return { points, total, route: 'not_yet', gate: null, icpOverride };
}

/** Domain from an email, lowercased. Empty string when unparseable. */
export function emailDomain(email: string): string {
  return (email.split('@')[1] ?? '').toLowerCase().trim();
}

/** True when the domain is a consumer provider, so we can't derive a website. */
export function isFreeEmail(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.includes(domain);
}
