/* ---------------------------------------------------------------------------
   The claim model — where "never invent a metric" is enforced mechanically.

   Every statement in an Opportunity Brief is a Claim, graded by how we know it:

     observed     we found it on the subject's own public surface
     comparative  we found it about a named peer
     hypothesis   we inferred it, and it carries the variables we're missing

   The rule that matters: a numeral in a statement must either be sourced or be
   a declared placeholder. That makes the discipline a build-time failure
   instead of an editorial habit, which is the only way it survives automation.

   Spec context: docs/05-reality-check-spec.md, and the repo-wide rule in
   CLAUDE.md — the hard numbers we own are HPS's "5x faster medication
   approvals" and Kountable's "$8MM Series B". Everything else needs a source.
--------------------------------------------------------------------------- */

export type EvidenceTier = 'observed' | 'comparative' | 'hypothesis';
export type Confidence = 'high' | 'medium' | 'low';

/**
 * What the claim argues, orthogonal to how well we know it. A dated peer
 * launch is `comparative` evidence and a `threat` angle; the same launch in a
 * category they don't compete in yet is an `opportunity`.
 */
export type Angle = 'opportunity' | 'threat' | 'context';

export interface Source {
  url: string;
  title?: string;
  publisher?: string;
  /** ISO 8601. Every retrieval is dated — SEO and competitor data both rot. */
  retrievedAt: string;
}

/** A number we cannot know without asking. Rendered as a blank, never guessed. */
export interface MissingVariable {
  /** Token used in the statement, e.g. `[checksPerMonth]`. */
  key: string;
  /** Human phrasing for the ask: "eligibility checks per month". */
  label: string;
  unit?: string;
}

export interface Claim {
  id: string;
  tier: EvidenceTier;
  angle: Angle;
  /**
   * Prose. Placeholders are written `[key]` and must be declared in
   * `missingVariables`. Any other numeral requires at least one source.
   */
  statement: string;
  subject: 'self' | 'peer';
  peerName?: string;
  sources: Source[];
  missingVariables?: MissingVariable[];
  /** When the underlying event happened (not when we fetched it). */
  observedAt?: string;
  confidence?: Confidence;
  /**
   * True for evidence that should inform the analysis but never appear in the
   * client's document.
   *
   * Careers pages are the case this exists for. The README calls them a
   * highest-yield research target, and it is right — what a company is hiring
   * for tells you which workflow is under strain. But a job advert is not a
   * description of a process, and quoting a client's own vacancies back at them
   * reads as filler. The first live report rendered "Perform all tasks in a
   * safe manner that is consistent with corporate policies" as a manual step
   * worth costing. It is boilerplate from a pharmacy-tech listing.
   *
   * So these claims stay in claims.json and go to stage 06 as signal; the
   * renderer drops them.
   */
  internalOnly?: boolean;
}

/* -- validation -------------------------------------------------------- */

export interface ClaimProblem {
  claimId: string;
  code:
    | 'missing_source'
    | 'bad_source_url'
    | 'unsourced_numeral'
    | 'undeclared_placeholder'
    | 'unused_variable'
    | 'peer_without_name';
  detail: string;
}

const PLACEHOLDER = /\[([a-zA-Z][a-zA-Z0-9_]*)\]/g;

