/* ---------------------------------------------------------------------------
   Claim construction — deterministic, from the stage artifacts.

   No model runs here. Every claim is assembled by code from a field in a JSON
   artifact, and every numeral in every statement traces to a value that a
   named API returned and the cache still holds. That is what makes the
   "never invent a metric" rule mechanical rather than aspirational: there is
   no code path in this file capable of producing a number that did not arrive
   from outside it.

   Where the subject's own words are used, they are quoted verbatim and cited
   to the page they came from. Where arithmetic is needed and we lack the
   inputs, the inputs become declared blanks and the reader does the sum. We
   never characterise their operation in our own words and then attach a number
   to the characterisation.

   ONE NON-OBVIOUS HAZARD, and it is the reason `sanitize()` exists.

   Scraped prose and Perplexity output both contain square brackets — footnote
   markers, editorial insertions, "[sic]", markdown leftovers. `validateClaim`
   reads `[anything]` as a declared-blank token, so an unsanitised quotation
   containing a bracket becomes a claim with an undeclared placeholder and is
   rejected for a reason that has nothing to do with its actual quality. So
   every piece of borrowed text is stripped of brackets *before* our own
   placeholders are composed in. Order matters here: sanitise first, then
   build.
--------------------------------------------------------------------------- */

import type { Claim, Source } from '../lib/claim.ts';
import type { SubjectArtifact } from './01-subject.ts';
import type { PeersArtifact } from './02-peers.ts';
import type { PeerEvidenceArtifact } from './03-peer-evidence.ts';
import type { DemandArtifact } from './04-demand.ts';
import { KEYWORD_OVERVIEW_ENDPOINT, RANKED_KEYWORDS_ENDPOINT } from './04-demand.ts';
import { sourceUrlFor } from '../lib/clients/dataforseo.ts';
import { categoryOverlap, categoryTerms } from '../lib/domain.ts';

/**
 * Make borrowed text safe to embed. Brackets become parentheses rather than
 * disappearing, so a quotation stays readable and stops being able to
 * masquerade as a declared blank.
 */
