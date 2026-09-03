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

   FIVE RULES ADDED 2026-09-02, from the review of the first two specimens:
   the email may cite Verified claims only (lib/claim-status.ts); every peer
   carries a buyer-fit judgement; the fork is a first-class field with a test
   that rejects the "sequencing not destination" hedge; the null verdict is a
   first-class outcome with its own shape; and every cited URL is checked for
   liveness at report time (lib/liveness.ts, wired in the CLI).

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
import { claimStatus, isOutboundSafe } from '../lib/claim-status.ts';
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

/**
 * THE FORK, as a first-class output with a test attached.
 *
 * A fork is the one thing we could not determine from outside whose answer
 * changes what we would build first. It qualifies only if the two branches
 * lead to different first moves. "It changes the sequencing rather than the
 * destination" is the report hedging its own fork and is rejected by
 * `validateOneThing`. If no such question exists, `found` is false and the
 * report says so plainly; that is a better answer than a fake fork.
 */
const ForkSchema = z.object({
  found: z.boolean().describe('True when there is a question whose answer changes the first build. False is an honest answer.'),
  question: z
    .string()
    .describe('The question, as we would ask it on the call. One sentence, answerable by someone inside the business. Empty when found is false.'),
  ifYes: z
    .string()
    .describe('What we would build first if the answer is yes (or the first branch). One or two sentences naming a different build or a different first step from ifNo. Empty when found is false.'),
  ifNo: z
    .string()
    .describe('What we would build first if the answer is no (or the second branch). Must differ from ifYes in what gets built, not just when. Empty when found is false.'),
  whatChanges: z
    .string()
    .describe('One sentence stating concretely what differs between the branches: the build, the user, the system touched. Never "the sequencing" or "the timing" alone. Empty when found is false.'),
  whyNone: z
    .string()
    .describe('When found is false: one or two sentences on why no public unknown changes the recommendation. Empty when found is true.'),
});

/**
 * BUYER FIT, per comparable company. A competitor row that does not say who
 * they sell to lets six shipped products become "your category is being
 * commoditised" when two actually overlap. The overstated threat is what
 * gets us dismissed by an owner who knows his market.
 */
const PeerFitSchema = z.object({
  peer: z.string().describe('The peer name exactly as it appears in the claims.'),
  sellsTo: z.string().describe('Who this company sells to, in one clause: segment, size, buyer role. "unknown" if the evidence does not say.'),
  overlap: z
    .enum(['yes', 'partial', 'no', 'unknown'])
    .describe('Does that buyer overlap the target company’s buyer? yes / partial / no / unknown.'),
  why: z.string().describe('One sentence. Cite claim ids where the judgement rests on evidence; say "from their site name and the industry brief" when it does not.'),
  claimIds: z.array(z.string()).describe('May be empty.'),
});

/**
 * THE NULL PATH. "We researched and found nothing worth a call" is a real
 * outcome and needs a shape as rigorous as the recommendation: what we looked
 * at, what we set aside and why, and the one question we would still ask.
 * Without it the machine structurally cannot say no.
 */
const NullResultSchema = z.object({
  whatWeLookedAt: z
    .string()
    .describe('Two to four sentences. What the evidence covered, from the claims: their site, the peers, the demand data, what they told us.'),
  whatWeSetAside: z
    .array(z.string())
    .describe('Each candidate build we considered and why it does not clear the bar, one sentence each, citing claim ids. At least two.'),
  oneQuestion: z
    .string()
    .describe('The single question we would still want to ask them, because its answer could reopen the verdict. One sentence.'),
});

