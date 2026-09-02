/* ---------------------------------------------------------------------------
   Stage 07 — the one thing.

   WHAT THE OFFER BECAME. After the 45-minute call, the lead gets one written
   recommendation: the one thing we would build first, why now, what we would
   refuse to build, and what we could not see from outside. Shown against the
   two or three other builds we weighed, so the choice can be argued with. The
   multi-section brief that stage 06 feeds is still generated, and it is still
   the evidence, but the deliverable is this: a short email that says "build
   this", and a research report behind it that a reviewer can check line by
   line before either leaves the building.

   WHY A SEPARATE STAGE rather than a field on stage 06. Stage 06 produces the
   field of ideas, the questions and the peer signal. Choosing among them is a
   different act with a different failure mode: it has to be *decisive* (one
   thing, named as a build), *specific* (something a design-led product studio
   could scope on Monday), *defended* (every figure traced to a claim), and
   *honest about the fork* (the one unknown that would change the advice). Two
   specimens written by hand set the shape — BetterRX (delivery-time prediction
   in the order screen) and Cultivate Advisors (an advisor-facing memory over
   their own engagements) — and this stage exists to produce that shape from
   the pipeline's evidence rather than from a session with a person in it.

   THE FORK TEST. A recommendation only counts if resolving the key unknown
   the other way would change the advice. If both branches yield the same
   advice, the unknown is not a fork and should not be presented as one; if the
   advice would not change under any answer, it is not a recommendation, it is
   a platitude.

   NUMERALS. Same rule as stage 06, applied harder. Every digit in every field
   must trace to a cited claim or a computed fact. There is no sizing block
   here and no declared-assumption escape hatch: the email is short enough
   that a figure we chose would read as a finding. A draft that trips the check
   gets one retry with the problems spelled out; whatever is still unsourced
   after that is REDACTED to a visible marker rather than rendered, so the
   reviewer sees the hole instead of a number we cannot stand behind.

   The model sees only validated claims, the stage-06 analysis (itself
   validated), the non-citable industry brief, and what the lead typed. It
   never sees raw pages.
--------------------------------------------------------------------------- */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import type { Claim } from '../lib/claim.ts';
import type { Ledger } from '../lib/budget.ts';
import { cached, type CacheOptions } from '../lib/cache.ts';
import { requireCredential } from '../lib/env.ts';
import { checkVoice, describeFlags, type VoiceFlag } from '../lib/voice.ts';
import {
  DEFAULT_MODEL,
  SYSTEM_PROMPT as ANALYST_VOICE,
  stripClaimIds,
  allowedFigures,
  type ComputedFacts,
  type Synthesis,
} from './06-synthesis.ts';

/* -- output shape -------------------------------------------------------- */

/**
 * One candidate build. Three or four of these are generated and one is
 * picked, so the reader sees the field the choice was made from and can
 * disagree with the choice rather than with the whole exercise.
 */
const IdeaSchema = z.object({
  headline: z
    .string()
    .describe(
      'The build, named as a thing, in at most twelve words. "Delivery-time prediction in the order screen." Never a category ("AI for operations").'
    ),
  build: z
    .string()
    .describe(
      'What we would build, in two or three sentences: who uses it, at what moment, what it shows or does, what it replaces. Concrete enough that a product studio could scope it on Monday.'
    ),
  whyNow: z
    .string()
    .describe(
      'Two to four sentences. The evidence that makes this worth doing, and why this year. Cite claim ids inline in parentheses after the sentence they support.'
    ),
  feasibility: z
    .string()
    .describe(
      'One or two sentences. What a small design-led product studio would actually ship inside one engagement, and which of their systems it has to touch. No figures unless a cited claim carries them.'
    ),
  risk: z
    .string()
    .describe('One or two sentences. What would make this the wrong build: the assumption it rests on, or who would abandon it.'),
  claimIds: z.array(z.string()).describe('The evidence this idea rests on. At least one.'),
});

const RefuseSchema = z.object({
  what: z.string().describe('The tempting build we would turn down, named as a thing. One line.'),
  why: z
    .string()
    .describe(
      'Two or three sentences. Why it is tempting, and why it is wrong for them specifically. Cite claim ids where the reason rests on evidence.'
    ),
  claimIds: z.array(z.string()).describe('May be empty if the reason is structural rather than evidential.'),
});