export function sanitize(text: string): string {
  return text
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trim a quotation to something a reader will actually read. */
function shorten(text: string, max = 220): string {
  const clean = sanitize(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

function pageSource(url: string, retrievedAt: string, title?: string): Source {
  return { url, title: title ? sanitize(title).slice(0, 120) : undefined, retrievedAt };
}

const CATEGORY_LABEL: Record<string, string> = {
  home: 'homepage',
  help: 'help and support pages',
  careers: 'careers page',
  integrations: 'integrations page',
  pricing: 'pricing and ordering pages',
  company: 'about page',
  product: 'products page',
  other: 'site',
};

/* -- stage 01: observed ------------------------------------------------- */

/**
 * The subject's own words about manual steps, quoted and cited.
 *
 * These are `context` rather than `threat`: a page saying "call us to order"
 * is a fact about their operation, and framing their own website as a threat
 * in the first section is a tonal mistake that loses the reader. The threat
 * framing belongs to what competitors are doing.
 */
export function observedClaimsFrom(subject: SubjectArtifact, manualLimit = 5): Claim[] {
  const claims: Claim[] = [];
  const retrievedAt = subject.crawledAt;
  let n = 0;

  // Deduplicated by matched phrase across the whole site and capped.
  //
  // The live hpsrx.com run rendered twelve of these, all opening with the same
  // clause, because "call us" and "we will contact you" appear on the ordering
  // page, the payment page, the contact page and the homepage. Each one was
  // true and sourced; together they read as padding, and a reader who skims
  // the fourth identical bullet stops reading the section.
  const seenPhrases = new Set<string>();
  for (const page of subject.pages) {
    if (page.skipped) continue;
    if (n >= manualLimit) break;
    const label = CATEGORY_LABEL[page.category] ?? 'site';
    const source = pageSource(page.url, retrievedAt, page.title);

    for (const quote of page.manualWorkQuotes) {
      if (n >= manualLimit) break;
      if (seenPhrases.has(quote.phrase)) continue;
      seenPhrases.add(quote.phrase);
      n += 1;
      claims.push({
        id: `obs-manual-${n}`,
        tier: 'observed',
        angle: 'context',
        subject: 'self',
        // Phrased to avoid subject-verb agreement with the label: "help and
        // support pages describes" appeared in every report before this.
        statement: `Your ${label} describe a step that a person does by hand: "${shorten(quote.quote)}"`,
        sources: [source],
        confidence: 'high',
        internalOnly: page.category === 'careers',
      });
    }
  }

  // Systems of record, deduplicated across the site. A named system is an
  // integration surface, which is the most actionable thing on a brochure site.
  const systems = [...new Set(subject.pages.flatMap((p) => (p.skipped ? [] : p.systemsNamed)))];
  if (systems.length > 0) {
    const page = subject.pages.find((p) => !p.skipped && p.systemsNamed.length > 0)!;
    claims.push({
      id: 'obs-systems',
      tier: 'observed',
      angle: 'opportunity',
      subject: 'self',
      statement:
        `Your site mentions the systems your work already runs through: ` +
        `${systems.map((s) => sanitize(s)).join(', ')}. Anything already in one of those is easier ` +
        `to hand to software than something that isn't.`,
      sources: [pageSource(page.url, retrievedAt, page.title)],
      confidence: 'high',
    });
  }

  // Hiring. Role titles are their own words about work they intend to add.
  const careers = subject.pages.find((p) => !p.skipped && p.category === 'careers' && p.roleLines.length > 0);
  if (careers) {
    const roles = careers.roleLines.slice(0, 5).map((r) => sanitize(r));
    claims.push({
      id: 'obs-hiring',
      tier: 'observed',
      angle: 'opportunity',
      subject: 'self',
      // Signal for the analyst, never a bullet for the client.
      internalOnly: true,
      statement:
        `Your careers page lists these roles: ${roles.join('; ')}. What a company hires for says ` +
        `a lot about which work is under strain.`,
      sources: [pageSource(careers.url, retrievedAt, careers.title)],
      confidence: 'medium',
    });
  }

  // Whether they talk about AI at all. Silence is a finding on both sides:
  // a competitor's customer reading their site sees the same silence.
  const aiPages = subject.pages.filter((p) => !p.skipped && p.aiTermsFound.length > 0);
  if (aiPages.length === 0 && subject.pagesCrawled > 0) {
    claims.push({
      id: 'obs-no-ai-language',
      tier: 'observed',
      angle: 'threat',
      subject: 'self',
      statement:
        `None of the pages we read mention AI, automation or machine learning. You may well be ` +
        `doing something internally, but a customer comparing you with a competitor who talks ` +
        `about it won't know that.`,
      sources: [pageSource(`https://${subject.domain}`, retrievedAt)],
      confidence: 'medium',
    });
  } else if (aiPages.length > 0) {
    const page = aiPages[0];
    claims.push({
      id: 'obs-ai-language',
      tier: 'observed',
      angle: 'context',
      subject: 'self',
      statement:
        `Your site already talks about automation. It uses the words ` +
        `${[...new Set(aiPages.flatMap((p) => p.aiTermsFound))].slice(0, 6).map((t) => `"${sanitize(t)}"`).join(', ')}, ` +
        `so this isn't a subject you'd be raising with your market for the first time.`,
      sources: [pageSource(page.url, retrievedAt, page.title)],
      confidence: 'medium',
    });
  }

  return claims;
}

/**
 * The arithmetic we cannot finish. One per manual-work quote, capped.
 *
 * The quote is sourced; the sum is not attempted. Every number in the sentence
 * is a declared blank, so the reader fills them in and reaches their own
 * figure — which is both honest and more persuasive than a figure of ours,
 * and turns the blanks into the agenda for the call.
 */
export function hypothesisClaimsFrom(subject: SubjectArtifact, limit = 3): Claim[] {
  const claims: Claim[] = [];
  const seen = new Set<string>();

  for (const page of subject.pages) {
    if (page.skipped) continue;
    for (const quote of page.manualWorkQuotes) {
      if (claims.length >= limit) return claims;
      const key = quote.phrase;
      if (seen.has(key)) continue;
      seen.add(key);

      const n = claims.length + 1;
      claims.push({
        id: `hyp-${n}`,
        tier: 'hypothesis',
        angle: 'opportunity',
        subject: 'self',
        statement:
          `From your ${CATEGORY_LABEL[page.category] ?? 'site'}: "${shorten(quote.quote, 180)}" ` +
          `If that step happens [timesPerMonth${n}] times a month and takes ` +
          `[minutesEach${n}] minutes of someone's attention each time, it costs you ` +
          `[hoursPerYear${n}] hours a year.`,
        sources: [pageSource(page.url, subject.crawledAt, page.title)],
        missingVariables: [
          { key: `timesPerMonth${n}`, label: `how often that step runs`, unit: 'per month' },
          { key: `minutesEach${n}`, label: `how long it takes each time`, unit: 'minutes' },
          { key: `hoursPerYear${n}`, label: `the annual total those two produce`, unit: 'hours/year' },
        ],
        confidence: 'low',
        internalOnly: page.category === 'careers',
      });
    }
  }
  return claims;
}

/* -- stage 03: comparative ---------------------------------------------- */

/**
 * Peer AI moves. Already gated for citation integrity in stage 03 — every item
 * arriving here carries a real URL and a real publication date — so this
 * function only has to render, never to judge.
 */
export function comparativeClaimsFrom(evidence: PeerEvidenceArtifact): Claim[] {
  const claims: Claim[] = [];
  let n = 0;

  for (const peer of evidence.peers) {
    for (const item of peer.items) {
      n += 1;
      claims.push({
        id: `cmp-${n}`,
        tier: 'comparative',
        angle: 'threat',
        subject: 'peer',
        peerName: sanitize(item.peerName),
        statement: sanitize(item.statement),
        observedAt: item.observedAt,
        /* Perplexity resolved the citation; nobody here opened the page. */
        readOnPage: false,
        sources: item.citations.map((c) => ({
          url: c.url,
          title: c.title ? sanitize(c.title).slice(0, 120) : undefined,
          publisher: c.publisher ? sanitize(c.publisher) : undefined,
          retrievedAt: evidence.gatheredAt,
        })),
        confidence: peer.confidence === 'low' ? 'low' : 'medium',
      });
    }

    // The peer's own words on their own site.
    for (const quote of (peer.ownSurface?.aiQuotes ?? []).slice(0, 1)) {
      n += 1;
      claims.push({
        id: `cmp-${n}`,
        tier: 'comparative',
        angle: 'threat',
        subject: 'peer',
        peerName: sanitize(peer.peerName),
        statement: `says on its own site: "${shorten(quote.quote)}"`,
        readOnPage: true,
        sources: [pageSource(quote.url, evidence.gatheredAt)],
        confidence: peer.confidence === 'low' ? 'low' : 'medium',
      });
    }
  }

  return claims;
}

/* -- stage 04: demand --------------------------------------------------- */

/**
 * Demand figures, each carrying both dates: our pull and Google's own refresh.
 * The gap between them is usually weeks, and a report that shows only the
 * first implies a freshness the data does not have.
 */
export function demandClaimsFrom(demand: DemandArtifact): Claim[] {
  const claims: Claim[] = [];
  const pulled = demand.pulledAt.slice(0, 10);
  const overviewSource = (term: string, lastUpdated: string | null): Source => ({
    url: sourceUrlFor(KEYWORD_OVERVIEW_ENDPOINT),
    title: `DataForSEO Labs keyword_overview — "${sanitize(term)}"${lastUpdated ? `, Google data of ${lastUpdated}` : ''}`,
    publisher: 'DataForSEO (Google Ads data)',
    retrievedAt: demand.pulledAt,
  });

  // Rank by volume so the report leads with the terms that matter.
  const withVolume = demand.terms
    .filter((t) => (t.searchVolume ?? 0) > 0)
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));

  let n = 0;
  for (const term of withVolume.slice(0, 5)) {
    n += 1;
    const bits = [`${term.searchVolume} US searches a month`];
    if (term.cpc !== null) bits.push(`$${term.cpc} cost-per-click`);
    if (term.difficulty !== null) bits.push(`keyword difficulty ${term.difficulty}`);
    const stamp = term.dataLastUpdated
      ? `Google data last refreshed ${term.dataLastUpdated}, pulled ${pulled}`
      : `pulled ${pulled}, Google refresh date not reported`;

    claims.push({
      id: `dem-${n}`,
      tier: 'observed',
      angle: 'context',
      subject: 'self',
      statement:
        `"${sanitize(term.keyword)}" gets ${bits.join(', ')}` +
        `${term.intent ? `. Most of those searches look ${sanitize(term.intent)}` : ''} (${stamp}).`,
      sources: [overviewSource(term.keyword, term.dataLastUpdated)],
      confidence: 'high',
    });
  }

  // Trends, where the series was long enough to compute one.
  let t = 0;
  for (const term of withVolume) {
    if (!term.trend || term.trend.direction === 'flat') continue;
    if (t >= 3) break;
    t += 1;
    const tr = term.trend;
    claims.push({
      id: `dem-trend-${t}`,
      tier: 'observed',
      angle: tr.direction === 'rising' ? 'opportunity' : 'threat',
      subject: 'self',
      statement:
        `Searches for "${sanitize(term.keyword)}" are ${tr.direction}. The last 12 months averaged ` +
        `${tr.recentMean} a month against ${tr.priorMean} the 12 months before, a change of ` +
        `${tr.changePct}% across ${tr.monthsCompared} months of Google's own numbers ` +
        `(${term.dataLastUpdated ? `data from ${term.dataLastUpdated}, ` : ''}pulled ${pulled}).`,
      sources: [overviewSource(term.keyword, term.dataLastUpdated)],
      confidence: 'high',
    });
  }

  // What peers rank for. Their visibility is a fact about the market.
  const rankedSource: Source = {
    url: sourceUrlFor(RANKED_KEYWORDS_ENDPOINT),
    title: 'DataForSEO Labs ranked_keywords',
    publisher: 'DataForSEO (Google SERP data)',
    retrievedAt: demand.pulledAt,
  };

  /**
   * An example ranked term is only worth printing if it is a term a buyer in
   * this category would search, and if the peer actually ranks where anyone
   * would see it.
   *
   * Sorting purely by volume surfaced the long tail instead. The live runs
   * printed Care Hospice ranking "bmi index chart for females" at position 86,
   * and AMSCO Medical ranking "djo global" at position 49, as competitive
   * signals. Both figures were real; neither is a threat. Position 86 is not
   * visibility, and a term unrelated to the category is not competition.
   */
  const terms = categoryTerms(demand.categoryQuery);
  const RELEVANT_RANK_LIMIT = 20;

  for (const total of demand.peerTotals.filter((p) => p.rankingKeywords > 0).slice(0, 3)) {
    const top = demand.peerRanked
      .filter((r) => r.peerDomain === total.peerDomain)
      .filter((r) => (r.searchVolume ?? 0) > 0)
      .filter((r) => (r.rank ?? 999) <= RELEVANT_RANK_LIMIT)
      .filter((r) => terms.length === 0 || categoryOverlap(r.keyword, terms).length > 0)
      .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))[0];

    claims.push({
      id: `dem-peer-${total.peerDomain.replace(/[^a-z0-9]/gi, '-')}`,
      tier: 'comparative',
      angle: 'threat',
      subject: 'peer',
      peerName: total.peerDomain,
      statement:
        `ranks for ${total.rankingKeywords} US Google search terms` +
        `${
          top
            ? `, including "${sanitize(top.keyword)}" at position ${top.rank}, on a term ` +
              `searched ${top.searchVolume} times a month`
            : `, but none in the top ${RELEVANT_RANK_LIMIT} for a term in your category`
        } (pulled ${pulled}).`,
      sources: [rankedSource],
      confidence: 'medium',
    });
  }

  return claims;
}

