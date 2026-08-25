/* ---------------------------------------------------------------------------
   Stage 5 — assemble graded claims into the report.

   No network, no model. Deterministic arrangement of already-validated claims,
   so the same claims always produce the same document and the format can be
   iterated for free.

   The LLM's job, when it enters the pipeline, is upstream of this: turning
   crawled pages into Claims with sources attached. It never writes a number
   into this document, because this document only renders numbers that arrived
   with a source or a declared blank.
--------------------------------------------------------------------------- */

import type { Claim, Coverage, MissingVariable, Source } from '../lib/claim.ts';
import { partitionClaims, summarizeCoverage } from '../lib/claim.ts';
import type { RunMeta } from '../lib/run.ts';

export interface AssembleInput {
  meta: RunMeta;
  claims: Claim[];
  coverage: Coverage;
  /** Set for development fixtures so a prototype can never read as real. */
  syntheticNotice?: string;
}

const H = {
  observed: 'What we can see about you',
  opportunity: 'Where AI is creating opportunity for you',
  threat: 'Where AI is a threat to you',
  arithmetic: "The arithmetic we couldn't finish",
  unknown: "What we couldn't determine",
  sources: 'Sources',
} as const;

function renderSources(sources: Source[], index: Map<string, number>): string {
  const refs = sources
    .map((s) => index.get(s.url))
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b)
    .map((n) => `[^${n}]`);
  return refs.join('');
}

function renderClaim(claim: Claim, index: Map<string, number>): string {
  const peer = claim.peerName ? `**${claim.peerName}** — ` : '';
  const dated = claim.observedAt ? ` *(${claim.observedAt})*` : '';
  return `- ${peer}${claim.statement}${dated}${renderSources(claim.sources, index)}`;
}

/** Hypotheses render with their blanks intact, then name what we'd need. */
function renderHypothesis(claim: Claim, index: Map<string, number>): string {
  const vars = claim.missingVariables ?? [];
  const asks = vars
    .map((v: MissingVariable) => `\`[${v.key}]\` — ${v.label}${v.unit ? ` (${v.unit})` : ''}`)
    .join('; ');
  const lines = [`- ${claim.statement}${renderSources(claim.sources, index)}`];
  if (asks) lines.push(`  - **We'd need from you:** ${asks}`);
  return lines.join('\n');
}

function section(title: string, body: string[]): string {
  if (body.length === 0) return '';
  return `## ${title}\n\n${body.join('\n')}\n`;
}

export function assembleReport(input: AssembleInput): {
  markdown: string;
  rejected: ReturnType<typeof partitionClaims>['rejected'];
} {
  const { meta, coverage, syntheticNotice } = input;
  const { renderable, rejected } = partitionClaims(input.claims);

  // Footnote index over every URL that survives validation, in first-use order.
  const index = new Map<string, number>();
  const ordered: Source[] = [];
  for (const claim of renderable) {
    for (const s of claim.sources) {
      if (!index.has(s.url)) {
        index.set(s.url, index.size + 1);
        ordered.push(s);
      }
    }
  }

  const byAngle = (angle: Claim['angle'], tiers: Claim['tier'][]) =>
    renderable.filter((c) => c.angle === angle && tiers.includes(c.tier));

  const observed = renderable.filter((c) => c.tier === 'observed' && c.angle === 'context');
  const hypotheses = renderable.filter((c) => c.tier === 'hypothesis');

  const parts: string[] = [];

  parts.push(`# AI Opportunity Brief — ${meta.domain}\n`);
  if (syntheticNotice) {
    parts.push(`> **${syntheticNotice}**\n`);
  }
  parts.push(
    `*Generated ${meta.startedAt}. Every figure below carries a source or a blank we` +
      ` need from you. Nothing is estimated silently.*\n`
  );
  if (meta.trigger) parts.push(`**What you told us is driving this:** ${meta.trigger}\n`);

  parts.push(section(H.observed, observed.map((c) => renderClaim(c, index))));
  parts.push(
    section(
      H.opportunity,
      byAngle('opportunity', ['observed', 'comparative']).map((c) => renderClaim(c, index))
    )
  );
  parts.push(
    section(
      H.threat,
      byAngle('threat', ['observed', 'comparative']).map((c) => renderClaim(c, index))
    )
  );

  if (hypotheses.length > 0) {
    parts.push(
      `## ${H.arithmetic}\n\n` +
        `We can see the shape of these. We cannot finish the math without numbers` +
        ` only you have — so the blanks are left blank rather than guessed.\n\n` +
        hypotheses.map((c) => renderHypothesis(c, index)).join('\n') +
        '\n'
    );
  }

  // The signature move: the boundary is the product, and the reason to talk.
  const unknowns = [
    ...hypotheses.flatMap((c) => (c.missingVariables ?? []).map((v) => v.label)),
    ...coverage.shortfalls.map((s) => `thin public evidence (${s})`),
  ];
  if (unknowns.length > 0) {
    const bullets = [...new Set(unknowns)].map((u) => `- ${u}`).join('\n');
    parts.push(
      `## ${H.unknown}\n\n` +
        `This report is built entirely from public evidence. These are the things` +
        ` that would change the conclusions and that no amount of research can` +
        ` reach:\n\n${bullets}\n`
    );
  }

  if (ordered.length > 0) {
    const notes = ordered
      .map((s, i) => {
        const label = s.title ?? s.publisher ?? s.url;
        return `[^${i + 1}]: ${label} — ${s.url} *(retrieved ${s.retrievedAt})*`;
      })
      .join('\n');
    parts.push(`## ${H.sources}\n\n${notes}\n`);
  }

  parts.push(`---\n\n*${summarizeCoverage(coverage)}*\n`);

  return { markdown: parts.filter(Boolean).join('\n'), rejected };
}
