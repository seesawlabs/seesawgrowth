/* ---------------------------------------------------------------------------
   The email draft — the short document.

   Stage 07 writes the email with claim ids in parentheses after the sentences
   they support. This turns those into numbered footnotes with the claim and
   its source underneath, so whoever reviews the draft can check each sentence
   against the page it came from before sending, and so the recipient, if the
   footnotes are kept, can do the same.

   THE OUTBOUND RULE, ENFORCED HERE TOO. Stage 07 is told the email may cite
   Verified claims only, and it is validated and retried on that. If a Cited
   or Tool-data citation survives anyway, this renderer does not hide it: the
   marker becomes [n†] and the footnote is prefixed CALL MATERIAL, so the
   sentence cannot be sent as written without a person noticing. The report's
   banner lists the same ids.

   Adds no facts. An id that matches no claim is removed and reported, never
   left in as a dangling reference and never invented into a source.

   Two outputs from one pass: plain text (for Slack, and for pasting into a
   mail client) and markdown (the file in the run directory). Same words.
--------------------------------------------------------------------------- */

import type { Claim } from '../lib/claim.ts';
import { claimStatus, isOutboundSafe, callMaterialReason } from '../lib/claim-status.ts';
import type { OneThing } from '../stages/07-one-thing.ts';

export interface EmailDraftInput {
  company: string;
  oneThing: OneThing;
  claims: Claim[];
  /** Named in the salutation when known. */
  recipientName?: string;
}

export interface Footnote {
  n: number;
  id: string;
  claim: Claim;
  /** False when the claim is not Verified: the sentence is call material. */
  outboundSafe: boolean;
}

export interface EmailDraft {
  subject: string;
  /** Body with [n] markers, no salutation, no footnotes. */
  body: string;
  text: string;
  markdown: string;
  footnotes: Footnote[];
  /** Ids the draft cited that match no claim. Empty is the goal. */
  unresolved: string[];
  /** Ids cited that are not Verified. Empty is the goal. */
  callMaterial: string[];
  verdict: OneThing['verdict'];
}

const ID_GROUP = /\(\s*([a-z0-9._-]+(?:\s*,\s*[a-z0-9._-]+)*)\s*\)/gi;

/**
 * Replace `(id)` and `(id, id)` groups with `[n]` markers, numbering by first
 * appearance. One marker per group: a sentence resting on three claims gets
 * one footnote pointing at the first, and the register carries the rest. A
 * non-Verified citation gets a dagger so it cannot pass as clean.
 */
export function footnoteClaimIds(
  text: string,
  claims: Claim[]
): { text: string; footnotes: Footnote[]; unresolved: string[] } {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const numbers = new Map<string, number>();
  const footnotes: Footnote[] = [];
  const unresolved = new Set<string>();

  const numberFor = (id: string): number | null => {
    const claim = byId.get(id);
    if (!claim) {
      unresolved.add(id);
      return null;
    }
    if (!numbers.has(id)) {
      numbers.set(id, numbers.size + 1);
      footnotes.push({ n: numbers.size, id, claim, outboundSafe: isOutboundSafe(claim) });
    }
    return numbers.get(id)!;
  };
  const marker = (id: string, n: number) => (isOutboundSafe(byId.get(id)!) ? `[${n}]` : `[${n}†]`);

  let out = text.replace(ID_GROUP, (whole, inner) => {
    const parts = String(inner)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    /* Only treat it as a citation if every part looks like one of our ids, so
       an ordinary parenthetical ("(and the ordering screen)") survives. */
    if (!parts.every((x) => byId.has(x) || /^(obs|cmp|dem|hyp)[a-z0-9._-]*$/i.test(x))) return whole;
    /* The first id in a group is the one that carries the sentence; the model
       is told to put it first. The rest are in the register. An unresolved
       first id falls through to the next, so a typo costs the footnote, not
       the sentence. */
    for (const part of parts) {
      const n = numberFor(part);
      if (n !== null) return marker(part, n);
    }
    return '';
  });

  /* Any id left loose in the prose, unparenthesised. */
  for (const id of [...byId.keys()].sort((a, b) => b.length - a.length)) {
    if (!out.includes(id)) continue;
    const n = numberFor(id);
    out = out.split(id).join(n ? marker(id, n) : '');
  }

  return {
    text: out
      .replace(/\s+(\[\d+†?\])/g, '$1')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
    footnotes,
    unresolved: [...unresolved],
  };
}

