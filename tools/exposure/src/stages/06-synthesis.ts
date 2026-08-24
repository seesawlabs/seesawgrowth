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

/* -- output shape -------------------------------------------------------

   SHAPED LIKE A FIRST CALL, not like a research report. The first version was
   findings-shaped — standing, strengths, weaknesses, trend, considerations —
   and the review was that it "feels very AI generated and fairly generic, and
   too heavy handed on suggestions (that read more like mandates), like it knows
   more than they do and is telling them how things are, vs questions."

   That is a fair reading of what it was. It asserted. A stranger who has read
   your website does not know more about your operation than you do, and writing
   as though they might is both wrong and irritating.

   So the two load-bearing sections are now `questions` and `opportunities`.
   Research is what makes a question sharp rather than something the report
   states in its own right — "they can get straight-up research from anywhere,
   what they can't get is our interpretation of that data and our
   recommendations."
   ------------------------------------------------------------------------ */

/**
 * A figure we chose rather than found.
 *
 * THIS IS THE ONE PLACE THE PIPELINE IS ALLOWED TO PUT A NUMBER IT DID NOT
 * SOURCE, and it exists because refusing to was making the report useless. The
 * old behaviour rendered raw placeholder tokens at the reader —
 * "if that step happens [timesPerMonth1] times a month and takes
 * [minutesEach1] minutes it costs you [hoursPerYear1] hours a year" — which
 * reads, accurately, as "a very strange read". The ask was to instead "make
 * some assumptions and ask whether or not it would make sense to consider
 * applying AI to bring down X by Y% that could save them $W, that we could
 * (even ever so loosely) defend based on the information we have."
 *
 * An assumption is not a fabrication when three things are true, and all three
 * are enforced rather than hoped for:
 *
 *   1. it is labelled as ours, in the document, next to the number;
 *   2. it carries a `basis` — why we picked that value;
 *   3. the arithmetic built on it is shown, so the reader can redo it.
 *
 * And it always ends in a question. A number we chose is an opening bid on the
 * reader's own figure, not a finding — so the rule survives in the form that
 * matters: nothing in this report claims to be measured when it is not.
 */
const AssumptionSchema = z.object({
  label: z.string().describe('What this quantity is, in the reader\'s language.'),
  value: z.string().describe('The figure, digits only, e.g. "200" or "15" or "50".'),
  unit: z.string().describe('e.g. "per month", "minutes each", "%".'),
  basis: z
    .string()
    .describe(
      'Why this value and not another. Cite a claim id, an industry norm, or say plainly that it is a round number chosen to make the arithmetic legible.'
    ),
});

const SizingSchema = z.object({
  assumptions: z.array(AssumptionSchema).describe('The figures you chose. 2-4.'),
  arithmetic: z
    .string()
    .describe(
      'The sum, written out so the reader can check it. Every digit here must appear in an assumption above or in a cited claim.'
    ),
  question: z
    .string()
    .describe('The question that hands the arithmetic back to them. Always ends in a question mark.'),
});

const QuestionSchema = z.object({
  question: z
    .string()
    .describe(
      'What we would actually ask on a first call. Specific to them, answerable in a sentence, and something they may not have been asked before.'
    ),
  why: z
    .string()
    .describe('Why we are asking — the research that makes this question worth their time. One or two sentences.'),
  claimIds: z.array(z.string()).describe('The evidence behind the question. At least one.'),
  whatItChanges: z
    .string()
    .describe('What our recommendation would depend on, depending how they answer. One sentence.'),
});

const OpportunitySchema = z.object({
  heading: z.string().describe('The thing itself, named as a thing you could build or do.'),
  body: z.string().describe('What it is and how it would work, in two or three sentences.'),
  basis: z
    .string()
    .describe('Why we think this applies to them specifically, from the evidence. One or two sentences.'),
  claimIds: z.array(z.string()).describe('At least one.'),
  sizing: SizingSchema.nullable().describe(
    'A loosely defended order of magnitude, or null when the evidence will not support even a rough one. Null is an acceptable and honest answer.'
  ),
});

