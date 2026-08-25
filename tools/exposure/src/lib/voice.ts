/* ---------------------------------------------------------------------------
   The constructions that make writing read as machine-generated.

   The first review of a finished report was "feels very AI generated". A scan
   of every user-facing string found why, and the counts were not subtle: 14
   em-dash asides landing a small conclusion, 5 "Not X. Y." pairs, 8 rhetorical
   uses of "worth", and 4 of 6 section headings appending a second clause after
   a comma for balance. None of it was deliberate, which is the point — these
   are habits, and habits come back.

   ONE LIST, TWO CALLERS. `scripts/check-voice.mjs` reads it for the static copy
   and rendered reports; stage 06 reads it to check what the model just wrote.
   Keeping the patterns here means a rule added for one is enforced by both.

   BUDGETS, NOT BANS. Some of these are fine once. One em-dash aside is a
   writer; nine is a tic. A checker that fires on the first instance gets
   switched off, so each pattern gets an allowance and only the excess counts.
--------------------------------------------------------------------------- */

export interface VoicePattern {
  id: string;
  re: RegExp;
  /** What to do instead. Goes into the repair prompt verbatim. */
  note: string;
  budget: number;
}

export const VOICE_PATTERNS: VoicePattern[] = [
  {
    id: 'em-dash-aside',
    re: /—[^.!?—\n]{10,90}[.!?]/g,
    note: 'An em-dash aside that lands a small conclusion. Use a full stop and a new sentence, or cut the aside.',
    budget: 2,
  },
  {
    id: 'not-x-but-y',
    re: /\b(?:It|That|This)(?:'s| is| does)? not (?:an?|the) [^.,;]{2,40}[.,] (?:It|That|This)(?:'s| is)? (?:an?|the)\b|\bnot (?:an?|the) [^.,;]{2,40}, (?:it'?s|but) \b/gi,
    note: '"Not X. Y." used as a rhetorical pair. Just say what the thing is.',
    budget: 0,
  },
  {
    id: 'rhetorical-worth',
    re: /\bworth (?:a conversation|your time|talking about|having|doing|the effort)\b|\bearns? its place\b/gi,
    note: '"worth …" doing rhetorical work. Say concretely what it gets them.',
    budget: 1,
  },
  {
    id: 'comma-appendix-heading',
    re: /^[A-Z][^.\n]{8,60}, and (?:whether|where|what|how|why)\b[^.\n]{0,40}$/gm,
    note: 'A heading with a balancing clause appended after a comma. Pick the half that matters.',
    budget: 0,
  },
  {
    id: 'jargon',
    re: /\bpublic surface\b|\bleverage\b|\bunlock\b|\bnorth star\b|\bdouble down\b|\brapidly evolving\b|\bin today's\b|\bat scale\b/gi,
    note: 'Consultant register or in-house jargon. Use the plain word.',
    budget: 0,
  },
  {
    id: 'inverted-moral',
    re: /\b(?:It|That|This) does(?:n't| not) need to be [^.,]{3,40}, it needs to\b|\bis not (?:about|a matter of) [^.,]{3,40}, (?:it'?s|but)\b/gi,
    note: 'A sentence ending on a neat inversion or a moral. Say it once and move on.',
    budget: 0,
  },
  {
    id: 'over-hedging',
    /* Counted across the document rather than per sentence. Each of these is
       honest once. A draft carrying five of them read as though we were unsure
       of everything and handing the work back to the reader, which was the
       note: "don't need to stuff all the 'we'll probably be wrong' in here".
       There is a section for the caveat; it belongs there. */
    re: /\bfrom the outside\b|\bprovisional\b|\bwe(?:'ve| have) only read\b|\bcorrect us\b|\bsome of (?:this|it) will be wrong\b|\bwe (?:may|might|could) (?:well )?be wrong\b|\btake (?:all of )?this as\b/gi,
    note: 'Hedging repeated across the document. Say the caveat once, in the section for it, and never in the opening line.',
    budget: 2,
  },
  {
    id: 'adversarial',
    re: /\bargue with\b|\btell us how (?:far off|wrong)\b|\bcorrect (?:us|them)\b|\bprove us wrong\b|\bchallenge (?:us|this)\b/gi,
    note: 'Frames the reader as an opponent. We are offering a shared first draft, not a dare.',
    budget: 0,
  },
  {
    id: 'faint-praise',
    re: /\bwin on [^.,]{3,40} rather than\b|\brather than on the quality\b|\b(?:an|in an) unusual (?:spot|position)\b|\byou'?re in an unusual\b/gi,
    note: 'Praises one thing by implying another is weak, or calls their position strange. Say what they are good at without the contrast.',
    budget: 0,
  },
  {
    id: 'triad',
    re: /\bno [a-z]{3,12}, no [a-z]{3,12}(?:,| and) no [a-z]{3,12}\b/gi,
    note: 'A three-item list used for rhythm rather than because there are three things.',
    budget: 0,
  },
];

export interface VoiceFlag {
  id: string;
  note: string;
  count: number;
  budget: number;
  /** Up to three offending fragments, for the repair prompt and the log. */
  examples: string[];
}

/** Flags only what exceeds its budget. An empty array means the prose is fine. */
export function checkVoice(text: string, patterns: VoicePattern[] = VOICE_PATTERNS): VoiceFlag[] {
  const flags: VoiceFlag[] = [];
  for (const p of patterns) {
    const found = [...text.matchAll(p.re)];
    if (found.length <= p.budget) continue;
    flags.push({
      id: p.id,
      note: p.note,
      count: found.length,
      budget: p.budget,
      examples: found.slice(0, 3).map((m) => m[0].replace(/\s+/g, ' ').trim().slice(0, 120)),
    });
  }
  return flags;
}

/** The flags as instructions a model can act on. */
export function describeFlags(flags: VoiceFlag[]): string {
  return flags
    .map(
      (f) =>
        `- ${f.note} (found ${f.count}, allowed ${f.budget})\n` +
        f.examples.map((e) => `    "${e}"`).join('\n')
    )
    .join('\n');
}

/**
 * Strip HTML so a rendered report can be checked as prose.
 *
 * Quoted material goes with it. The renderer wraps the client's own words in
 * `<q>`, and a report on Cultivate Advisors was flagged twice for "Unlock" —
 * their word, from their homepage, quoted accurately. We are checking how *we*
 * write, and holding a client's marketing copy against our house style is both
 * wrong and unfixable.
 */
export function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<q\b[^>]*>[\s\S]*?<\/q>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&#8212;/g, '—')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ');
}