export const OneThingSchema = z.object({
  verdict: z
    .enum(['recommend', 'nothing_worth_a_call'])
    .describe(
      '"recommend" when one idea clears the bar: evidence behind it, shippable in one engagement, not buyable from a vendor, not something they ruled out. "nothing_worth_a_call" when none does. Choosing the null verdict is rewarded over a weak pick.'
    ),
  ideas: z
    .array(IdeaSchema)
    .describe(
      'Three or four candidate builds, genuinely different from one another: different user, different moment, or different mechanism. Not one idea in three sizes. For the null verdict, the candidates you weighed and set aside; may be fewer.'
    ),
  pick: z.object({
    index: z.number().int().describe('Zero-based index into `ideas` of the one we recommend. 0 and ignored for the null verdict.'),
    why: z
      .string()
      .describe(
        'Three to five sentences. Why this one over the others, naming the others and saying what each loses on: weaker evidence, harder to ship in one engagement, buyable from a vendor, or risk to what they sell. Cite claim ids where the comparison rests on evidence. Empty for the null verdict.'
      ),
  }),
  fork: ForkSchema,
  whyUs: z
    .string()
    .describe(
      'One or two sentences on why the recommended build is interface and workflow judgement rather than a model or a data contract: who has to use it, under what pressure, and what they will abandon. Empty for the null verdict.'
    ),
  firstStep: z
    .string()
    .describe(
      'What the first two weeks of the engagement would actually be, for the recommended build. One to three sentences. Usually a boring prerequisite: a data path, an instrumented step, a plain baseline before anything called AI. Empty for the null verdict.'
    ),
  refuse: RefuseSchema,
  peerFit: z
    .array(PeerFitSchema)
    .describe('One entry for every peer that appears in the claims. Who they sell to and whether that buyer overlaps the target’s.'),
  nullResult: NullResultSchema.nullable().describe('Required for the null verdict; null otherwise.'),
  email: z.object({
    subject: z.string().describe('Under sixty characters. Names the build or the company, never "AI".'),
    body: z
      .string()
      .describe(
        'The email to the lead. For "recommend": 260 to 380 words; opens with the recommendation; one paragraph naming the other ideas weighed and why this one won; what we would refuse; closes with the fork question. For "nothing_worth_a_call": 150 to 260 words; says plainly that we looked and did not find a build worth their money this year, what we looked at, what we set aside, and the one question we would still ask. Paragraphs separated by blank lines. Cite ONLY Verified claims, in parentheses after the sentence they support; they become footnotes. No sign-off line.'
      ),
  }),
});

export type OneThing = z.infer<typeof OneThingSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type Fork = z.infer<typeof ForkSchema>;
export type PeerFit = z.infer<typeof PeerFitSchema>;

export const isNull = (x: OneThing): boolean => x.verdict === 'nothing_worth_a_call';

/** The recommended idea. Clamped, so a bad index can never throw in a renderer. Null verdict: null. */
export function chosen(x: OneThing): Idea | null {
  if (isNull(x) || x.ideas.length === 0) return null;
  const i = Math.min(Math.max(0, x.pick.index | 0), x.ideas.length - 1);
  return x.ideas[i];
}

/* -- validation ---------------------------------------------------------- */

export interface OneThingProblem {
  field: string;
  code:
    | 'unsourced_numeral'
    | 'unknown_claim_id'
    | 'no_evidence'
    | 'too_long'
    | 'too_short'
    | 'too_few_ideas'
    | 'bad_pick'
    | 'fork_missing'
    | 'fork_same_branches'
    | 'fork_hedge'
    | 'non_verified_in_email'
    | 'unknown_peer'
    | 'peer_fit_missing'
    | 'null_incomplete';
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

const ID_GROUP = /\(\s*([a-z0-9._-]+(?:\s*,\s*[a-z0-9._-]+)*)\s*\)/gi;

/** Every known claim id the text cites, parenthesised or loose. */
export function citedIn(text: string, ids: readonly string[]): string[] {
  const known = new Set(ids);
  const found = new Set<string>();
  for (const m of text.matchAll(ID_GROUP)) {
    for (const part of m[1].split(',').map((x) => x.trim())) if (known.has(part)) found.add(part);
  }
  for (const id of known) {
    if (found.has(id)) continue;
    if (new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text)) found.add(id);
  }
  return [...found];
}

/** The hedge the fork test exists to catch. */
const FORK_HEDGE =
  /\b(sequenc\w*|timing|order of operations|when rather than what|rather than the destination|not the destination|same destination)\b/i;

