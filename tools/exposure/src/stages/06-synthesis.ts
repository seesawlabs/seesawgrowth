/* ---------------------------------------------------------------------------
   Stage 06 — the analyst.

   WHY THIS EXISTS, and it is a correction rather than an addition.

   The pipeline through stage 05 is a citation engine: it finds dated, sourced
   facts and arranges them. Read as a deliverable, that is a list of press
   releases and search volumes — true, traceable, and of very little use to the
   person receiving it. They do not want the evidence. They want to know what is
   happening in their category, whether their competitors' moves worked, where
   they are strong and weak, and what they should be weighing.

   The README's rule is that the model "never writes a number into this
   document". That constrains FIGURES. It was read as forbidding analysis, so
   for five stages no model ran at all. The distinction that matters:

     inventing    "AI could save you 30% of intake time"       forbidden
     synthesising "three of your eight peers automated prior
                   authorization since 2023, and all three
                   bought rather than built"                    the product

   The second sentence contains numerals and invents nothing: every figure is
   either in a validated claim or is a count of claims we computed and handed
   to the model. So the never-invent-a-metric rule is extended to prose rather
   than used as an excuse to avoid it — `validateSynthesis` below checks every
   digit in every generated sentence against the claims that sentence cites,
   and drops the block if a digit has no home. Same discipline, same remedy:
   drop it, never repair it.

   The model sees ONLY validated claims. It never sees raw crawled pages,
   Perplexity prose, or anything the citation gates rejected — so it cannot
   launder a dropped statement back into the report.
--------------------------------------------------------------------------- */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import type { Claim } from '../lib/claim.ts';
import type { Ledger } from '../lib/budget.ts';
import { cached, type CacheOptions } from '../lib/cache.ts';
import { requireCredential } from '../lib/env.ts';
import type { SubjectArtifact } from './01-subject.ts';
import type { PeersArtifact } from './02-peers.ts';
import type { PeerEvidenceArtifact } from './03-peer-evidence.ts';

/** Opus by default: this is the analysis, and it is what the report is for. */
export const DEFAULT_MODEL = 'claude-opus-5';

/* -- output shape -------------------------------------------------------- */

const Backed = z.object({
  point: z.string().describe('One or two sentences. Plain English, no hedging.'),
  claimIds: z.array(z.string()).describe('Ids of the claims that support this. At least one.'),
});

const SynthesisSchema = z.object({
  standing: z
    .string()
    .describe(
      'Two to four sentences answering "where do we actually stand". Written to the reader as "you".'
    ),
  strengths: z.array(Backed).describe('Where the evidence says they are well placed. 1-3 items.'),
  weaknesses: z.array(Backed).describe('Where the evidence says they are exposed. 1-3 items.'),
  categoryTrend: Backed.describe('What is happening in their category, and the direction of it.'),
  peerPattern: Backed.describe(
    'What comparable companies actually did, and whether it worked where the evidence says.'
  ),
  considerations: z
    .array(
      z.object({
        heading: z.string().describe('A short, specific label. Not a category name.'),
        body: z.string().describe('Two to three sentences. What to weigh, and why.'),
      })
    )
    .describe('What this company should be weighing about AI adoption. 2-4 items.'),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

/* -- validation ---------------------------------------------------------- */

export interface SynthesisProblem {
  field: string;
  code: 'unsourced_numeral' | 'unknown_claim_id' | 'no_evidence';
  detail: string;
}

/**
 * Claim ids contain digits — `obs-manual-1`, `cmp-1`, `dem-trend-2` — and the
 * model cites them inline as well as in the `claimIds` field. Left in, the
 * numeral check reads every citation as an unsourced figure: the first live run
 * dropped the entire `standing` paragraph and all four `considerations` over
 * the "1" in "(obs-manual-1)". Strip the references before counting digits.
 */
export function stripClaimIds(text: string, ids: readonly string[]): string {
  let out = text;
  for (const id of [...ids].sort((a, b) => b.length - a.length)) {
    out = out.split(id).join(' ');
  }
  return out;
}

/** Digits in prose, after citation references have been removed. */
function numeralsIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*%?/g) ?? []).map((n) => n.replace(/[.,]$/, ''));
}