export const OneThingSchema = z.object({
  ideas: z
    .array(IdeaSchema)
    .describe(
      'Three or four candidate builds, genuinely different from one another: different user, different moment, or different mechanism. Not one idea in three sizes.'
    ),
  pick: z.object({
    index: z.number().int().describe('Zero-based index into `ideas` of the one we recommend.'),
    why: z
      .string()
      .describe(
        'Three to five sentences. Why this one over the others, naming the others and saying what each loses on: weaker evidence, harder to ship in one engagement, buyable from a vendor, or risk to what they sell. Cite claim ids where the comparison rests on evidence.'
      ),
  }),
  whyUs: z
    .string()
    .describe(
      'One or two sentences on why the recommended build is interface and workflow judgement rather than a model or a data contract: who has to use it, under what pressure, and what they will abandon.'
    ),
  firstStep: z
    .string()
    .describe(
      'What the first two weeks of the engagement would actually be, for the recommended build. One to three sentences. Usually a boring prerequisite: a data path, an instrumented step, a plain baseline before anything called AI.'
    ),
  refuse: RefuseSchema,
  couldNotSee: z
    .string()
    .describe(
      'The one thing we could not determine from outside that changes the sequencing of the recommended build, and how the plan differs under each answer. Two to four sentences. This is the fork; both branches must be stated.'
    ),
  email: z.object({
    subject: z.string().describe('Under sixty characters. Names the build or the company, never "AI".'),
    body: z
      .string()
      .describe(
        'The email to the lead, 260 to 380 words, written by a principal who did the research. Opens with the recommendation, not with thanks. Then one paragraph naming the other ideas weighed and why this one won. Then what we would refuse. Paragraphs separated by blank lines. Cite claim ids inline in parentheses after the sentence they support; they become footnotes. Ends by naming the one question the call should settle. No sign-off line; it is added by the sender.'
      ),
  }),
});

export type OneThing = z.infer<typeof OneThingSchema>;
export type Idea = z.infer<typeof IdeaSchema>;

/** The recommended idea. Clamped, so a bad index can never throw in a renderer. */
export function chosen(x: OneThing): Idea {
  const i = Math.min(Math.max(0, x.pick.index | 0), x.ideas.length - 1);
  return x.ideas[i];
}

/* -- validation ---------------------------------------------------------- */

export interface OneThingProblem {
  field: string;
  code: 'unsourced_numeral' | 'unknown_claim_id' | 'no_evidence' | 'too_long' | 'too_short' | 'too_few_ideas' | 'bad_pick';
  detail: string;
}

/** Digits in prose, after citation references have been removed. */
export function numeralsIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*%?/g) ?? []).map((n) => n.replace(/[.,]$/, ''));
}

/** Round numbers that carry no claim — ordinals, halves, the two weeks. */
const HARMLESS = new Set(['1', '2', '3', '4', '5', '10', '12', '24', '45', '50', '100']);

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Every reader-facing string, keyed by a path the redactor can write back to. */
export function proseFields(x: OneThing): [string, string][] {
  const out: [string, string][] = [];
  x.ideas.forEach((idea, i) => {
    out.push([`ideas[${i}].headline`, idea.headline]);
    out.push([`ideas[${i}].build`, idea.build]);
    out.push([`ideas[${i}].whyNow`, idea.whyNow]);
    out.push([`ideas[${i}].feasibility`, idea.feasibility]);
    out.push([`ideas[${i}].risk`, idea.risk]);
  });
  out.push(['pick.why', x.pick.why]);
  out.push(['whyUs', x.whyUs]);
  out.push(['firstStep', x.firstStep]);
  out.push(['refuse.what', x.refuse.what]);
  out.push(['refuse.why', x.refuse.why]);
  out.push(['couldNotSee', x.couldNotSee]);
  out.push(['email.subject', x.email.subject]);
  out.push(['email.body', x.email.body]);
  return out;
}

/**
 * Every numeral anywhere must be in a claim cited somewhere in this document
 * or in a computed fact. The citation set is the union over the ideas and the
 * refusal, because the pick compares ideas and the email spans them. An id
 * that does not exist is a problem in itself.
 */