/**
 * Every reader-facing string, keyed by a path, with a setter so the redactor
 * can write back. The list is the single definition of "prose" for
 * validation, redaction and the voice check.
 */
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
  out.push(['fork.question', x.fork.question]);
  out.push(['fork.ifYes', x.fork.ifYes]);
  out.push(['fork.ifNo', x.fork.ifNo]);
  out.push(['fork.whatChanges', x.fork.whatChanges]);
  out.push(['fork.whyNone', x.fork.whyNone]);
  out.push(['whyUs', x.whyUs]);
  out.push(['firstStep', x.firstStep]);
  out.push(['refuse.what', x.refuse.what]);
  out.push(['refuse.why', x.refuse.why]);
  x.peerFit.forEach((f, i) => {
    out.push([`peerFit[${i}].sellsTo`, f.sellsTo]);
    out.push([`peerFit[${i}].why`, f.why]);
  });
  if (x.nullResult) {
    out.push(['nullResult.whatWeLookedAt', x.nullResult.whatWeLookedAt]);
    x.nullResult.whatWeSetAside.forEach((t, i) => out.push([`nullResult.whatWeSetAside[${i}]`, t]));
    out.push(['nullResult.oneQuestion', x.nullResult.oneQuestion]);
  }
  out.push(['email.subject', x.email.subject]);
  out.push(['email.body', x.email.body]);
  return out;
}

