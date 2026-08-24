/* ---------------------------------------------------------------------------
   Stage 02 — the competitive set. The make-or-break stage.

   THE TRAP, and why this file is shaped the way it is.

   The obvious implementation is Exa `findSimilar` on the subject's homepage
   with `excludeSourceDomain: true`. It looks right, it returns confidently
   ranked results with plausible similarity scores, and it is worthless.
   Probed live on hpsrx.com, 10 of 10 results were pages *about* HPSRx:

     hpsrx.tshinc.com          a reseller mirror of their own catalogue
     cbinsights.com/company/…  a company profile
     hpsrx.com.getstat.site    an SEO shadow copy
     linkedin.com/company/…    their own LinkedIn
     opengovco.com/license/…   a state pharmacy licence record
     owler, leadiq, importgenius, a trade-show booth listing, a headquarters
     directory page

   Zero peers. Find-similar retrieves "pages about the same entity", which is a
   different question from "companies like this one". Ship that and every
   comparative claim downstream is garbage — confidently formatted garbage,
   which is worse than none.

   What works is a category description: Exa `search` with
   `category:"company"` and a natural-language description of what the company
   does, derived from stage 01's crawl. For HPSRx that returned MedGyn, Thomas
   Medical, Premium Rx, Pharmacy Distribution Partners, Medical Specialties
   Distributors — genuine peers.

   So this stage is candidate generation plus a real filter pipeline, and every
   rejection is recorded with its reason. The rejection log is the deliverable
   as much as the peer list is: it is how we find out that discovery is
   drifting before a customer does.

   Confidence comes from *which generators agreed*, never from Exa's score.
   In category searches the score is a linear rank ramp — 1, 0.929, 0.857 … 0
   for 15 results, exactly 1 - i/(n-1) — and carries no similarity signal at
   all. `looksLikeRankRamp` records that in the artifact so nobody has to
   rediscover it.
--------------------------------------------------------------------------- */

import type { CacheOptions } from '../lib/cache.ts';
import type { Ledger } from '../lib/budget.ts';
import { findSimilar, searchCompanies, type ExaResult } from '../lib/clients/exa.ts';
import {
  categoryOverlap,
  categoryTerms,
  hasProfilePath,
  isAggregatorHost,
  isForeignCcTld,
  isSubjectMirror,
  looksLikeRankRamp,
  registrableDomain,
  textNamesSubject,
  type RejectReason,
} from '../lib/domain.ts';
import type { Confidence } from '../lib/claim.ts';

export type Generator = 'category-search' | 'find-similar';

export interface PeerCandidate {
  domain: string;
  url: string;
  name: string;
  generators: Generator[];
  /** Recorded for provenance only. Never used as confidence — see the note. */
  exaScores: number[];
  text?: string;
  confidence: Confidence;
}

export interface Rejection {
  url: string;
  domain: string;
  reason: RejectReason;
  detail: string;
  generators: Generator[];
}

export interface PeersArtifact {
  subjectDomain: string;
  discoveredAt: string;
  categoryQuery: string;
  generators: {
    name: Generator;
    returned: number;
    /** True when Exa's scores were a rank ramp rather than similarities. */
    scoresAreRankRamp: boolean;
  }[];
  peers: PeerCandidate[];
  rejected: Rejection[];
  /** Counts by reason — the fastest read on whether discovery is drifting. */
  rejectionSummary: Record<string, number>;
  notes: string[];
}

/** Company name from an Exa result title, with page furniture trimmed. */
export function nameFromResult(result: ExaResult): string {
  const raw = (result.title ?? '').trim();
  const head = raw.split(/\s+[|–—]\s+|\s+-\s+/)[0]?.trim() ?? '';
  const name = head.length >= 3 ? head : raw;
  return (name || registrableDomain(result.url)).slice(0, 80);
}

export interface PeerOptions {
  /** Category description, for the off-category check. */
  categoryQuery?: string;
  keepMin?: number;
  keepMax?: number;
  numResults?: number;
  /** ccTLDs acceptable for this subject. Defaults to US/Canada. */
  allowedCcTlds?: string[];
}

/**
 * Run the filters in order, hardest and cheapest signals first, so an obvious
 * reject never costs a later check.
 */