function sourceLine(claim: Claim): string {
  const s = claim.sources[0];
  if (!s) return 'no source recorded';
  const label = s.title || s.publisher || '';
  return `${label ? `${label} — ` : ''}${s.url} (retrieved ${s.retrievedAt.slice(0, 10)})`;
}

function noteHead(f: Footnote): string {
  const status = claimStatus(f.claim).label;
  return f.outboundSafe ? `[${f.n}] ` : `[${f.n}†] CALL MATERIAL (${status}: ${callMaterialReason(f.claim)}). Do not send this sentence as written. `;
}

export function renderEmailDraft(input: EmailDraftInput): EmailDraft {
  const { oneThing, claims } = input;
  const { text: body, footnotes, unresolved } = footnoteClaimIds(oneThing.email.body, claims);
  const first = input.recipientName?.trim().split(/\s+/)[0];
  const salutation = first ? `${first},` : '';
  const callMaterial = footnotes.filter((f) => !f.outboundSafe).map((f) => f.id);

  const banner =
    callMaterial.length > 0
      ? `REVIEW BEFORE SENDING: ${callMaterial.length} footnote(s) marked † cite claims that are not Verified. They are call material. Cut the sentence or say it on the call.`
      : '';

  const notesText = footnotes
    .map((f) => {
      const peer = f.claim.peerName ? `${f.claim.peerName}: ` : '';
      return `${noteHead(f)}${peer}${f.claim.statement}\n    ${sourceLine(f.claim)}`;
    })
    .join('\n');

  const notesMd = footnotes
    .map((f) => {
      const peer = f.claim.peerName ? `**${f.claim.peerName}**: ` : '';
      const s = f.claim.sources[0];
      const src = s
        ? `[${s.title || s.publisher || s.url}](${s.url}), retrieved ${s.retrievedAt.slice(0, 10)}`
        : 'no source recorded';
      const head = f.outboundSafe
        ? `${f.n}. `
        : `${f.n}. **† CALL MATERIAL** (${claimStatus(f.claim).label}: ${callMaterialReason(f.claim)}). `;
      return `${head}${peer}${f.claim.statement} · ${src} · \`${f.id}\` · ${claimStatus(f.claim).label}`;
    })
    .join('\n');

  const text = [
    banner ? `*** ${banner} ***\n` : null,
    `Subject: ${oneThing.email.subject}`,
    '',
    salutation,
    salutation ? '' : null,
    body,
    '',
    footnotes.length ? `—\nSources\n${notesText}` : '',
  ]
    .filter((x) => x !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const markdown = [
    `# Email draft — ${input.company}`,
    '',
    oneThing.verdict === 'nothing_worth_a_call' ? '> Verdict: nothing worth a call. This is the honest-no email.' : '',
    banner ? `> **${banner}**` : '',
    '',
    `**Subject:** ${oneThing.email.subject}`,
    '',
    salutation,
    salutation ? '' : null,
    body,
    '',
    footnotes.length ? `---\n\n### Sources\n\n${notesMd}` : '',
    unresolved.length ? `\n> Cited ids with no claim behind them were removed: ${unresolved.join(', ')}` : '',
  ]
    .filter((x) => x !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    subject: oneThing.email.subject,
    body,
    text,
    markdown,
    footnotes,
    unresolved,
    callMaterial,
    verdict: oneThing.verdict,
  };
}