/** Apply `fn` to every prose field, returning a new object. */
export function mapProse(x: OneThing, fn: (field: string, text: string) => string): OneThing {
  return {
    ...x,
    ideas: x.ideas.map((idea, i) => ({
      ...idea,
      headline: fn(`ideas[${i}].headline`, idea.headline),
      build: fn(`ideas[${i}].build`, idea.build),
      whyNow: fn(`ideas[${i}].whyNow`, idea.whyNow),
      feasibility: fn(`ideas[${i}].feasibility`, idea.feasibility),
      risk: fn(`ideas[${i}].risk`, idea.risk),
    })),
    pick: { ...x.pick, why: fn('pick.why', x.pick.why) },
    fork: {
      ...x.fork,
      question: fn('fork.question', x.fork.question),
      ifYes: fn('fork.ifYes', x.fork.ifYes),
      ifNo: fn('fork.ifNo', x.fork.ifNo),
      whatChanges: fn('fork.whatChanges', x.fork.whatChanges),
      whyNone: fn('fork.whyNone', x.fork.whyNone),
    },
    whyUs: fn('whyUs', x.whyUs),
    firstStep: fn('firstStep', x.firstStep),
    refuse: { ...x.refuse, what: fn('refuse.what', x.refuse.what), why: fn('refuse.why', x.refuse.why) },
    peerFit: x.peerFit.map((f, i) => ({
      ...f,
      sellsTo: fn(`peerFit[${i}].sellsTo`, f.sellsTo),
      why: fn(`peerFit[${i}].why`, f.why),
    })),
    nullResult: x.nullResult
      ? {
          whatWeLookedAt: fn('nullResult.whatWeLookedAt', x.nullResult.whatWeLookedAt),
          whatWeSetAside: x.nullResult.whatWeSetAside.map((t, i) => fn(`nullResult.whatWeSetAside[${i}]`, t)),
          oneQuestion: fn('nullResult.oneQuestion', x.nullResult.oneQuestion),
        }
      : null,
    email: { subject: fn('email.subject', x.email.subject), body: fn('email.body', x.email.body) },
  };
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Every numeral anywhere must be in a claim cited somewhere in this document
 * or in a computed fact. The email may cite Verified claims only. The fork
 * must be a real fork or an admitted absence. Peers must be the ones in the
 * claims. The null verdict must be complete.
 */
export function validateOneThing(x: OneThing, claims: Claim[], facts: ComputedFacts): OneThingProblem[] {
  const problems: OneThingProblem[] = [];
  const byId = new Map(claims.map((c) => [c.id, c]));
  const ids = claims.map((c) => c.id);
  const allowed = allowedFigures(facts);
  const p = (field: string, code: OneThingProblem['code'], detail: string) =>
    problems.push({ field, code, detail });
  const nul = isNull(x);

  /* -- shape -- */
  if (!nul) {
    if (x.ideas.length < 3) p('ideas', 'too_few_ideas', `${x.ideas.length} idea(s); the reader needs at least three to judge the choice`);
    if (!Number.isInteger(x.pick.index) || x.pick.index < 0 || x.pick.index >= x.ideas.length) {
      p('pick.index', 'bad_pick', `index ${x.pick.index} names no idea`);
    }
    if (!x.pick.why.trim()) p('pick.why', 'no_evidence', 'the pick must be argued against the others');
  } else {
    const n = x.nullResult;
    if (!n) p('nullResult', 'null_incomplete', 'the null verdict needs whatWeLookedAt, whatWeSetAside and oneQuestion');
    else {
      if (!n.whatWeLookedAt.trim()) p('nullResult.whatWeLookedAt', 'null_incomplete', 'say what the evidence covered');
      if (n.whatWeSetAside.filter((t) => t.trim()).length < 2) p('nullResult.whatWeSetAside', 'null_incomplete', 'name at least two things set aside, with why');
      if (!n.oneQuestion.trim()) p('nullResult.oneQuestion', 'null_incomplete', 'the one question we would still ask is required');
    }
  }

  /* -- the fork -- */
  if (!nul) {
    const f = x.fork;
    if (f.found) {
      if (!f.question.trim() || !f.ifYes.trim() || !f.ifNo.trim() || !f.whatChanges.trim()) {
        p('fork', 'fork_missing', 'a found fork needs question, ifYes, ifNo and whatChanges');
      } else {
        if (norm(f.ifYes) === norm(f.ifNo)) p('fork', 'fork_same_branches', 'ifYes and ifNo are the same; that is not a fork');
        const hedge = [f.whatChanges, f.ifYes, f.ifNo].find((t) => FORK_HEDGE.test(t));
        if (hedge) {
          p('fork.whatChanges', 'fork_hedge', `"${hedge.match(FORK_HEDGE)![0]}" hedges the fork; state what gets built differently, or set found to false`);
        }
      }
    } else if (!f.whyNone.trim()) {
      p('fork.whyNone', 'fork_missing', 'if no fork was found, say why no public unknown changes the recommendation');
    }
  }

  /* -- citations -- */
  const cited = new Set<string>(x.refuse.claimIds);
  x.ideas.forEach((idea, i) => {
    if (idea.claimIds.length === 0) p(`ideas[${i}].claimIds`, 'no_evidence', 'an idea must rest on at least one claim');
    for (const id of idea.claimIds) cited.add(id);
  });
  for (const f of x.peerFit) for (const id of f.claimIds) cited.add(id);
  for (const [, text] of proseFields(x)) for (const id of citedIn(text, ids)) cited.add(id);
  const evidence: string[] = [];
  for (const id of cited) {
    const claim = byId.get(id);
    if (!claim) p('claimIds', 'unknown_claim_id', `no claim ${id}`);
    else evidence.push(claim.statement);
  }
  const haystack = evidence.join(' ');

  /* -- the outbound rule: Verified only in the email -- */
  for (const id of citedIn(x.email.body, ids)) {
    const claim = byId.get(id);
    if (claim && !isOutboundSafe(claim)) {
      p('email.body', 'non_verified_in_email', `"${id}" is ${claimStatus(claim).label}, not Verified; it is call material. Cite a Verified claim or drop the figure`);
    }
  }

  /* -- numerals -- */
  for (const [field, text] of proseFields(x)) {
    for (const n of numeralsIn(stripClaimIds(text, ids))) {
      const bare = n.replace('%', '');
      if (allowed.has(bare) || HARMLESS.has(bare)) continue;
      if (haystack.includes(bare)) continue;
      p(field, 'unsourced_numeral', `"${n}" is in no cited claim or computed fact`);
    }
  }

  /* -- peers -- */
  const peerNames = new Map<string, string>();
  for (const c of claims) if (c.peerName) peerNames.set(norm(c.peerName), c.peerName);
  const covered = new Set<string>();
  x.peerFit.forEach((f, i) => {
    const key = norm(f.peer);
    if (!peerNames.has(key)) p(`peerFit[${i}].peer`, 'unknown_peer', `"${f.peer}" is not a peer in the claims`);
    else covered.add(key);
  });
  for (const [key, name] of peerNames) {
    if (!covered.has(key)) p('peerFit', 'peer_fit_missing', `no buyer-fit entry for ${name}`);
  }

  /* -- lengths -- */
  x.ideas.forEach((idea, i) => {
    if (wordCount(idea.headline) > 14) p(`ideas[${i}].headline`, 'too_long', `${wordCount(idea.headline)} words; twelve is the ceiling`);
  });
  const words = wordCount(x.email.body);
  const [lo, hi] = nul ? [100, 320] : [150, 450];
  if (words > hi) p('email.body', 'too_long', `${words} words; the email is meant to be read on a phone`);
  if (words < lo) p('email.body', 'too_short', `${words} words; that is a note, not a recommendation`);

  return problems;
}

/**
 * Replace every unsourced numeral with a visible marker.
 *
 * This is the last resort after a retry, and it is a redaction, not a repair:
 * the sentence survives, the figure does not, and the reviewer sees exactly
 * where the model reached for a number it could not source.
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
  const redacted = mapProse(x, (field, text) => {
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
  });
  return { redacted, count };
}

/** Ids the email cites that are not Verified, after every retry. Call material that leaked. */
export function nonVerifiedInEmail(x: OneThing, claims: Claim[]): string[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  return citedIn(x.email.body, claims.map((c) => c.id)).filter((id) => {
    const c = byId.get(id);
    return c && !isOutboundSafe(c);
  });
}

/** Every string a reader will see, for the voice check. */
export function oneThingProse(x: OneThing): string {
  return proseFields(x)
    .map(([, text]) => text)
    .filter(Boolean)
    .join('\n');
}

/* -- the prompt ---------------------------------------------------------- */

export const ONE_THING_INSTRUCTIONS = `You have already written the analysis: a read on where they stand, several ideas, the questions, the peer signal. Now do the harder thing. Lay out the real options, then choose, or say honestly that nothing clears the bar.

WHAT YOU ARE WRITING. Two documents that say the same thing at two lengths. A short email to the owner, and the fields behind it that a research report will carry. Both are read by a colleague first, who will check every sentence against the claim it cites before anything is sent.

THE VERDICT. "recommend" when one build clears four bars at once: there is evidence behind it, a small design-led product studio could ship it inside one engagement, no vendor sells it for a monthly fee, and it is not something they told us they already tried or ruled out. "nothing_worth_a_call" when none does. The null verdict is a real answer and is rewarded over a weak pick: an owner told plainly that we looked and found nothing worth his money this year trusts the next thing we say. If the verdict is null, still list the candidates you weighed in ideas, fill nullResult, and write the shorter email.

THE IDEAS. Three or four candidate builds, and they must be genuinely different: a different user, a different moment in the workflow, or a different mechanism. One idea in three sizes is not three ideas. Each is named as a thing: a screen, a step in a workflow, a record, a prediction shown at a specific moment to a specific person. Not a programme, not a strategy, not "explore". The test for every one: could a small design-led product studio scope it on Monday and have a working surface in front of real users inside one engagement? If not, it is too big. If a vendor already sells it for a monthly fee, say so in its risk line rather than pretending otherwise. Each idea carries its own evidence, its own feasibility line and its own risk line, so the reader can weigh them without you.

Prefer the boring prerequisite over the clever model. Prefer an internal surface the company controls over a client-facing product that changes what they sell. Prefer the thing their own data makes possible and no competitor can buy. If the strongest evidence is a peer's move, the response to it is usually a better idea than a copy of it.

THE PICK. Choose one, and argue it against the others by name. What each loses on: weaker evidence, harder to ship in one engagement, buyable from a vendor, or risk to what they sell. A reader who disagrees with the pick should be able to see exactly which judgement they disagree with. Do not pick the safest idea by default; pick the one the evidence supports best that they could not buy.

THE FORK. For the recommended build, the one question we could not answer from outside whose answer changes WHAT we would build first, not merely when. State the question, the first build under each answer, and in one sentence what differs between the branches: the build, the user, the system touched. The branches must name different builds or different first steps. Do not write that it "changes the sequencing rather than the destination" or any version of that; the check rejects it. If you cannot find a question that changes the build, set found to false and say why in whyNone. An admitted absence beats a fake fork.

WHAT WE WOULD REFUSE. The tempting build. Usually the obvious one everyone will pitch them this year, and usually not one of your ideas. Say why it is wrong for them specifically: the asymmetry, the price war, the risk to what they sell. This is the paragraph most likely to be forwarded internally, so make it plain.

BUYER FIT. For every peer named in the claims, say who they sell to and whether that buyer overlaps the target's buyer: yes, partial, no, or unknown. A company that sells to solo founders is not a threat to one that sells to owner-operators with staff, however similar the product. Judge from the claims and the industry context, and say "unknown" when neither supports a judgement. Never inflate a threat by ignoring the segment.

THE EMAIL. For "recommend": 260 to 380 words. Open with the recommendation in the first sentence. Then, in one paragraph, name the other ideas you weighed and say in a clause each why this one won. Then what you would refuse. Close with the fork question, if found; otherwise with the question from the analysis that matters most. For "nothing_worth_a_call": 150 to 260 words. Say plainly that we researched and did not find a build worth their money this year, what we looked at, what we set aside and why, and the one question we would still ask. Written by the person who did the research, to the owner, the way a smart colleague writes.

THE OUTBOUND RULE. Every claim carries a status: Verified, Cited, Tool data, or Ours. The email may cite Verified claims ONLY. Cited and Tool-data claims are for the call, where we can say how we know; Ours never leaves the building unspoken. Every other field may cite any status. The check rejects an email that cites anything but Verified, so do not write one. Cite ids in parentheses after the sentence they support; they will become numbered footnotes with the source underneath. Do not thank them for filling in a form. Do not describe our process. Do not mention hiring, job adverts or careers pages. Do not attach a price or a timeline unless a Verified claim carries the figure.

NUMERALS. Every digit anywhere in your output must appear in a claim you cite or in the computed facts. There is no assumptions block here. An unsupported digit is redacted before anyone sees it, so it is wasted work. Write "a fraction of the price" if you cannot cite the price.

WHAT THEY TOLD US comes in three labelled answers, in their words, and it is not evidence. WHAT CHANGED RECENTLY sets why now: lead with it where the evidence supports it. WHERE THE TEAM BURNS TIME points at where the buildable gap lives; an idea that touches that step outranks one that does not. ALREADY TRIED, EVALUATED OR RULED OUT is a list of things you must not recommend; if the obvious idea is on it, say what you would do differently and why, or drop it. Never quote these answers back to them as findings.`;

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
      `status=${claimStatus(c).label}`,
      `tier=${c.tier}`,
      c.peerName ? `peer=${c.peerName}` : null,
      c.observedAt ? `dated=${c.observedAt}` : null,
    ].filter(Boolean);
    return `- [${bits.join(' ')}] ${c.statement}`;
  });
  const peers = [...new Set(args.claims.map((c) => c.peerName).filter((x): x is string => Boolean(x)))];

  const told = args.trigger?.trim()
    ? `\nWHAT THEY TOLD US (their words, not evidence; see the rules at the end):\n${args.trigger.trim()}\n`
    : '';
  const brief = args.industryBrief?.trim()
    ? `\nINDUSTRY CONTEXT we researched separately. Judgement only; NOT citable, so no figure from it may appear in your output:\n${args.industryBrief.trim()}\n`
    : '';

  return `COMPANY: ${args.company} (${args.domain})
${args.oneLiner?.trim() ? `THEY DESCRIBE THEMSELVES AS: ${args.oneLiner.trim()}\n` : ''}${told}${brief}
COMPUTED FACTS — you may state these figures freely:
${JSON.stringify(args.facts, null, 2)}

PEERS IN THE CLAIMS — every one needs a buyer-fit entry, by this exact name:
${peers.length ? peers.map((n) => `- ${n}`).join('\n') : '- (none)'}

THE ANALYSIS YOU ALREADY WROTE (validated; draw your ideas from it, sharpen them, or depart from it if the evidence points elsewhere):
${JSON.stringify(args.synthesis, null, 2)}

VALIDATED CLAIMS — the only evidence. Every one is sourced and carries its status. Cite by id.
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
  /** Non-Verified claims the email still cites after the retry. Zero is the goal; the draft marks them. */
  callMaterialInEmail: string[];
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

WHAT MUST NOT CHANGE: every claim id, every figure, the verdict, the recommendation itself, the refusal, the fork, the buyer-fit judgements, and the marker "${REDACTED}" wherever it appears.

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
      } else if ((repaired.verdict === 'recommend' && repaired.ideas.length < 3) || wordCount(repaired.email.body) < 100) {
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
    callMaterialInEmail: nonVerifiedInEmail(final, args.claims),
    attempts,
    voiceFlags,
    voiceRepair,
    notes,
  };
}