export function filterCandidates(
  raw: { result: ExaResult; generator: Generator }[],
  subjectDomain: string,
  subjectName: string | undefined,
  opts: PeerOptions = {}
): { peers: PeerCandidate[]; rejected: Rejection[] } {
  const rejected: Rejection[] = [];
  const kept = new Map<string, PeerCandidate>();
  const terms = categoryTerms(opts.categoryQuery ?? '');

  const reject = (r: ExaResult, generator: Generator, reason: RejectReason, detail: string) => {
    rejected.push({ url: r.url, domain: registrableDomain(r.url), reason, detail, generators: [generator] });
  };

  for (const { result, generator } of raw) {
    const domain = registrableDomain(result.url);
    if (!domain) {
      reject(result, generator, 'not_a_company_page', 'no parsable domain');
      continue;
    }

    // 1. The subject itself. The category search returned hpsrx.com.
    if (domain === registrableDomain(subjectDomain)) {
      reject(result, generator, 'subject_domain', 'this is the subject');
      continue;
    }

    // 2. Mirrors and shadow hosts reusing the subject's brand label.
    if (isSubjectMirror(result.url, subjectDomain)) {
      reject(result, generator, 'subject_mirror', `host reuses the subject's brand label`);
      continue;
    }

    // 3. Aggregators and directories, by host and by path shape.
    if (isAggregatorHost(result.url)) {
      reject(result, generator, 'aggregator_host', `${domain} publishes pages about companies`);
      continue;
    }
    if (hasProfilePath(result.url)) {
      reject(result, generator, 'profile_path', `path looks like a company profile, not a company`);
      continue;
    }

    // 4. Geography. A US regional distributor's peers are not in Tanzania.
    if (isForeignCcTld(result.url, opts.allowedCcTlds ?? ['us', 'ca'])) {
      reject(result, generator, 'foreign_geography', `ccTLD outside the subject's market`);
      continue;
    }

    // 5. The cheapest strong signal available: a page that names the subject
    //    is a page about the subject. Needs the candidate's own text, which is
    //    why both generators request contents.text.
    if (result.text && textNamesSubject(result.text, subjectDomain, subjectName)) {
      reject(result, generator, 'names_the_subject', `candidate's own page text names the subject`);
      continue;
    }

    // 6. Nothing lexically in common with the category we searched for. The
    //    live probe for a pharmaceutical distributor returned an IVF clinic;
    //    this is what catches that class of miss. Only zero overlap rejects.
    if (result.text && terms.length > 0) {
      const overlap = categoryOverlap(result.text, terms);
      if (overlap.length === 0) {
        reject(result, generator, 'off_category', 'page text shares no vocabulary with the category description');
        continue;
      }
    }

    // 7. Dedupe by registrable domain, merging generator provenance. Agreement
    //    between generators is the confidence signal, so it must accumulate.
    const existing = kept.get(domain);
    if (existing) {
      if (!existing.generators.includes(generator)) existing.generators.push(generator);
      if (typeof result.score === 'number') existing.exaScores.push(result.score);
      if (!existing.text && result.text) existing.text = result.text;
      rejected.push({
        url: result.url,
        domain,
        reason: 'duplicate',
        detail: `same company as ${existing.url}`,
        generators: [generator],
      });
      continue;
    }

    kept.set(domain, {
      domain,
      url: result.url,
      name: nameFromResult(result),
      generators: [generator],
      exaScores: typeof result.score === 'number' ? [result.score] : [],
      text: result.text,
      confidence: 'low',
    });
  }

  // Confidence from generator agreement. Find-similar alone is weak evidence
  // by construction: it demonstrably retrieves same-entity pages, so a
  // candidate only it proposed has survived the filters but proved nothing.
  const peers = [...kept.values()].map((peer) => {
    const both = peer.generators.length > 1;
    const category = peer.generators.includes('category-search');
    return { ...peer, confidence: (both ? 'high' : category ? 'medium' : 'low') as Confidence };
  });

  const rank: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  peers.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.domain.localeCompare(b.domain));

  const keepMax = opts.keepMax ?? 8;
  for (const extra of peers.slice(keepMax)) {
    rejected.push({
      url: extra.url,
      domain: extra.domain,
      reason: 'over_keep_limit',
      detail: `beyond the ${keepMax}-peer cap, ${extra.confidence} confidence`,
      generators: extra.generators,
    });
  }

  return { peers: peers.slice(0, keepMax), rejected };
}

export async function runPeersStage(
  cache: CacheOptions,
  ledger: Ledger,
  subjectDomain: string,
  categoryQuery: string,
  subjectName: string | undefined,
  now: string,
  opts: PeerOptions = {}
): Promise<PeersArtifact> {
  const notes: string[] = [];
  const numResults = opts.numResults ?? 15;

  // Generator A: the one that works. A description of the category, not the
  // company, so Exa retrieves companies rather than coverage of one company.
  const search = await searchCompanies(cache, ledger, categoryQuery, numResults, now);

  // Generator B: kept for coverage, distrusted by design. Anything it alone
  // proposes lands at low confidence.
  const similar = await findSimilar(cache, ledger, `https://${subjectDomain}`, numResults, now);

  const searchRamp = looksLikeRankRamp((search.results ?? []).map((r) => r.score));
  const similarRamp = looksLikeRankRamp((similar.results ?? []).map((r) => r.score));
  if (searchRamp) {
    notes.push(
      "category-search scores are a linear rank ramp (1 - i/(n-1)), not similarities — " +
        'confidence comes from generator agreement instead'
    );
  }

  const raw = [
    ...(search.results ?? []).map((result) => ({ result, generator: 'category-search' as Generator })),
    ...(similar.results ?? []).map((result) => ({ result, generator: 'find-similar' as Generator })),
  ];

  const { peers, rejected } = filterCandidates(raw, subjectDomain, subjectName, {
    ...opts,
    categoryQuery,
  });

  const rejectionSummary: Record<string, number> = {};
  for (const r of rejected) rejectionSummary[r.reason] = (rejectionSummary[r.reason] ?? 0) + 1;

  const fromSimilarOnly = rejected.filter((r) => r.generators.includes('find-similar')).length;
  const similarReturned = (similar.results ?? []).length;
  if (similarReturned > 0) {
    notes.push(
      `find-similar contributed ${peers.filter((p) => p.generators.includes('find-similar')).length} surviving ` +
        `candidate(s) of ${similarReturned}; ${fromSimilarOnly} of its results were filtered out`
    );
  }

  const keepMin = opts.keepMin ?? 5;
  if (peers.length < keepMin) {
    notes.push(
      `only ${peers.length} peer(s) survived filtering against a ${keepMin}-peer target — ` +
        'the category query is the first thing to look at'
    );
  }

  return {
    subjectDomain,
    discoveredAt: now,
    categoryQuery,
    generators: [
      { name: 'category-search', returned: (search.results ?? []).length, scoresAreRankRamp: searchRamp },
      { name: 'find-similar', returned: similarReturned, scoresAreRankRamp: similarRamp },
    ],
    peers,
    rejected,
    rejectionSummary,
    notes,
  };
}