/**
 * Figures the model is allowed to state without a claim behind them, because
 * we computed them and put them in the prompt. Anything else must trace to a
 * cited claim's own text.
 */
export function allowedFigures(facts: ComputedFacts): Set<string> {
  const out = new Set<string>();
  for (const v of Object.values(facts)) {
    if (typeof v === 'number') out.add(String(v));
  }
  return out;
}

export function validateSynthesis(
  synthesis: Synthesis,
  claims: Claim[],
  facts: ComputedFacts
): SynthesisProblem[] {
  const problems: SynthesisProblem[] = [];
  const byId = new Map(claims.map((c) => [c.id, c]));
  const allowed = allowedFigures(facts);
  const ids = claims.map((c) => c.id);

  /* Every figure anywhere in the sourced claim set. `standing` and
     `considerations` are prose that reads across the whole picture rather than
     one claim, so requiring per-field citation ids there would force the model
     to either drop the synthesis or pad it with references. A figure that
     appears in *some* validated claim is still a sourced figure — it just is
     not attributed in that sentence, which is the correct trade for a summary
     paragraph. The backed fields below keep the strict per-citation rule. */
  const globalHaystack = claims.map((c) => c.statement).join(' ');

  const check = (field: string, text: string, ids: string[]) => {
    if (ids.length === 0) {
      problems.push({ field, code: 'no_evidence', detail: 'cites no claim' });
    }
    const evidence: string[] = [];
    for (const id of ids) {
      const claim = byId.get(id);
      if (!claim) {
        problems.push({ field, code: 'unknown_claim_id', detail: `no claim ${id}` });
        continue;
      }
      evidence.push(claim.statement);
    }
    const haystack = evidence.join(' ');
    for (const n of numeralsIn(stripClaimIds(text, ids))) {
      const bare = n.replace('%', '');
      if (allowed.has(bare) || allowed.has(n)) continue;
      if (haystack.includes(bare)) continue;
      problems.push({
        field,
        code: 'unsourced_numeral',
        detail: `"${n}" appears in no cited claim and is not a figure we supplied`,
      });
    }
  };

  // `standing` and `considerations` are qualitative and cite nothing, so they
  // may contain only figures we supplied.
  const qualitative = (field: string, text: string) => {
    for (const n of numeralsIn(stripClaimIds(text, ids))) {
      const bare = n.replace('%', '');
      if (allowed.has(bare) || allowed.has(n)) continue;
      if (globalHaystack.includes(bare)) continue;
      problems.push({
        field,
        code: 'unsourced_numeral',
        detail: `"${n}" appears in no validated claim and is not a figure we supplied`,
      });
    }
  };

  qualitative('standing', synthesis.standing);
  synthesis.considerations.forEach((c, i) =>
    qualitative(`considerations[${i}]`, `${c.heading} ${c.body}`)
  );

  synthesis.strengths.forEach((s, i) => check(`strengths[${i}]`, s.point, s.claimIds));
  synthesis.weaknesses.forEach((s, i) => check(`weaknesses[${i}]`, s.point, s.claimIds));
  check('categoryTrend', synthesis.categoryTrend.point, synthesis.categoryTrend.claimIds);
  check('peerPattern', synthesis.peerPattern.point, synthesis.peerPattern.claimIds);

  return problems;
}

/**
 * Remove only the blocks that failed, keeping the rest. A single bad numeral in
 * one strength should not cost the reader the whole analysis.
 */