export function validateOneThing(x: OneThing, claims: Claim[], facts: ComputedFacts): OneThingProblem[] {
  const problems: OneThingProblem[] = [];
  const byId = new Map(claims.map((c) => [c.id, c]));
  const ids = claims.map((c) => c.id);
  const allowed = allowedFigures(facts);
  const p = (field: string, code: OneThingProblem['code'], detail: string) =>
    problems.push({ field, code, detail });

  if (x.ideas.length < 3) p('ideas', 'too_few_ideas', `${x.ideas.length} idea(s); the reader needs at least three to judge the choice`);
  if (!Number.isInteger(x.pick.index) || x.pick.index < 0 || x.pick.index >= x.ideas.length) {
    p('pick.index', 'bad_pick', `index ${x.pick.index} names no idea`);
  }

  const cited = new Set<string>(x.refuse.claimIds);
  x.ideas.forEach((idea, i) => {
    if (idea.claimIds.length === 0) p(`ideas[${i}].claimIds`, 'no_evidence', 'an idea must rest on at least one claim');
    for (const id of idea.claimIds) cited.add(id);
  });
  const evidence: string[] = [];
  for (const id of cited) {
    const claim = byId.get(id);
    if (!claim) p('claimIds', 'unknown_claim_id', `no claim ${id}`);
    else evidence.push(claim.statement);
  }
  const haystack = evidence.join(' ');

  for (const [field, text] of proseFields(x)) {
    for (const n of numeralsIn(stripClaimIds(text, ids))) {
      const bare = n.replace('%', '');
      if (allowed.has(bare) || HARMLESS.has(bare)) continue;
      if (haystack.includes(bare)) continue;
      p(field, 'unsourced_numeral', `"${n}" is in no cited claim or computed fact`);
    }
  }

  x.ideas.forEach((idea, i) => {
    if (wordCount(idea.headline) > 14) p(`ideas[${i}].headline`, 'too_long', `${wordCount(idea.headline)} words; twelve is the ceiling`);
  });
  const words = wordCount(x.email.body);
  if (words > 450) p('email.body', 'too_long', `${words} words; the email is meant to be read on a phone`);
  if (words < 150) p('email.body', 'too_short', `${words} words; that is a note, not a recommendation`);

  return problems;
}

/**
 * Replace every unsourced numeral with a visible marker.
 *
 * This is the last resort after a retry, and it is a redaction, not a repair:
 * the sentence survives, the figure does not, and the reviewer sees exactly
 * where the model reached for a number it could not source. Dropping the
 * whole sentence would hide the failure; rendering the number would break
 * the one rule this repository actually enforces.
 */
export const REDACTED = '[figure removed: unsourced]';

export function redactUnsourced(x: OneThing, problems: OneThingProblem[]): { redacted: OneThing; count: number } {
  const unsourced = new Map<string, Set<string>>();
  for (const pr of problems) {
    if (pr.code !== 'unsourced_numeral') continue;
    const m = pr.detail.match(/^"([^"]+)"/);
    if (!m) continue;
    if (!unsourced.has(pr.field)) unsourced.set(pr.field, new Set());
    unsourced.get(pr.field)!.add(m[1]);
  }
  let count = 0;
  const scrub = (field: string, text: string): string => {
    const set = unsourced.get(field);
    if (!set) return text;
    let out = text;
    for (const n of [...set].sort((a, b) => b.length - a.length)) {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      /* A figure often comes with a prefix or suffix the sentence needs gone
         too: "$450", "30%", "2,000+". Take the tightly attached symbols with it. */
      const re = new RegExp(`[$€£~]?${escaped}(?![\\d.,])[+%]?`, 'g');
      out = out.replace(re, () => {
        count += 1;
        return REDACTED;
      });
    }
    return out;
  };
  const redacted: OneThing = {
    ...x,
    ideas: x.ideas.map((idea, i) => ({
      ...idea,
      headline: scrub(`ideas[${i}].headline`, idea.headline),
      build: scrub(`ideas[${i}].build`, idea.build),
      whyNow: scrub(`ideas[${i}].whyNow`, idea.whyNow),
      feasibility: scrub(`ideas[${i}].feasibility`, idea.feasibility),
      risk: scrub(`ideas[${i}].risk`, idea.risk),
    })),
    pick: { ...x.pick, why: scrub('pick.why', x.pick.why) },
    whyUs: scrub('whyUs', x.whyUs),
    firstStep: scrub('firstStep', x.firstStep),
    couldNotSee: scrub('couldNotSee', x.couldNotSee),
    refuse: { ...x.refuse, what: scrub('refuse.what', x.refuse.what), why: scrub('refuse.why', x.refuse.why) },
    email: { subject: scrub('email.subject', x.email.subject), body: scrub('email.body', x.email.body) },
  };
  return { redacted, count };
}

