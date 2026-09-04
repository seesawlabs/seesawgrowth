/* ---------------------------------------------------------------------------
   Stage 02 — the competitive set. The make-or-break stage.

   THE TRAP, and why this file is shaped the way it is.

   FIND-SIMILAR WAS CUT 2026-09-04. It ran as a second generator for seven
   live targets and contributed zero surviving candidates on every one of them:
   15 of 15 filtered out on hpsrx.com, on swingerz.net and on compassus.com,
   where the rejection tally read `names_the_subject=11` — pages that mention
   the company, which is what "similar to this page" means and is not what a
   competitor is. The README's rule was to keep it one more batch of targets
   and cut it if the pattern held. It held. What went with it is the confidence
   promotion for generator agreement, which never fired either.

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
import { searchCompanies, type ExaResult } from '../lib/clients/exa.ts';
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

export type Generator = 'category-search' | 'named-by-subject';

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
  /**
   * The subject's footprint, from stage 01. Used only to warn: a target with
   * locations in thirty states and a generated peer set is probably being
   * compared to companies a hundredth its size.
   */
  subjectScale?: { footprintPages: number; states: string[] };
  /**
   * Competitors the subject named on the intake form, as bare domains.
   *
   * This is the highest-value thing a visitor can tell us. Stage 02 is
   * make-or-break and its generators are heuristics: Exa's category search
   * works well when the site's own self-description is good, and five of seven
   * live targets had a self-description that was marketing copy. An operator
   * who names two competitors fixes in one field what no amount of query
   * tuning reliably fixes.
   *
   * Named peers still go through every filter — a wrong domain, an aggregator
   * page or the subject's own site is rejected the same as any candidate. What
   * they skip is *discovery*, not *validation*.
   */
  namedPeers?: string[];
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

  /* Confidence, now that there is one generator.
     `high` means a person named the peer; `medium` means the category search
     proposed it and every filter let it through. Nothing else can reach high,
     which is the honest reading: agreement between generators used to promote a
     peer, and the second generator is gone (see the header). */
  const peers = [...kept.values()].map((peer) => {
    if (peer.generators.includes('named-by-subject')) {
      return { ...peer, confidence: 'high' as Confidence };
    }
    return { ...peer, confidence: (peer.generators.includes('category-search') ? 'medium' : 'low') as Confidence };
  });

  const rank: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  peers.sort((a, b) => {
    // Named peers first, always — the keep cap must never drop one.
    const an = a.generators.includes('named-by-subject') ? 0 : 1;
    const bn = b.generators.includes('named-by-subject') ? 0 : 1;
    return an - bn || rank[a.confidence] - rank[b.confidence] || a.domain.localeCompare(b.domain);
  });

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

  // A description of the category, not the company, so Exa retrieves companies
  // rather than coverage of one company. This is the generator.
  const search = await searchCompanies(cache, ledger, categoryQuery, numResults, now);

  const searchRamp = looksLikeRankRamp((search.results ?? []).map((r) => r.score));
  if (searchRamp) {
    notes.push(
      "category-search scores are a linear rank ramp (1 - i/(n-1)), not similarities — " +
        'a peer is high confidence only when a person named it'
    );
  }

  /* Named peers are seeded as candidates before the generators, so dedupe
     merges a generator's later hit into the named entry rather than the other
     way round, and the named provenance survives. */
  const named = (opts.namedPeers ?? [])
    .map((d) => registrableDomain(d.trim().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '')))
    .filter(Boolean)
    .filter((d, i, all) => all.indexOf(d) === i);

  const raw = [
    ...named.map((domain) => ({
      result: { id: domain, url: `https://${domain}`, title: domain } as ExaResult,
      generator: 'named-by-subject' as Generator,
    })),
    ...(search.results ?? []).map((result) => ({ result, generator: 'category-search' as Generator })),
  ];
  if (named.length > 0) {
    notes.push(`${named.length} peer(s) named on the intake form, seeded ahead of the generators`);
  }

  const { peers, rejected } = filterCandidates(raw, subjectDomain, subjectName, {
    ...opts,
    categoryQuery,
  });

  const rejectionSummary: Record<string, number> = {};
  for (const r of rejected) rejectionSummary[r.reason] = (rejectionSummary[r.reason] ?? 0) + 1;

  /* A big target with a generated peer set is the shape of the Compassus run:
     eight single-location agencies against a national provider. Say so where
     the operator will read it, and name the two things that fix it. */
  if (opts.subjectScale && opts.subjectScale.states.length >= 5 && named.length === 0) {
    notes.push(
      `the subject operates in ${opts.subjectScale.states.length} states and no peer was named by hand — ` +
        'if these peers are smaller than the target, re-run with --category naming scale AND ownership ' +
        '("large national X operating in N states, private-equity owned, sells to health systems"), ' +
        'which is the phrasing that surfaces operators of the same size, or name two with --peers'
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
      { name: 'named-by-subject', returned: named.length, scoresAreRankRamp: false },
      { name: 'category-search', returned: (search.results ?? []).length, scoresAreRankRamp: searchRamp },
    ],
    peers,
    rejected,
    rejectionSummary,
    notes,
  };
}