const SynthesisSchema = z.object({
  standing: z
    .string()
    .describe(
      'Two or three sentences on what we think is going on. Written to the reader as "you", and hedged where we are inferring.'
    ),
  questions: z
    .array(QuestionSchema)
    .describe('The questions that would sharpen the ideas above. 4-5.'),
  opportunities: z
    .array(OpportunitySchema)
    .describe('The ideas. Three is the target; four only if the fourth genuinely earns it.'),
  competitorSignal: z
    .object({
      point: z.string().describe('What comparable companies have actually done, and whether it worked.'),
      claimIds: z.array(z.string()),
    })
    .describe('Compressed. The evidence appendix carries the detail.'),
  blindSpots: z
    .array(z.string())
    .describe('Where this report is most likely to be wrong, in their words not ours. 2-4.'),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;
export type Sizing = z.infer<typeof SizingSchema>;

/* -- validation ---------------------------------------------------------- */

export interface SynthesisProblem {
  field: string;
  code: 'unsourced_numeral' | 'unknown_claim_id' | 'no_evidence' | 'assumption_without_basis';
  detail: string;
}

/**
 * Claim ids contain digits — `obs-manual-1`, `cmp-1`, `dem-trend-2` — and the
 * model cites them inline as well as in the `claimIds` field. Left in, the
 * numeral check reads every citation as an unsourced figure: the first live run
 * dropped the entire `standing` paragraph and all four considerations over the
 * "1" in "(obs-manual-1)". Strip the references before counting digits.
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
 * Figures the model may state freely: the counts we computed and handed it.
 */
export function allowedFigures(facts: ComputedFacts): Set<string> {
  const out = new Set<string>();
  for (const v of Object.values(facts)) {
    if (typeof v === 'number') out.add(String(v));
  }
  return out;
}

/** Round numbers that carry no claim — ordinals, halves, percentages of a half. */
const HARMLESS = new Set(['1', '2', '3', '4', '5', '10', '12', '24', '50', '100']);

export function validateSynthesis(
  synthesis: Synthesis,
  claims: Claim[],
  facts: ComputedFacts
): SynthesisProblem[] {
  const problems: SynthesisProblem[] = [];
  const byId = new Map(claims.map((c) => [c.id, c]));
  const allowed = allowedFigures(facts);
  const ids = claims.map((c) => c.id);
  const globalHaystack = claims.map((c) => c.statement).join(' ');

  const p = (field: string, code: SynthesisProblem['code'], detail: string) =>
    problems.push({ field, code, detail });

  /** Numerals must trace to the cited claims, the computed facts, or `extra`. */
  const checkNumerals = (field: string, text: string, cited: string[], extra = '') => {
    const evidence: string[] = [];
    for (const id of cited) {
      const claim = byId.get(id);
      if (!claim) p(field, 'unknown_claim_id', `no claim ${id}`);
      else evidence.push(claim.statement);
    }
    const haystack = `${evidence.join(' ')} ${extra}`;
    for (const n of numeralsIn(stripClaimIds(text, ids))) {
      const bare = n.replace('%', '');
      if (allowed.has(bare) || HARMLESS.has(bare)) continue;
      if (haystack.includes(bare)) continue;
      p(field, 'unsourced_numeral', `"${n}" is in no cited claim, assumption, or supplied figure`);
    }
  };

  /** Qualitative prose may reference any figure that appears in some claim. */
  const qualitative = (field: string, text: string) => {
    for (const n of numeralsIn(stripClaimIds(text, ids))) {
      const bare = n.replace('%', '');
      if (allowed.has(bare) || HARMLESS.has(bare)) continue;
      if (globalHaystack.includes(bare)) continue;
      p(field, 'unsourced_numeral', `"${n}" appears in no validated claim`);
    }
  };

  qualitative('standing', synthesis.standing);
  synthesis.blindSpots.forEach((b, i) => qualitative(`blindSpots[${i}]`, b));

  synthesis.questions.forEach((q, i) => {
    const field = `questions[${i}]`;
    if (q.claimIds.length === 0) p(field, 'no_evidence', 'a question must rest on something');
    checkNumerals(field, `${q.question} ${q.why} ${q.whatItChanges}`, q.claimIds);
  });

  synthesis.opportunities.forEach((o, i) => {
    const field = `opportunities[${i}]`;
    if (o.claimIds.length === 0) p(field, 'no_evidence', 'a recommendation must rest on something');

    /* The declared assumptions are what the sizing arithmetic is allowed to use.
       An assumption without a basis is just a guess with extra steps, so it is
       rejected rather than rendered. */
    let assumed = '';
    if (o.sizing) {
      /**
       * ARITHMETIC IS NOT NUMERAL-CHECKED, and this is the correction to a rule
       * that was eating the thing it existed to allow.
       *
       * Checking every digit in `arithmetic` against the assumptions and claims
       * looked like the same discipline applied one level deeper. It is not:
       * arithmetic *produces* figures that are in neither. "500 clients × 20%
       * churn = 100 lost a year" has a 100 in it that no assumption declares,
       * because deriving it is the entire point. On the Cultivate Advisors run
       * that rule rejected three of four sizings and then all three, leaving the
       * document with no order-of-magnitude anywhere — the exact content the
       * sizing block was added to carry.
       *
       * What makes a sizing honest is structural rather than lexical: its inputs
       * are declared, each input states a basis, the working is shown in full,
       * and it closes by asking the reader whether the magnitude is right. A
       * reader can audit that. So we enforce the structure — at least two
       * declared assumptions, every one with a basis — and let the sum be a sum.
       *
       * The strict check still applies to `heading`, `body` and `basis`, where a
       * figure would read as a finding rather than as our working.
       */
      if (o.sizing.assumptions.length < 2) {
        p(
          `${field}.sizing`,
          'assumption_without_basis',
          `arithmetic on ${o.sizing.assumptions.length} declared assumption(s) — show your inputs`
        );
      }
      o.sizing.assumptions.forEach((a, j) => {
        if (!a.basis?.trim()) {
          p(`${field}.sizing.assumptions[${j}]`, 'assumption_without_basis', `"${a.label}" states no basis`);
        }
        if (!/\d/.test(a.value)) {
          p(`${field}.sizing.assumptions[${j}]`, 'assumption_without_basis', `"${a.label}" declares no figure`);
        }
        assumed += ` ${a.value}`;
      });
    }
    checkNumerals(field, `${o.heading} ${o.body} ${o.basis}`, o.claimIds, assumed);
  });

  checkNumerals('competitorSignal', synthesis.competitorSignal.point, synthesis.competitorSignal.claimIds);
  if (synthesis.competitorSignal.claimIds.length === 0) {
    p('competitorSignal', 'no_evidence', 'cites no claim');
  }

  return problems;
}

/**
 * Remove only the blocks that failed, keeping the rest. One bad numeral in one
 * recommendation should not cost the reader the whole analysis. A failed
 * `sizing` drops the sizing, not the recommendation it belonged to.
 */
export function pruneSynthesis(
  synthesis: Synthesis,
  problems: SynthesisProblem[]
): { kept: Synthesis; dropped: string[] } {
  const bad = new Set(problems.map((x) => x.field));
  const dropped: string[] = [];
  const failed = (prefix: string) => [...bad].some((f) => f === prefix || f.startsWith(`${prefix}.`));

  const keepList = <T>(arr: T[], prefix: string) =>
    arr.filter((_, i) => {
      if (failed(`${prefix}[${i}]`)) {
        dropped.push(`${prefix}[${i}]`);
        return false;
      }
      return true;
    });

  /* An opportunity survives its own sizing failing — the recommendation is the
     valuable part and the arithmetic is the garnish. */
  const opportunities = synthesis.opportunities
    .map((o, i) => {
      const base = `opportunities[${i}]`;
      if (bad.has(base)) return null;
      if (failed(`${base}.sizing`)) {
        dropped.push(`${base}.sizing`);
        return { ...o, sizing: null };
      }
      return o;
    })
    .filter((o): o is Synthesis['opportunities'][number] => o !== null);
  synthesis.opportunities.forEach((_, i) => {
    if (bad.has(`opportunities[${i}]`)) dropped.push(`opportunities[${i}]`);
  });

  if (bad.has('standing')) dropped.push('standing');
  if (failed('competitorSignal')) dropped.push('competitorSignal');

  return {
    kept: {
      standing: bad.has('standing') ? '' : synthesis.standing,
      questions: keepList(synthesis.questions, 'questions'),
      opportunities,
      competitorSignal: failed('competitorSignal')
        ? { point: '', claimIds: [] }
        : synthesis.competitorSignal,
      blindSpots: keepList(synthesis.blindSpots, 'blindSpots'),
    },
    dropped,
  };
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

export const SYSTEM_PROMPT = `You are a principal at a design-led AI product studio, preparing for a first call with a company that asked us for a free read on where they stand. You have done the research. Now write the document you would want to walk them through.

WHAT THIS DOCUMENT IS. Free consulting, in the shape of a first call. Not a research report — generic industry research is something they could produce themselves with any model and a prompt, and reciting findings back to them is worth nothing. What they cannot get elsewhere is our interpretation.

So the centre of this document is a small number of specific, non-obvious ideas for their business in the age of AI — things they may not have thought of, that we would actually build. Three is the target: enough to prove we understand their operation, few enough that each one earns its place. The questions exist to sharpen those ideas and to give them the sense that the next hour would be worth having. It should leave them wanting more, which means being genuinely useful now rather than withholding.

ASK, DO NOT TELL. You have read their website. That is all. You do not know how their operation actually works, what they have already tried, or what they decided against and why — and writing as though you do is both wrong and irritating to read. Every conclusion you reach from outside is provisional. Phrase it that way, and then ask.

  wrong   "Prior authorization is the one to price first."
  right   "Is prior authorization actually where the time goes, or does it just
           look that way from outside because you talk about it most?"

  wrong   "You should automate document intake."
  right   "You already collect documents digitally through the portal. Have you
           looked at what happens to them after that — is a person still reading
           each one?"

A good question is specific to them, answerable in a sentence, and something nobody has asked them before. Bad questions are generic ("what are your AI goals?") or rhetorical (a recommendation with a question mark stapled on).

RECOMMEND REAL THINGS. Each opportunity must be concrete enough to scope: a thing to build, a workflow to change, a decision to make in a specific order. Not "explore AI in operations". If we would not know how to start it on Monday, it is too vague to include.

The best ideas here are usually not "add AI to X". They are the unglamorous prerequisite nobody has sequenced ("fix the data path before building anything called AI"), the cheap test that avoids a big build ("run the dumb regression first and see if a model is even needed"), or the small piece of durable state that removes a whole category of manual work. Prefer those. An idea they have obviously already had is a wasted slot.

NUMBERS, AND THE ONE PLACE YOU MAY CHOOSE ONE.

Everywhere except a \`sizing\` block, every digit you write must appear in a claim you cite or in the COMPUTED FACTS. No exceptions and no "approximately" — an unsupported digit is deleted before the client sees it, so it is wasted work.

Inside a \`sizing\` block you may choose figures, because a rough order of magnitude they can argue with beats a blank they have to fill in. The rules there:

  - EVERY figure that appears in \`arithmetic\` or \`question\` must first be declared in \`assumptions\`. This includes figures you took from the industry context — declare them, with a basis naming where they came from. A number in the arithmetic that is not in the assumptions list is deleted, and it takes the whole sizing with it, so declaring is the difference between a defensible estimate and nothing at all.
  - A real \`basis\` is required. "A round number chosen to keep the arithmetic legible" is honest. "From the industry research: typical advisory books run 20-25% annual churn" is honest. "Industry standard" on its own is not.
  - Prefer round, obviously-illustrative numbers. 500 and 20% invite correction; 487 and 21.3% pretend to a precision you do not have.
  - Show the sum in \`arithmetic\` so they can redo it, and keep it to arithmetic a reader can follow in their head.
  - End with \`question\` handing it back — is that the right order of magnitude, and is it worth the effort?
  - If the evidence will not support even a rough sizing, set \`sizing\` to null. That is a real answer, not a failure.

OUTSIDE a sizing block — in questions, in \`standing\`, in \`blindSpots\` — you have no assumptions list to declare into, so a figure from the industry context cannot be used at all. Say it qualitatively instead: "millions of US small businesses", not a count you cannot cite.

NEVER say a company lacks something because we could not find it. Absence of public evidence means we could not see it from outside. Write "we could not see X" and never "you have no X".

DO NOT mention hiring, job titles, or careers pages. Those are research signals about which workflow is under strain; quoting a client's job adverts back at them reads as filler.

DO NOT describe our research process, its limits as a system, or what our tooling did or failed to do. The reader cares about their business.

VOICE. Address them as "you". Short sentences, concrete nouns. No consultant register — no "leverage", "unlock", "journey", "landscape", "rapidly evolving". Do not open by summarising what the document contains. Never flatter, and never soften a weak position into a compliment. If you are inferring, say so in the sentence rather than in a disclaimer at the end.`;

export function buildUserPrompt(
  company: string,
  domain: string,
  claims: Claim[],
  facts: ComputedFacts,
  trigger?: string,
  industryBrief?: string
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

  /* What they said is driving this. One line from the intake form, and the only
     thing in the prompt that did not come from our own research — so it is
     labelled as their words and the model is told not to treat it as evidence.
     It steers emphasis, not conclusions. */
  const context = trigger?.trim()
    ? `\nWHAT THEY TOLD US IS DRIVING THIS (their words, not evidence — use it to decide what to lead with, never as a fact to assert):\n"${trigger.trim()}"\n`
    : '';

  const brief = industryBrief?.trim()
    ? `\nINDUSTRY CONTEXT we researched separately. Use it for judgement and for phrasing questions; it is NOT citable evidence, so no figure from it may appear in your output:\n${industryBrief.trim()}\n`
    : '';

  return `COMPANY: ${company} (${domain})
${context}${brief}
COMPUTED FACTS — you may state these figures freely:
${JSON.stringify(facts, null, 2)}

VALIDATED CLAIMS — the only evidence you have. Every one is sourced. Cite by id.
${lines.join('\n')}

Write the analysis. Remember: no numeral that is not above, cite ids for every backed point, and nothing about hiring.`;
}

/* -- industry research --------------------------------------------------- */

/**
 * A separate, wider research pass before the analysis.
 *
 * The pipeline's own research is narrow by design: this company's pages, these
 * peers' announcements, these search volumes. It is enough to be *sourced* and
 * not always enough to be *useful* — the review that prompted this stage said
 * the output read as "market research or industry research" when what was
 * wanted was "identifying real things to consider doing/building/launching",
 * and you cannot recommend building something without knowing what is already
 * being built in that industry.
 *
 * So this call gets web search and no schema, and its job is judgement rather
 * than evidence. Its output is explicitly NOT citable: the prompt says so and
 * `validateSynthesis` enforces it, because a figure from an open web search has
 * not been through the citation gates and must not reach the document. What it
 * legitimately buys us is a sharper question and a recommendation that is not
 * naive about the industry.
 *
 * Two calls rather than one because structured output and server-side tools are
 * an awkward pair, and because a research step whose result is cached separately
 * can be reused while the analysis prompt is still being tuned.
 */
export async function runIndustryResearch(
  cache: CacheOptions,
  ledger: Ledger,
  args: { company: string; domain: string; oneLiner: string; claims: Claim[] },
  now: string,
  opts: { model?: string; maxUses?: number } = {}
): Promise<{ brief: string; model: string; searches: number }> {
  const model = opts.model ?? process.env.EXPOSURE_RESEARCH_MODEL ?? DEFAULT_MODEL;

  const prompt = `We are preparing for a first call with ${args.company} (${args.domain}).

They describe themselves as: ${args.oneLiner}

Research their industry so that we can ask them sharp questions and recommend concrete things worth building. Use web search. Specifically find out:

1. What operational work in this kind of business is currently being automated or handled with AI, by anyone — vendors, competitors, adjacent industries. Name products and companies where you can.
2. What the known hard parts are: where projects in this space typically stall, and what the failure modes are.
3. What a business like this one plausibly runs on — the systems, the manual handoffs, the seasonal or volume pressures. Say when you are inferring.
4. What is genuinely new in the last year or two that someone in this industry might not have noticed yet.
5. What you would want to ask an owner of a business like this that they probably have not been asked.

Write a briefing for a colleague, not a report for a client: dense, specific, no preamble, and blunt about what you are unsure of. Where a figure matters, say where it came from — we will not be quoting your numbers, only your judgement.`;

  const request = { model, purpose: 'industry-research', prompt };

  const { response, hit } = await cached<{
    brief: string;
    usage: { input: number; output: number };
    searches: number;
  }>(cache, 'anthropic-research', request, now, async () => {
    ledger.assertHeadroom(`anthropic research ${model}`, 0.4);
    const client = new Anthropic({ apiKey: requireCredential('ANTHROPIC_API_KEY') });
    const message = await client.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: opts.maxUses ?? 12,
        } as unknown as Anthropic.ToolUnion,
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    const brief = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n\n')
      .trim();

    const searches = message.content.filter((b) => b.type === 'web_search_tool_result').length;

    return {
      brief,
      searches,
      usage: {
        input: message.usage.input_tokens ?? 0,
        output: message.usage.output_tokens ?? 0,
      },
    };
  });

  if (hit) {
    ledger.free('anthropic', `research ${model}`);
  } else {
    const usd = (response.usage.input / 1e6) * 5 + (response.usage.output / 1e6) * 25;
    ledger.record({
      service: 'anthropic',
      operation: `research ${model}`,
      usd,
      basis: 'estimated',
      cached: false,
      note:
        `${response.usage.input} in / ${response.usage.output} out at $5/$25 per MTok (list); ` +
        `web search billed separately by Anthropic and not included here`,
    });
  }

  return { brief: response.brief, model, searches: response.searches };
}

/* -- the stage ----------------------------------------------------------- */

export interface SynthesisArtifact {
  model: string;
  synthesizedAt: string;
  /** The wider research pass, kept so a reviewer can see what informed the ask. */
  industryBrief?: string;
  researchModel?: string;
  researchSearches?: number;
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
    /** Free text from the intake form: what's driving this right now. */
    trigger?: string;
    /** Their own one-line description, from intake or derived. */
    oneLiner?: string;
  },
  now: string,
  opts: { model?: string; research?: boolean } = {}
): Promise<SynthesisArtifact> {
  const notes: string[] = [];
  const model = opts.model ?? process.env.EXPOSURE_SYNTHESIS_MODEL ?? DEFAULT_MODEL;
  const facts = computeFacts(args.claims, args.subject, args.peers, args.evidence);

  /* The wider pass first, so the analysis is written by someone who has read
     the industry rather than only this company's pages. */
  let brief: { brief: string; model: string; searches: number } | null = null;
  if (opts.research !== false) {
    try {
      brief = await runIndustryResearch(
        cache,
        ledger,
        {
          company: args.company,
          domain: args.subject.domain,
          oneLiner: args.oneLiner || args.subject.categoryQuery.seedText,
          claims: args.claims,
        },
        now
      );
      notes.push(`industry research: ${brief.searches} web search(es), ${brief.brief.length} chars`);
    } catch (error) {
      notes.push(`industry research failed, continuing without it: ${(error as Error).message.slice(0, 160)}`);
    }
  }

  const userPrompt = buildUserPrompt(
    args.company,
    args.subject.domain,
    args.claims,
    facts,
    args.trigger,
    brief?.brief
  );

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
    industryBrief: brief?.brief,
    researchModel: brief?.model,
    researchSearches: brief?.searches,
    synthesis: kept,
    droppedBlocks: dropped,
    problems,
    facts,
    notes,
  };
}
