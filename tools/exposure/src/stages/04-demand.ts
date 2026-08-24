/* ---------------------------------------------------------------------------
   Stage 04 — category demand signals.

   Two questions, both about whether the market is moving toward or away from
   what the subject sells:

     1. What is search demand for this category, and is it rising or falling?
     2. What do the peers already rank for that the subject does not?

   TWO DATES ON EVERY FIGURE, and this is the point of the stage.

   CLAUDE.md's standing rule is that the DataForSEO figures in docs/02 are
   dated and any recommendation depending on volume needs a re-pull first. The
   same rot applies here, but worse, because these numbers arrive fresh-looking
   inside an automated report. So every figure carries:

     pulledAt              when we called the API
     dataLastUpdated       Google's own refresh date for that keyword

   On the live probe those were 2026-08-24 and 2026-07-12 — six weeks apart.
   Stamping only the pull date would imply a freshness the data does not have.
   Both go in the claim, inline, as the README requires.

   TREND IS COMPUTED, NOT ASSERTED. `monthly_searches` comes back as a real
   36-month series, so direction is arithmetic over their numbers rather than
   an adjective we chose. On the probe, "pharmacy automation" ran 880-1000/mo
   through mid-2025 and 390-480/mo through 2026 — a category shrinking while
   everyone assumes it is growing. That is a finding, and it is only available
   because the series is real.
--------------------------------------------------------------------------- */

import type { CacheOptions } from '../lib/cache.ts';
import type { Ledger } from '../lib/budget.ts';
import {
  keywordOverview,
  rankedKeywords,
  firstResult,
  sourceUrlFor,
  verifyAuth,
  type KeywordInfo,
} from '../lib/clients/dataforseo.ts';
import { categoryTerms } from '../lib/domain.ts';

export const KEYWORD_OVERVIEW_ENDPOINT = 'dataforseo_labs/google/keyword_overview/live';
export const RANKED_KEYWORDS_ENDPOINT = 'dataforseo_labs/google/ranked_keywords/live';

export interface DemandTerm {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitionLevel: string | null;
  difficulty: number | null;
  intent: string | null;
  /** Google's own refresh date for this keyword. Not our pull date. */
  dataLastUpdated: string | null;
  trend: TrendSummary | null;
}

export interface TrendSummary {
  /** Mean monthly volume over the most recent 12 months. */
  recentMean: number;
  /** Mean over the 12 months before that. */
  priorMean: number;
  changePct: number;
  direction: 'rising' | 'falling' | 'flat';
  monthsCompared: number;
}

/**
 * Direction from the peer's own series, never from an impression. A 10% band
 * counts as flat: month-to-month Google volume buckets are coarse enough that
 * a smaller move is noise, and calling noise a trend is inventing a finding.
 */
export function summarizeTrend(monthly: KeywordInfo['monthly_searches']): TrendSummary | null {
  const series = (monthly ?? [])
    .filter((m) => typeof m.search_volume === 'number')
    .map((m) => ({ ...m, search_volume: m.search_volume as number }))
    .sort((a, b) => b.year - a.year || b.month - a.month);
  if (series.length < 18) return null;

  const recent = series.slice(0, 12);
  const prior = series.slice(12, 24);
  if (prior.length < 6) return null;

  const mean = (xs: { search_volume: number }[]) =>
    xs.reduce((s, x) => s + x.search_volume, 0) / xs.length;
  const recentMean = mean(recent);
  const priorMean = mean(prior);
  if (priorMean === 0) return null;

  const changePct = ((recentMean - priorMean) / priorMean) * 100;
  const direction = changePct > 10 ? 'rising' : changePct < -10 ? 'falling' : 'flat';

  return {
    recentMean: Math.round(recentMean),
    priorMean: Math.round(priorMean),
    changePct: Math.round(changePct * 10) / 10,
    direction,
    monthsCompared: recent.length + prior.length,
  };
}

export interface PeerRankedTerm {
  peerDomain: string;
  keyword: string;
  searchVolume: number | null;
  rank: number | null;
  url: string | null;
}

export interface DemandArtifact {
  subjectDomain: string;
  /** Kept so claim construction can judge which ranked terms are relevant. */
  categoryQuery: string;
  /** When we called the API. Stamped inline on every claim. */
  pulledAt: string;
  account: { login: string; balanceUsd: number } | null;
  seedTerms: string[];
  terms: DemandTerm[];
  peerRanked: PeerRankedTerm[];
  peerTotals: { peerDomain: string; rankingKeywords: number }[];
  sources: { endpoint: string; url: string }[];
  notes: string[];
}