/** Every string a reader will see, for the voice check. */
export function oneThingProse(x: OneThing): string {
  return proseFields(x)
    .map(([, text]) => text)
    .filter(Boolean)
    .join('\n');
}

/* -- the prompt ---------------------------------------------------------- */

export const ONE_THING_INSTRUCTIONS = `You have already written the analysis: a read on where they stand, several ideas, the questions, the peer signal. Now do the harder thing. Lay out the real options, then choose.

WHAT YOU ARE WRITING. Two documents that say the same thing at two lengths. A short email to the owner that says: build this, here is what else we weighed and why this won, here is what we would not build, here is the one question that decides the sequencing. And the fields behind it that a research report will carry. Both are read by a colleague first, who will check every sentence against the claim it cites before anything is sent.

THE IDEAS. Three or four candidate builds, and they must be genuinely different: a different user, a different moment in the workflow, or a different mechanism. One idea in three sizes is not three ideas. Each is named as a thing: a screen, a step in a workflow, a record, a prediction shown at a specific moment to a specific person. Not a programme, not a strategy, not "explore". The test for every one: could a small design-led product studio scope it on Monday and have a working surface in front of real users inside one engagement? If not, it is too big. If a vendor already sells it for a monthly fee, say so in its risk line rather than pretending otherwise. Each idea carries its own evidence, its own feasibility line and its own risk line, so the reader can weigh them without you.

Prefer the boring prerequisite over the clever model. Prefer an internal surface the company controls over a client-facing product that changes what they sell. Prefer the thing their own data makes possible and no competitor can buy. If the strongest evidence is a peer's move, the response to it is usually a better idea than a copy of it.

THE PICK. Choose one, and argue it against the others by name. What each loses on: weaker evidence, harder to ship in one engagement, buyable from a vendor, or risk to what they sell. A reader who disagrees with the pick should be able to see exactly which judgement they disagree with. Do not pick the safest idea by default; pick the one the evidence supports best that they could not buy.

WHAT WE WOULD REFUSE. The tempting build. Usually the obvious one everyone will pitch them this year, and usually not one of your ideas. Say why it is wrong for them specifically: the asymmetry, the price war, the risk to what they sell. This is the paragraph most likely to be forwarded internally, so make it plain.

THE FORK. For the recommended build, name the one thing you could not determine from outside that changes the sequencing, and say what the plan is under each answer. Both branches must be stated, and they must differ. If the advice would be the same either way, that unknown is not the fork; find the one that is.

THE EMAIL. 260 to 380 words. Open with the recommendation in the first sentence. Then, in one paragraph, name the other ideas you weighed and say in a clause each why this one won. Then what you would refuse. Written by the person who did the research, to the owner, the way a smart colleague writes. Cite claim ids in parentheses after the sentence they support; they will become numbered footnotes with the source underneath. Close by naming the question the call should settle. Do not thank them for filling in a form. Do not describe our process. Do not mention hiring, job adverts or careers pages. Do not attach a price or a timeline unless a cited claim carries the figure.

NUMERALS. Every digit anywhere in your output must appear in a claim you cite or in the computed facts. There is no assumptions block here. An unsupported digit is redacted before anyone sees it, so it is wasted work. Write "a fraction of the price" if you cannot cite the price.

WHAT THEY TOLD US THEY HAVE TRIED is their words and steers emphasis. If they have already tried the obvious thing, do not recommend it again; say what you would do differently and why.`;