/** Numerals outside of placeholder brackets. */
function bareNumerals(statement: string): string[] {
  const withoutPlaceholders = statement.replace(PLACEHOLDER, '');
  return withoutPlaceholders.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

function placeholders(statement: string): string[] {
  return [...statement.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

function isHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Returns every problem with a claim. Empty array means it may render.
 *
 * Deliberately strict: a dated competitor move ("shipped in March 2026")
 * contains a numeral and therefore needs a source. That is the correct
 * outcome, not a false positive.
 */
export function validateClaim(claim: Claim): ClaimProblem[] {
  const problems: ClaimProblem[] = [];
  const p = (code: ClaimProblem['code'], detail: string) =>
    problems.push({ claimId: claim.id, code, detail });

  for (const source of claim.sources) {
    if (!isHttpUrl(source.url)) p('bad_source_url', `not an http(s) URL: ${source.url}`);
  }

  if (claim.subject === 'peer' && !claim.peerName?.trim()) {
    p('peer_without_name', 'peer claims must name the peer');
  }

  // Evidence tiers that assert fact need a source, full stop.
  if (claim.tier !== 'hypothesis' && claim.sources.length === 0) {
    p('missing_source', `${claim.tier} claims require at least one source`);
  }

  const declared = new Set((claim.missingVariables ?? []).map((v) => v.key));
  const used = new Set(placeholders(claim.statement));

  for (const key of used) {
    if (!declared.has(key)) p('undeclared_placeholder', `[${key}] is not declared`);
  }
  for (const key of declared) {
    if (!used.has(key)) p('unused_variable', `${key} is declared but never used`);
  }

  // The core rule.
  const bare = bareNumerals(claim.statement);
  if (bare.length > 0 && claim.sources.length === 0) {
    p(
      'unsourced_numeral',
      `numeral(s) ${bare.join(', ')} with no source — cite it or make it a [placeholder]`
    );
  }

  return problems;
}

export function partitionClaims(claims: Claim[]): {
  renderable: Claim[];
  rejected: { claim: Claim; problems: ClaimProblem[] }[];
} {
  const renderable: Claim[] = [];
  const rejected: { claim: Claim; problems: ClaimProblem[] }[] = [];
  for (const claim of claims) {
    const problems = validateClaim(claim);
    if (problems.length === 0) renderable.push(claim);
    else rejected.push({ claim, problems });
  }
  return { renderable, rejected };
}

/* -- coverage ---------------------------------------------------------- */

/**
 * Minimums a run must clear to be worth sending. Below these, a report reads
 * as generic — and sending a thin report to a good prospect is worse than
 * sending nothing, so the run routes to "let's just talk" instead.
 *
 * Tunable in one place on purpose. Every threshold here is a guess until we
 * have run this against real targets.
 */
export const COVERAGE_MINIMUMS = {
  pagesCrawled: 5,
  peersIdentified: 3,
  /**
   * One, not two.
   *
   * Two was the guess made before stage 06 existed, when the report's value
   * *was* the peer list — a document whose competitive section held a single
   * dated move genuinely did read thin. Across six real targets we never
   * legitimately reached two: the one run that did was counting a
   * non-attribution disclaimer as evidence, which is the bug that made a 90%
   * report look sendable at 100%.
   *
   * With an analyst in the pipeline the calculus changed. "Of eight comparable
   * companies only one has a public dated initiative, and it goes at the
   * document work you describe" is a finding, and the sparseness is part of it
   * — an early field is a different conversation from a settled one. Zero still
   * fails, because with no peer move there is no comparative claim to reason
   * from at all.
   */
  peersWithDatedAiEvidence: 1,
  observedClaims: 4,
  comparativeClaims: 3,
} as const;

export type CoverageInput = { [K in keyof typeof COVERAGE_MINIMUMS]: number };

export interface Coverage extends CoverageInput {
  /** Mean attainment across minimums, capped per-metric at 1. */
  score: number;
  sufficient: boolean;
  shortfalls: string[];
}

export function scoreCoverage(input: CoverageInput): Coverage {
  const keys = Object.keys(COVERAGE_MINIMUMS) as (keyof typeof COVERAGE_MINIMUMS)[];
  const shortfalls: string[] = [];
  let attained = 0;

  for (const key of keys) {
    const min = COVERAGE_MINIMUMS[key];
    const got = input[key];
    attained += Math.min(1, min === 0 ? 1 : got / min);
    if (got < min) shortfalls.push(`${key}: ${got}/${min}`);
  }

  return {
    ...input,
    score: attained / keys.length,
    sufficient: shortfalls.length === 0,
    shortfalls,
  };
}

export function summarizeCoverage(c: Coverage): string {
  const pct = Math.round(c.score * 100);
  return c.sufficient
    ? `coverage ${pct}% — sufficient to send`
    : `coverage ${pct}% — INSUFFICIENT, route to a call. Short: ${c.shortfalls.join('; ')}`;
}