/**
 * Seed terms for the demand pull.
 *
 * Built from the category description that stage 02 already validated by
 * finding real peers with it, rather than from a keyword template. A term list
 * we invented would measure demand for a category we made up.
 *
 * Bigrams first: single content words ("pharmaceutical") measure demand for a
 * topic, whereas pairs ("pharmaceutical distributor") measure demand for a
 * business. Capped, because every term costs money and a long tail of
 * zero-volume phrases teaches nothing.
 */
export function seedTermsFrom(categoryQuery: string, limit = 8, corpus = ''): string[] {
  const content = categoryTerms(categoryQuery);

  // Bigrams are formed *within* a clause, never across punctuation. Splitting
  // the whole description on whitespace pairs the last word of one phrase with
  // the first of the next: "…pharmaceuticals, medical devices…" yielded
  // "pharmaceuticals medical", a phrase nobody searches for.
  const clauses = categoryQuery
    .toLowerCase()
    .split(/[,.;:!?()]+|\s(?:and|or|with|for|to|in|of|as|from)\s/)
    // Apostrophes are removed rather than spaced: splitting "women's" into
    // "women" and "s" lost the "women's health" bigram on the live run and
    // left a bare "health" — 450,000 searches a month at difficulty 100, and
    // not a category anyone sells into.
    .map((c) => c.replace(/['\u2019]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim())
    .filter(Boolean);

  const stem = (w: string) => {
    const bare = w.replace(/['\u2019]/g, '');
    return bare.endsWith('s') && !bare.endsWith('ss') ? bare.slice(0, -1) : bare;
  };

  // Both sides of the bigram test are normalised the same way. They were not:
  // categoryTerms keeps the apostrophe in "women's" while the clause words had
  // it stripped, so the two never matched and the pair was never formed.
  const contentSet = new Set(content.map(stem));

  const bigrams: string[] = [];
  for (const clause of clauses) {
    const words = clause.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i];
      const b = words[i + 1];
      // Both halves must be content words, or the pair is mostly grammar.
      if (!contentSet.has(stem(a)) || !contentSet.has(stem(b))) continue;
      const pair = `${a} ${b}`;
      if (!bigrams.includes(pair)) bigrams.push(pair);
    }
  }

  /**
   * A single word that already appears inside a chosen bigram is dropped.
   *
   * "medical supply" is a category; "medical" is an industry. The live
   * meridianmedicalsupply.com run paid to measure both, and reported that
   * "medical" gets 301,000 US searches a month — a true figure that says
   * nothing about a medical supply company in El Paso. The bigram is always
   * the more specific question, so its components are redundant at best and
   * misleading at worst.
   */
  const bigramWords = new Set(bigrams.flatMap((b) => b.split(/[\s-]+/).map(stem)));
  const singles = content.filter(
    (t) => t.length >= 6 && /^[a-z0-9-]+$/.test(t) && !bigramWords.has(stem(t))
  );
  const candidates = [...bigrams, ...singles];
  if (!corpus) return candidates.slice(0, limit);

  /**
   * Attestation in the subject's own body text.
   *
   * The category query comes from a meta description, which is marketing copy
   * written to be read once. A word that appears there and nowhere else in the
   * site is a hook, not a category — and paying DataForSEO to measure demand
   * for it produces a real, sourced, correctly dated figure about nothing.
   * Requiring two occurrences in the crawled text is a cheap test of whether
   * the company actually talks about the thing.
   */
  const flat = ` ${corpus.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const occurrences = (term: string) => {
    let count = 0;
    let from = 0;
    const needle = ` ${term} `;
    for (;;) {
      const at = flat.indexOf(needle, from);
      if (at === -1) break;
      count += 1;
      from = at + 1;
      if (count >= 2) break;
    }
    return count;
  };

  // Attestation *orders* the list rather than truncating it. PageSignals keeps
  // no body text, so the corpus available here is titles, descriptions and
  // quotes — thin enough that a hard filter left a single term on two of the
  // three live targets. Attested terms first, then the rest to fill the quota.
  const attested = candidates.filter((t) => occurrences(t) >= 2);
  const rest = candidates.filter((t) => !attested.includes(t));
  return [...attested, ...rest].slice(0, limit);
}

export interface DemandOptions {
  /**
   * The subject's crawled body text, for seed-term attestation. Without it,
   * seed terms come from a meta description alone — see `seedTermsFrom`.
   */
  corpus?: string;
  /**
   * Trimmed category text for seed terms. Defaults to `categoryQuery`, which
   * is deliberately longer: peer discovery needs the incidental detail that
   * ruins a keyword list. See `deriveCategoryQuery`.
   */
  seedText?: string;
  /** Peers whose ranking terms we pull. Each costs one request. */
  peerDomains?: string[];
  maxPeerLookups?: number;
  rankedLimit?: number;
  seedLimit?: number;
}

export async function runDemandStage(
  cache: CacheOptions,
  ledger: Ledger,
  subjectDomain: string,
  categoryQuery: string,
  now: string,
  opts: DemandOptions = {}
): Promise<DemandArtifact> {
  const notes: string[] = [];

  // Verify before spending. DataForSEO reports a bad password as HTTP 200 with
  // status_code 40100, so an unverified run fails several dollars later with a
  // confusing error rather than immediately with a clear one.
  let account: { login: string; balanceUsd: number } | null = null;
  try {
    account = await verifyAuth();
    notes.push(`DataForSEO auth verified for ${account.login}; balance $${account.balanceUsd}`);
  } catch (error) {
    notes.push(`DataForSEO auth check failed: ${(error as Error).message.slice(0, 200)}`);
    return {
      subjectDomain,
      categoryQuery,
      pulledAt: now,
      account: null,
      seedTerms: [],
      terms: [],
      peerRanked: [],
      peerTotals: [],
      sources: [],
      notes,
    };
  }

  const seedTerms = seedTermsFrom(
    opts.seedText ?? categoryQuery,
    opts.seedLimit ?? 8,
    opts.corpus ?? ''
  );
  const terms: DemandTerm[] = [];

  if (seedTerms.length === 0) {
    notes.push('no usable seed terms from the category description — nothing to measure');
  } else {
    const body = await keywordOverview(cache, ledger, seedTerms, now);
    const result = firstResult(body);
    for (const item of result?.items ?? []) {
      const info = item.keyword_info;
      terms.push({
        keyword: item.keyword,
        searchVolume: info?.search_volume ?? null,
        cpc: info?.cpc ?? null,
        competition: info?.competition ?? null,
        competitionLevel: info?.competition_level ?? null,
        difficulty: item.keyword_properties?.keyword_difficulty ?? null,
        intent: item.search_intent_info?.main_intent ?? null,
        dataLastUpdated: info?.last_updated_time?.slice(0, 10) ?? null,
        trend: summarizeTrend(info?.monthly_searches),
      });
    }
    const withVolume = terms.filter((t) => (t.searchVolume ?? 0) > 0).length;
    notes.push(
      `pulled ${terms.length} term(s) ${now.slice(0, 10)}; ${withVolume} carry non-zero US search volume`
    );
  }

  // What peers already rank for. Capped: one request per peer.
  const peerRanked: PeerRankedTerm[] = [];
  const peerTotals: { peerDomain: string; rankingKeywords: number }[] = [];
  const peerDomains = (opts.peerDomains ?? []).slice(0, opts.maxPeerLookups ?? 3);

  for (const peerDomain of peerDomains) {
    try {
      const body = await rankedKeywords(cache, ledger, peerDomain, opts.rankedLimit ?? 20, now);
      const result = firstResult(body);
      peerTotals.push({ peerDomain, rankingKeywords: result?.total_count ?? 0 });
      for (const item of result?.items ?? []) {
        const serp = item.ranked_serp_element?.serp_item;
        peerRanked.push({
          peerDomain,
          keyword: item.keyword_data?.keyword ?? '',
          searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
          rank: serp?.rank_absolute ?? null,
          url: serp?.url ?? null,
        });
      }
    } catch (error) {
      notes.push(`ranked_keywords failed for ${peerDomain}: ${(error as Error).message.slice(0, 160)}`);
    }
  }

  return {
    subjectDomain,
    categoryQuery,
    pulledAt: now,
    account,
    seedTerms,
    terms,
    peerRanked,
    peerTotals,
    sources: [
      { endpoint: KEYWORD_OVERVIEW_ENDPOINT, url: sourceUrlFor(KEYWORD_OVERVIEW_ENDPOINT) },
      { endpoint: RANKED_KEYWORDS_ENDPOINT, url: sourceUrlFor(RANKED_KEYWORDS_ENDPOINT) },
    ],
    notes,
  };
}