export function buildOneThingPrompt(args: {
  company: string;
  domain: string;
  oneLiner?: string;
  claims: Claim[];
  facts: ComputedFacts;
  synthesis: Synthesis;
  trigger?: string;
  industryBrief?: string;
}): string {
  const lines = args.claims.map((c) => {
    const bits = [
      `id=${c.id}`,
      `tier=${c.tier}`,
      c.peerName ? `peer=${c.peerName}` : null,
      c.observedAt ? `dated=${c.observedAt}` : null,
    ].filter(Boolean);
    return `- [${bits.join(' ')}] ${c.statement}`;
  });

  const tried = args.trigger?.trim()
    ? `\nWHAT THEY TOLD US THEY HAVE TRIED, AND WHY NOW (their words, not evidence):\n"${args.trigger.trim()}"\n`
    : '';
  const brief = args.industryBrief?.trim()
    ? `\nINDUSTRY CONTEXT we researched separately. Judgement only; NOT citable, so no figure from it may appear in your output:\n${args.industryBrief.trim()}\n`
    : '';

  return `COMPANY: ${args.company} (${args.domain})
${args.oneLiner?.trim() ? `THEY DESCRIBE THEMSELVES AS: ${args.oneLiner.trim()}\n` : ''}${tried}${brief}
COMPUTED FACTS — you may state these figures freely:
${JSON.stringify(args.facts, null, 2)}

THE ANALYSIS YOU ALREADY WROTE (validated; draw your ideas from it, sharpen them, or depart from it if the evidence points elsewhere):
${JSON.stringify(args.synthesis, null, 2)}

VALIDATED CLAIMS — the only evidence. Every one is sourced. Cite by id.
${lines.join('\n')}

${ONE_THING_INSTRUCTIONS}`;
}

/* -- the stage ----------------------------------------------------------- */

export interface OneThingArtifact {
  model: string;
  writtenAt: string;
  oneThing: OneThing;
  /** Problems on the draft that was kept, before redaction. Empty is the goal. */
  problems: OneThingProblem[];
  /** How many figures were redacted after the retry. Zero is the goal. */
  redacted: number;
  attempts: number;
  voiceFlags: VoiceFlag[];
  voiceRepair?: { attempted: boolean; applied: boolean; reason: string };
  notes: string[];
}

async function callModel(
  cache: CacheOptions,
  ledger: Ledger,
  model: string,
  purpose: string,
  userPrompt: string,
  now: string,
  effort: 'high' | 'medium'
): Promise<OneThing> {
  const request = { model, purpose, system: ANALYST_VOICE, user: userPrompt };
  const { response, hit } = await cached<{ oneThing: OneThing; usage: { input: number; output: number } }>(
    cache,
    'anthropic-one-thing',
    request,
    now,
    async () => {
      ledger.assertHeadroom(`anthropic ${purpose} ${model}`, 0.25);
      const client = new Anthropic({ apiKey: requireCredential('ANTHROPIC_API_KEY') });
      const message = await client.messages.parse({
        model,
        max_tokens: 12000,
        thinking: { type: 'adaptive' },
        output_config: { effort, format: zodOutputFormat(OneThingSchema) },
        system: ANALYST_VOICE,
        messages: [{ role: 'user', content: userPrompt }],
      });
      if (!message.parsed_output) {
        throw new Error(`${purpose} returned no parseable output (stop_reason ${message.stop_reason})`);
      }
      return {
        oneThing: message.parsed_output,
        usage: { input: message.usage.input_tokens ?? 0, output: message.usage.output_tokens ?? 0 },
      };
    }
  );
  if (hit) {
    ledger.free('anthropic', `${purpose} ${model}`);
  } else {
    const usd = (response.usage.input / 1e6) * 5 + (response.usage.output / 1e6) * 25;
    ledger.record({
      service: 'anthropic',
      operation: `${purpose} ${model}`,
      usd,
      basis: 'estimated',
      cached: false,
      note: `${response.usage.input} in / ${response.usage.output} out at $5/$25 per MTok (list)`,
    });
  }
  return response.oneThing;
}