export function pruneSynthesis(
  synthesis: Synthesis,
  problems: SynthesisProblem[]
): { kept: Synthesis; dropped: string[] } {
  const bad = new Set(problems.map((p) => p.field));
  const dropped: string[] = [];
  const keepList = <T>(arr: T[], prefix: string) =>
    arr.filter((_, i) => {
      if (bad.has(`${prefix}[${i}]`)) {
        dropped.push(`${prefix}[${i}]`);
        return false;
      }
      return true;
    });

  const kept: Synthesis = {
    standing: bad.has('standing') ? '' : synthesis.standing,
    strengths: keepList(synthesis.strengths, 'strengths'),
    weaknesses: keepList(synthesis.weaknesses, 'weaknesses'),
    categoryTrend: bad.has('categoryTrend')
      ? { point: '', claimIds: [] }
      : synthesis.categoryTrend,
    peerPattern: bad.has('peerPattern') ? { point: '', claimIds: [] } : synthesis.peerPattern,
    considerations: keepList(synthesis.considerations, 'considerations'),
  };
  if (bad.has('standing')) dropped.push('standing');
  if (bad.has('categoryTrend')) dropped.push('categoryTrend');
  if (bad.has('peerPattern')) dropped.push('peerPattern');
  return { kept, dropped };
}

/* -- the prompt ---------------------------------------------------------- */

export interface ComputedFacts {
  pagesCrawled: number;
  peersIdentified: number;
  peersWithDatedAiEvidence: number;
  observedClaims: number;
  comparativeClaims: number;
  [k: string]: number | string | string[];
}

export function computeFacts(
  claims: Claim[],
  subject: SubjectArtifact,
  peers: PeersArtifact | null,
  evidence: PeerEvidenceArtifact | null
): ComputedFacts {
  return {
    pagesCrawled: subject.pagesCrawled,
    peersIdentified: peers?.peers.length ?? 0,
    peersWithDatedAiEvidence: evidence?.peersWithDatedAiEvidence ?? 0,
    observedClaims: claims.filter((c) => c.tier === 'observed').length,
    comparativeClaims: claims.filter((c) => c.tier === 'comparative').length,
    categoriesMissing: subject.categoriesMissing,
    peerNames: (peers?.peers ?? []).map((p) => p.name),
  };
}

export const SYSTEM_PROMPT = `You are a principal consultant at a design-led AI product studio, writing the analysis section of a free diagnostic report for a prospective client. The report goes to an operator — a COO, a VP of Operations, a founder — not to a technologist.

Your job is to tell them what is happening and what it means. The report already lists the evidence; repeating it is worthless. Answer the questions they actually have:

- Where do we stand?
- What is happening in our category, and which way is it moving?
- What have companies like us done, and did it work?
- Where are we strong, and where are we exposed?
- What should we be weighing?

HARD RULES, in order of importance.

1. You may not introduce any number that is not either (a) present in the text of a claim you cite by id, or (b) listed in the COMPUTED FACTS block. There are no exceptions and no "approximately". A sentence with an unsupported digit in it is deleted before the client sees it, so it is wasted work. When you want to say how many of something, use the counts in COMPUTED FACTS.

2. Cite claim ids for every point in strengths, weaknesses, categoryTrend and peerPattern. A point you cannot tie to a claim is a point you must not make.

3. Never state that something is absent as though it were a finding about the company. Absence of public evidence means we could not see it from outside, not that it does not exist. Write "we could not see X from the outside" — never "you have no X".

4. Do not mention hiring, job titles, or careers pages in your output. Those are research signals about which workflow is under strain; quoting a client's own job adverts back to them reads as filler. Use them to inform what you say about operations; do not surface them.

5. Where the evidence does not support a conclusion, say so plainly and briefly. An honest "we cannot tell from here, and here is what would settle it" is worth more than a confident guess, and it is the part of this report the client will remember.

6. Write about the market, not about our research process. "We could not see your queue from outside" is useful to the reader. "Two peers surfaced evidence and one was mis-attributed" is a note about our own pipeline and means nothing to them — state the conclusion (only one comparable company has a public, dated initiative) and leave the bookkeeping out.

VOICE. Address the reader as "you". Short sentences. Concrete nouns. No consultant register — no "leverage", "unlock", "journey", "landscape", "in today's rapidly evolving". Do not open with a summary of what the report contains. Never flatter. If their position is weak, say it once, plainly, without softening it into a compliment.`;

