/* ---------------------------------------------------------------------------
   The brief: what a person told us before the research ran.

   Two sources feed the same `trigger` string. The website form packs the
   lead's three answers under labels (sites/reality-check/src/lib/intake.ts).
   The /one-thing skill packs a teammate's cold-outreach brief the same way,
   plus two things a form never carries:

     OUTREACH: cold          the recipient did not ask for anything
     EVIDENCE: <url> | note  a page the teammate says supports "why now"

   EVIDENCE lines are not evidence yet. Stage 00 (stages/00-brief.ts) reads
   each URL and keeps a verbatim quote only if the page actually says it; that
   quote becomes a Verified claim the email may cite. The teammate's own words
   never do. This is the rule "check the page, not the summary" applied to
   ourselves.

   The parse is deliberately forgiving: labels are matched case-insensitively
   at line starts, unknown lines stay in the text, and a brief with no labels
   at all is just free text, as before.
--------------------------------------------------------------------------- */

export type Audience = 'lead' | 'cold';

export interface BriefEvidence {
  url: string;
  /** What the person says the page shows. Steers the quote search; never cited. */
  note: string;
}

export interface Brief {
  audience: Audience;
  evidence: BriefEvidence[];
  /** The brief with OUTREACH and EVIDENCE lines removed: what the prompts see. */
  text: string;
}

const isHttp = (u: string) => /^https?:\/\/\S+$/i.test(u);

export function parseBrief(trigger?: string): Brief {
  const lines = (trigger ?? '').split(/\r?\n/);
  let audience: Audience = 'lead';
  const evidence: BriefEvidence[] = [];
  const kept: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const outreach = line.match(/^\s*OUTREACH\s*:\s*(\w+)\s*$/i);
    if (outreach) {
      if (outreach[1].toLowerCase() === 'cold') audience = 'cold';
      continue;
    }
    const ev = line.match(/^\s*EVIDENCE\s*:\s*(.*)$/i);
    if (ev) {
      /* A malformed EVIDENCE line (no URL) is dropped rather than shown to the
         model as text: an unverifiable pointer is worth nothing in a prompt. */
      const [urlPart, ...rest] = ev[1].split('|');
      const url = urlPart.trim();
      if (isHttp(url)) evidence.push({ url, note: rest.join('|').trim() });
      continue;
    }
    kept.push(raw);
  }

  return {
    audience,
    evidence,
    text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}

/**
 * Build a brief string, the inverse of parseBrief. Used by tests and by
 * anything that wants to hand the pipeline a brief programmatically.
 */
export function formatBrief(args: {
  audience?: Audience;
  changed?: string;
  burn?: string;
  tried?: string;
  evidence?: BriefEvidence[];
}): string {
  const out: string[] = [];
  if (args.audience === 'cold') out.push('OUTREACH: cold');
  if (args.changed?.trim()) out.push(`WHAT CHANGED RECENTLY: ${args.changed.trim()}`);
  for (const e of args.evidence ?? []) out.push(`EVIDENCE: ${e.url}${e.note ? ` | ${e.note}` : ''}`);
  if (args.burn?.trim()) out.push(`WHERE THE TEAM BURNS TIME: ${args.burn.trim()}`);
  if (args.tried?.trim()) out.push(`ALREADY TRIED, EVALUATED OR RULED OUT: ${args.tried.trim()}`);
  return out.join('\n\n');
}
