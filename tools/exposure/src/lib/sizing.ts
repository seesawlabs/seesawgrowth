/**
 * Presentation rules for the figures in a sizing block.
 *
 * Lives in `lib/` rather than in the synthesis stage because both ends need
 * it: stage 06 strips padding before validating (a padding row would otherwise
 * satisfy the "show at least two inputs" check without carrying any of the
 * estimate), and the renderer strips again so a run stored before this rule
 * existed still renders cleanly. Both functions are pure and idempotent.
 */

export type SizingAssumption = {
  label: string;
  value: string;
  unit?: string;
  basis: string;
};

/**
 * One shape for every figure in a sizing block.
 *
 * The model writes `value` and `unit` separately and inconsistently: "20" with
 * "%", "20%" with "", "8" with "hours per week", "2" with "hrs/wk". Rendered
 * verbatim the column came out ragged — some chips a bare numeral, some a
 * sentence — and a block whose whole job is to look checkable looked careless.
 * So the unit is folded in here, once, with the spacing convention decided in
 * one place: tight for a suffix symbol, spaced for a word.
 */
const MONEY = /^(usd|dollars?|\$|usd per year|us\$)$/i;

/** "27100" reads as a serial number; "27,100" reads as a quantity. */
function grouped(value: string): string {
  if (!/^\d{4,}$/.test(value)) return value;
  return Number(value).toLocaleString('en-US');
}

export function sizeValue(a: { value: string; unit?: string }): string {
  const raw = a.value.trim();
  const unit = (a.unit ?? '').trim();
  const value = grouped(raw);
  if (!unit) return value;
  // Already carries its own unit — "20%", "$45k", "8 hrs".
  if (raw.toLowerCase().endsWith(unit.toLowerCase())) return value;
  // Money reads as a prefix in every other line of this document.
  if (MONEY.test(unit)) return value.startsWith('$') ? value : `$${value}`;
  const tight = /^[%‰°]|^\//.test(unit);
  return tight ? `${value}${unit}` : `${value} ${unit}`;
}

/**
 * A calendar fact is not an assumption.
 *
 * An earlier rule required every digit in `arithmetic` to be declared above
 * it, which taught the model to declare unit conversions: "12 / Months in a
 * year / Calendar." sat in the middle of a sizing block, indistinguishable in
 * weight from the two figures the estimate actually rests on. The rule is
 * gone; the habit outlived it. Padding rows are dropped in code rather than in
 * the prompt alone, because the cost of one slipping through is a block that
 * reads like a form. Never below two rows — the sum still has to show its
 * inputs, and a block down to one input is a validation failure, not a tidier
 * block.
 */
const KNOWN_CONSTANT =
  /\b(months?|weeks?|days?|hours?|minutes?|seconds?)\s+(?:in|per)\s+(?:a|an|the|one)?\s*(year|quarter|month|week|day|hour)\b/i;

export function isPaddingAssumption(a: SizingAssumption): boolean {
  return KNOWN_CONSTANT.test(a.label) || /^\s*calendar\.?\s*$/i.test(a.basis);
}

type HasSizing = {
  opportunities: readonly { sizing?: { assumptions: SizingAssumption[] } | null }[];
};

export function stripPaddingAssumptions<T extends HasSizing>(synthesis: T): T {
  return {
    ...synthesis,
    opportunities: synthesis.opportunities.map((o) => {
      if (!o.sizing) return o;
      const keep = o.sizing.assumptions.filter((a) => !isPaddingAssumption(a));
      if (keep.length === o.sizing.assumptions.length || keep.length < 2) return o;
      return { ...o, sizing: { ...o.sizing, assumptions: keep } };
    }),
  } as T;
}

/**
 * A basis that opens "From dem-4, Google data pulled 2026-08-25" renders as
 * "From 9, Google data pulled…" once the id becomes a footnote — the sentence
 * now points at a superscript that is meant to sit at its end. So the citation
 * is moved there and the lead-in dropped, leaving a sentence that reads as a
 * sentence. Bases with no leading id are returned untouched.
 */
const LEADING_CITE = /^(?:from|per|source:)\s+((?:[a-z]{3,}-[a-z0-9-]+)(?:\s*,\s*[a-z]{3,}-[a-z0-9-]+)*)\s*[,.:;]?\s*/i;

export function normaliseBasis(basis: string): string {
  const m = LEADING_CITE.exec(basis.trim());
  if (!m) return basis;
  const rest = basis.trim().slice(m[0].length).trim();
  if (!rest) return basis;
  const sentence = rest.charAt(0).toUpperCase() + rest.slice(1);
  const punctuated = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  return `${punctuated} (${m[1]})`;
}

/**
 * A basis whose whole text is a citation — "From dem-4." — renders as "From
 * 9.", a row that says nothing next to rows that explain themselves. The
 * caller substitutes a fixed phrase and keeps the citation; the phrase is true
 * of every such row, because a value taken from a cited claim is measured
 * rather than chosen. Returns the ids, or null when the basis has words of its
 * own.
 */
export function citationOnlyBasis(basis: string): string | null {
  const trimmed = basis.trim();
  const m = LEADING_CITE.exec(trimmed);
  if (!m) return null;
  return trimmed.slice(m[0].length).trim() ? null : m[1]!;
}