export function buildUserPrompt(
  company: string,
  domain: string,
  claims: Claim[],
  facts: ComputedFacts
): string {
  const lines = claims.map((c) => {
    const bits = [
      `id=${c.id}`,
      `tier=${c.tier}`,
      `angle=${c.angle}`,
      c.peerName ? `peer=${c.peerName}` : null,
      c.observedAt ? `dated=${c.observedAt}` : null,
    ].filter(Boolean);
    return `- [${bits.join(' ')}] ${c.statement}`;
  });

  return `COMPANY: ${company} (${domain})

COMPUTED FACTS — you may state these figures freely:
${JSON.stringify(facts, null, 2)}

VALIDATED CLAIMS — the only evidence you have. Every one is sourced. Cite by id.
${lines.join('\n')}

Write the analysis. Remember: no numeral that is not above, cite ids for every backed point, and nothing about hiring.`;
}

/* -- the stage ----------------------------------------------------------- */

export interface SynthesisArtifact {
  model: string;
  synthesizedAt: string;
  synthesis: Synthesis;
  /** Blocks the validator removed, and why. The audit trail for the rule. */
  droppedBlocks: string[];
  problems: SynthesisProblem[];
  facts: ComputedFacts;
  notes: string[];
}

export async function runSynthesisStage(
  cache: CacheOptions,
  ledger: Ledger,
  args: {
    company: string;
    claims: Claim[];
    subject: SubjectArtifact;
    peers: PeersArtifact | null;
    evidence: PeerEvidenceArtifact | null;
  },
  now: string,
  opts: { model?: string } = {}
): Promise<SynthesisArtifact> {
  const notes: string[] = [];
  const model = opts.model ?? process.env.EXPOSURE_SYNTHESIS_MODEL ?? DEFAULT_MODEL;
  const facts = computeFacts(args.claims, args.subject, args.peers, args.evidence);
  const userPrompt = buildUserPrompt(args.company, args.subject.domain, args.claims, facts);

  const request = { model, system: SYSTEM_PROMPT, user: userPrompt };

  const { response, hit } = await cached<{
    synthesis: Synthesis;
    usage: { input: number; output: number };
  }>(cache, 'anthropic-synthesis', request, now, async () => {
    ledger.assertHeadroom(`anthropic synthesis ${model}`, 0.25);
    const client = new Anthropic({ apiKey: requireCredential('ANTHROPIC_API_KEY') });
    const message = await client.messages.parse({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(SynthesisSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    if (!message.parsed_output) {
      throw new Error(`synthesis returned no parseable output (stop_reason ${message.stop_reason})`);
    }
    return {
      synthesis: message.parsed_output,
      usage: {
        input: message.usage.input_tokens ?? 0,
        output: message.usage.output_tokens ?? 0,
      },
    };
  });

  if (hit) {
    ledger.free('anthropic', `synthesis ${model}`);
  } else {
    /* Opus 5 list price, 2026-06-24: $5/MTok in, $25/MTok out. The API does not
       return a dollar figure, so this is the one model cost that is computed
       from a rate and therefore labelled an estimate, like Firecrawl. */
    const usd = (response.usage.input / 1e6) * 5 + (response.usage.output / 1e6) * 25;
    ledger.record({
      service: 'anthropic',
      operation: `synthesis ${model}`,
      usd,
      basis: 'estimated',
      cached: false,
      note: `${response.usage.input} in / ${response.usage.output} out at $5/$25 per MTok (list)`,
    });
  }

  const problems = validateSynthesis(response.synthesis, args.claims, facts);
  const { kept, dropped } = pruneSynthesis(response.synthesis, problems);

  if (problems.length > 0) {
    notes.push(
      `${problems.length} synthesis problem(s), ${dropped.length} block(s) dropped: ` +
        problems.map((p) => `${p.field} ${p.code}`).join('; ')
    );
  }

  return {
    model,
    synthesizedAt: now,
    synthesis: kept,
    droppedBlocks: dropped,
    problems,
    facts,
    notes,
  };
}