export async function runOneThingStage(
  cache: CacheOptions,
  ledger: Ledger,
  args: {
    company: string;
    domain: string;
    oneLiner?: string;
    claims: Claim[];
    facts: ComputedFacts;
    synthesis: Synthesis;
    trigger?: string;
    industryBrief?: string;
  },
  now: string,
  opts: { model?: string } = {}
): Promise<OneThingArtifact> {
  const model = opts.model ?? process.env.EXPOSURE_SYNTHESIS_MODEL ?? DEFAULT_MODEL;
  const notes: string[] = [];
  const base = buildOneThingPrompt(args);

  let draft = await callModel(cache, ledger, model, 'one-thing', base, now, 'high');
  let problems = validateOneThing(draft, args.claims, args.facts);
  let attempts = 1;

  /* One retry, with the problems spelled out. A model told exactly which digit
     has no home usually removes it; a model told nothing repeats itself. */
  if (problems.length > 0) {
    notes.push(`draft 1: ${problems.length} problem(s): ${problems.map((p) => `${p.field} ${p.code}`).join('; ')}`);
    const retry = `${base}

YOUR PREVIOUS DRAFT FAILED VALIDATION. Fix exactly these and change nothing else:
${problems.map((p) => `- ${p.field}: ${p.code} — ${p.detail}`).join('\n')}

PREVIOUS DRAFT:
${JSON.stringify(draft, null, 2)}`;
    try {
      const second = await callModel(cache, ledger, model, 'one-thing-retry', retry, now, 'medium');
      const secondProblems = validateOneThing(second, args.claims, args.facts);
      attempts = 2;
      if (secondProblems.length <= problems.length) {
        draft = second;
        problems = secondProblems;
        notes.push(`draft 2: ${problems.length} problem(s) remain`);
      } else {
        notes.push(`draft 2 was worse (${secondProblems.length} problems); kept draft 1`);
      }
    } catch (error) {
      notes.push(`retry failed: ${(error as Error).message.slice(0, 160)}`);
    }
  }

  /* Whatever is still unsourced is redacted, never rendered. */
  const { redacted, count } = redactUnsourced(draft, problems);
  if (count > 0) notes.push(`${count} figure(s) redacted as unsourced`);
  let final = redacted;

  /* Voice, with one repair attempt that must not cost anything factual. */
  let voiceFlags = checkVoice(oneThingProse(final));
  let voiceRepair: OneThingArtifact['voiceRepair'];
  if (voiceFlags.length > 0) {
    notes.push(`voice check: ${voiceFlags.map((f) => `${f.id} ×${f.count}`).join(', ')} — attempting a rewrite`);
    const instruction = `${base}

Below is the draft you wrote. The prose trips our house style check. Rewrite only the sentences that need it.

WHAT TO FIX:
${describeFlags(voiceFlags)}

WHAT MUST NOT CHANGE: every claim id, every figure, the recommendation itself, the refusal, the fork, and the marker "${REDACTED}" wherever it appears.

DRAFT:
${JSON.stringify(final, null, 2)}`;
    try {
      const repaired = await callModel(cache, ledger, model, 'one-thing-voice', instruction, now, 'medium');
      const repairedProblems = validateOneThing(repaired, args.claims, args.facts);
      const after = checkVoice(oneThingProse(repaired));
      const over = (flags: VoiceFlag[]) => flags.reduce((n, f) => n + f.count - f.budget, 0);
      if (repairedProblems.length > problems.length) {
        voiceRepair = { attempted: true, applied: false, reason: 'rewrite introduced a validation problem; kept the original' };
      } else if (over(after) >= over(voiceFlags)) {
        voiceRepair = { attempted: true, applied: false, reason: `rewrite did not improve the prose (${over(voiceFlags)} -> ${over(after)})` };
      } else if (repaired.ideas.length < 3 || wordCount(repaired.email.body) < 150) {
        voiceRepair = { attempted: true, applied: false, reason: 'rewrite lost content; kept the original' };
      } else {
        final = redactUnsourced(repaired, repairedProblems).redacted;
        voiceFlags = after;
        voiceRepair = { attempted: true, applied: true, reason: `${over(voiceFlags)} over budget after` };
      }
    } catch (error) {
      voiceRepair = { attempted: true, applied: false, reason: `repair call failed: ${(error as Error).message.slice(0, 140)}` };
    }
    notes.push(`voice repair ${voiceRepair.applied ? 'applied' : 'rejected'}: ${voiceRepair.reason}`);
  }

  return {
    model,
    writtenAt: now,
    oneThing: final,
    problems,
    redacted: count,
    attempts,
    voiceFlags,
    voiceRepair,
    notes,
  };
}