/* -- assembly ----------------------------------------------------------- */

export interface BuildInput {
  subject: SubjectArtifact;
  peers: PeersArtifact | null;
  evidence: PeerEvidenceArtifact | null;
  demand: DemandArtifact | null;
}

/**
 * Every claim a run supports, in reading order. Deduplicated on statement
 * text, because the same manual-work phrase often appears on several pages and
 * a report that says the same thing three times reads as padding.
 */
export function buildClaims(input: BuildInput): Claim[] {
  const all = [
    ...observedClaimsFrom(input.subject),
    ...(input.evidence ? comparativeClaimsFrom(input.evidence) : []),
    ...(input.demand ? demandClaimsFrom(input.demand) : []),
    ...hypothesisClaimsFrom(input.subject),
  ];

  const seen = new Set<string>();
  const out: Claim[] = [];
  for (const claim of all) {
    const key = `${claim.peerName ?? ''}|${claim.statement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(claim);
  }
  return out;
}

/** Coverage inputs, counted from the artifacts and the validated claims. */
export function coverageFrom(
  input: BuildInput,
  renderable: Claim[]
): {
  pagesCrawled: number;
  peersIdentified: number;
  peersWithDatedAiEvidence: number;
  observedClaims: number;
  comparativeClaims: number;
} {
  return {
    pagesCrawled: input.subject.pagesCrawled,
    peersIdentified: input.peers?.peers.length ?? 0,
    peersWithDatedAiEvidence: input.evidence?.peersWithDatedAiEvidence ?? 0,
    observedClaims: renderable.filter((c) => c.tier === 'observed').length,
    /* Peer evidence only. Stage 03b makes `comparative` claims about the
       subject from third-party reporting, and those are real evidence but they
       are not what this minimum is for: it asks whether we know enough about
       comparable companies to reason from. Counting press about the target here
       would let a well-covered company look like a well-researched category. */
    comparativeClaims: renderable.filter((c) => c.tier === 'comparative' && c.subject === 'peer').length,
  };
}
