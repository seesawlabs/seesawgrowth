/* ---------------------------------------------------------------------------
   Tests for the parts that don't need network access: the claim validator, the
   coverage score, and report assembly.

   Run: npm test  (node --experimental-strip-types, no build step)
--------------------------------------------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COVERAGE_MINIMUMS,
  partitionClaims,
  scoreCoverage,
  validateClaim,
  type Claim,
} from './lib/claim.ts';
import { cacheKey } from './lib/cache.ts';
import { assembleReport } from './stages/05-assemble.ts';
import { FIXTURE_BAD_CLAIMS, FIXTURE_CLAIMS, FIXTURE_META } from './fixtures/prototype.ts';

const codesFor = (c: Claim) => validateClaim(c).map((p) => p.code);

test('every good fixture claim validates', () => {
  for (const claim of FIXTURE_CLAIMS) {
    assert.deepEqual(validateClaim(claim), [], `${claim.id} should be clean`);
  }
});

test('an unsourced numeral is rejected — the core rule', () => {
  const [bad] = FIXTURE_BAD_CLAIMS;
  const codes = codesFor(bad);
  assert.ok(codes.includes('unsourced_numeral'), `got ${codes.join(',')}`);
  assert.ok(codes.includes('missing_source'));
});

test('a placeholder that is not declared is rejected', () => {
  const codes = codesFor(FIXTURE_BAD_CLAIMS[1]);
  assert.ok(codes.includes('undeclared_placeholder'), `got ${codes.join(',')}`);
});

test('a peer claim with no peer named is rejected', () => {
  assert.ok(codesFor(FIXTURE_BAD_CLAIMS[2]).includes('peer_without_name'));
});

test('placeholders satisfy the numeral rule without a source', () => {
  const claim: Claim = {
    id: 'h',
    tier: 'hypothesis',
    angle: 'opportunity',
    subject: 'self',
    statement: 'At [perMonth] a month that is [hoursPerYear] hours.',
    sources: [],
    missingVariables: [
      { key: 'perMonth', label: 'volume per month' },
      { key: 'hoursPerYear', label: 'annual hours' },
    ],
  };
  assert.deepEqual(validateClaim(claim), []);
});

test('a declared variable never used is caught', () => {
  const claim: Claim = {
    id: 'h2',
    tier: 'hypothesis',
    angle: 'opportunity',
    subject: 'self',
    statement: 'No placeholders here at all.',
    sources: [],
    missingVariables: [{ key: 'ghost', label: 'unused' }],
  };
  assert.ok(codesFor(claim).includes('unused_variable'));
});

test('a non-http source URL is rejected', () => {
  const claim: Claim = {
    id: 'u',
    tier: 'observed',
    angle: 'context',
    subject: 'self',
    statement: 'Something with no numbers.',
    sources: [{ url: 'javascript:alert(1)', retrievedAt: '2026-08-19' }],
  };
  assert.ok(codesFor(claim).includes('bad_source_url'));
});

test('a dated peer move needs its source — strictness is intended', () => {
  const claim: Claim = {
    id: 'd',
    tier: 'comparative',
    angle: 'threat',
    subject: 'peer',
    peerName: 'Peer',
    statement: 'shipped an assistant in March 2026.',
    sources: [],
  };
  const codes = codesFor(claim);
  assert.ok(codes.includes('unsourced_numeral'), '2026 is a numeral and must be cited');
});

test('coverage is insufficient when a minimum is missed', () => {
  const c = scoreCoverage({
    pagesCrawled: 12,
    peersIdentified: 4,
    peersWithDatedAiEvidence: 0, // below the minimum of 1
    observedClaims: 6,
    comparativeClaims: 4,
  });
  assert.equal(c.sufficient, false);
  assert.ok(c.shortfalls.some((s) => s.startsWith('peersWithDatedAiEvidence')));
  // Exactly 0.8: four of five minimums fully met, the fifth at zero. Lowering
  // the peer-evidence minimum to 1 means a miss there now contributes nothing
  // rather than half, so the boundary sits on 0.8 instead of above it.
  assert.ok(c.score >= 0.8, `one near miss should still score high, got ${c.score}`);
});

test('one dated peer move is enough to send, none is not', () => {
  // The threshold moved from two to one once stage 06 existed: sparseness in a
  // category is a finding an analyst can use, but zero peer moves leaves no
  // comparative claim to reason from at all.
  const base = {
    pagesCrawled: 12,
    peersIdentified: 8,
    observedClaims: 16,
    comparativeClaims: 3,
  };
  assert.equal(scoreCoverage({ ...base, peersWithDatedAiEvidence: 1 }).sufficient, true);
  assert.equal(scoreCoverage({ ...base, peersWithDatedAiEvidence: 0 }).sufficient, false);
  assert.equal(COVERAGE_MINIMUMS.peersWithDatedAiEvidence, 1);
});

test('coverage is sufficient exactly at the minimums', () => {
  const c = scoreCoverage({ ...COVERAGE_MINIMUMS });
  assert.equal(c.sufficient, true);
  assert.equal(c.score, 1);
});

test('cache keys are stable regardless of request key order', () => {
  assert.equal(
    cacheKey('exa', { query: 'a', numResults: 5 }),
    cacheKey('exa', { numResults: 5, query: 'a' })
  );
  assert.notEqual(cacheKey('exa', { query: 'a' }), cacheKey('exa', { query: 'b' }));
});

test('assembly renders good claims and drops bad ones', () => {
  const coverage = scoreCoverage({
    pagesCrawled: 9,
    peersIdentified: 4,
    peersWithDatedAiEvidence: 2,
    observedClaims: 4,
    comparativeClaims: 3,
  });
  const { markdown, rejected } = assembleReport({
    meta: FIXTURE_META,
    claims: [...FIXTURE_CLAIMS, ...FIXTURE_BAD_CLAIMS],
    coverage,
    syntheticNotice: 'SYNTHETIC FIXTURE — not a real company.',
  });

  assert.equal(rejected.length, FIXTURE_BAD_CLAIMS.length);
  assert.ok(!markdown.includes('30 hours a week'), 'fabricated figure must not render');

  // The sections that carry the value proposition.
  assert.ok(markdown.includes('Where AI is creating opportunity for you'));
  assert.ok(markdown.includes('Where AI is a threat to you'));
  assert.ok(markdown.includes("The arithmetic we couldn't finish"));
  assert.ok(markdown.includes("What we couldn't determine"));

  // Blanks survive to the page, and the ask is spelled out.
  assert.ok(markdown.includes('[checksPerMonth]'));
  assert.ok(markdown.includes("We'd need from you:"));

  // Every rendered source is footnoted with its retrieval date.
  assert.ok(markdown.includes('[^1]:'));
  assert.ok(markdown.includes('retrieved 2026-08-19'));
});

test('insufficient coverage is stated in the report itself', () => {
  const coverage = scoreCoverage({
    pagesCrawled: 1,
    peersIdentified: 0,
    peersWithDatedAiEvidence: 0,
    observedClaims: 1,
    comparativeClaims: 0,
  });
  const { markdown } = assembleReport({ meta: FIXTURE_META, claims: FIXTURE_CLAIMS, coverage });
  assert.ok(markdown.includes('INSUFFICIENT'));
});

/* ===========================================================================
   Stage 02 — the off-category filter.

   This filter shipped untested. The live /search probe that informed stage 02
   did not request `contents`, so no candidate carried `text`, so the branch
   guarded by `result.text` never executed in a real run and the rejection
   never fired once. Both generators now request `contents.text` and a live
   re-probe on 2026-08-24 confirmed 1200 chars of text on every result at no
   extra cost (costDollars.total 0.007, search only).

   These tests pin the behaviour that probe unblocked.
   ======================================================================== */

import { categoryOverlap, categoryTerms, isNearMissDomain } from './lib/domain.ts';
import { filterCandidates } from './stages/02-peers.ts';
import type { ExaResult } from './lib/clients/exa.ts';

const exa = (url: string, title: string, text?: string): ExaResult => ({ id: url, url, title, text });

const PHARMA_CATEGORY =
  'regional distributor supplying pharmaceutical, medical and surgical products to clinics, ' +
  'physician offices and surgery centers';

test('off-category filter fires: an IVF clinic is rejected from a pharma distributor search', () => {
  const candidates = [
    {
      result: exa(
        'https://exampleclinic.com',
        'Example Fertility Clinic',
        'Our fertility centre offers IVF, egg freezing, embryo transfer and donor programmes ' +
          'with dedicated nursing staff and counselling for intended parents.'
      ),
      generator: 'category-search' as const,
    },
  ];

  const { peers, rejected } = filterCandidates(candidates, 'hpsrx.com', 'HPSRx Enterprises', {
    categoryQuery: PHARMA_CATEGORY,
  });

  assert.equal(peers.length, 0, 'the clinic should not survive');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, 'off_category');
});

test('off-category filter keeps a genuine peer in the same category', () => {
  const candidates = [
    {
      result: exa(
        'https://premiumrx.com',
        'Premium Rx National',
        'A national distributor of pharmaceutical and surgical products serving physician ' +
          'offices, clinics and surgery centers across the United States.'
      ),
      generator: 'category-search' as const,
    },
  ];

  const { peers, rejected } = filterCandidates(candidates, 'hpsrx.com', 'HPSRx Enterprises', {
    categoryQuery: PHARMA_CATEGORY,
  });

  assert.equal(peers.length, 1, `expected a survivor, rejected: ${JSON.stringify(rejected)}`);
  assert.equal(peers[0].domain, 'premiumrx.com');
  assert.equal(peers[0].confidence, 'medium', 'category-search alone is medium');
});

test('off-category filter cannot fire without candidate text — the original gap', () => {
  // Exactly the situation the first probe left behind: no contents requested,
  // so no text, so the filter is a no-op and an off-category candidate sails
  // through. This test documents why requesting contents.text is mandatory.
  const noText = [{ result: exa('https://exampleclinic.com', 'Example Fertility Clinic'), generator: 'category-search' as const }];
  const { peers } = filterCandidates(noText, 'hpsrx.com', 'HPSRx Enterprises', {
    categoryQuery: PHARMA_CATEGORY,
  });
  assert.equal(peers.length, 1, 'without text the filter has nothing to test against');
});

test('category terms drop generic business vocabulary', () => {
  const terms = categoryTerms('A leading company offering a broad range of quality products and services');
  assert.deepEqual(terms, [], 'that sentence says nothing category-specific');
});

test('category overlap stems trailing plurals', () => {
  const terms = categoryTerms('supplying clinics and surgery centers');
  const overlap = categoryOverlap('our clinic serves one surgery center', terms);
  assert.ok(overlap.includes('clinic'), `got ${overlap.join(',')}`);
  assert.ok(overlap.includes('center'), `got ${overlap.join(',')}`);
});

test('a page naming the subject is rejected before the category check', () => {
  const candidates = [
    {
      result: exa(
        'https://randomblog.example.com/post',
        'Distributor roundup',
        'HPSRx Enterprises is a pharmaceutical distributor serving clinics and surgery centers.'
      ),
      generator: 'find-similar' as const,
    },
  ];
  const { peers, rejected } = filterCandidates(candidates, 'hpsrx.com', 'HPSRx Enterprises', {
    categoryQuery: PHARMA_CATEGORY,
  });
  assert.equal(peers.length, 0);
  assert.equal(rejected[0].reason, 'names_the_subject');
});

/* ===========================================================================
   Stage 03 — the two live citation-integrity failures.
   ======================================================================== */

import {
  evidenceFromAnswer,
  mentionsAi,
  yearsIn,
  attributesToPeer,
  describesAction,
} from './stages/03-peer-evidence.ts';
import { mapWithConcurrency } from './lib/concurrency.ts';

test('near-miss domain gate: medi-gyn.com cited for medgyn.com is dropped', () => {
  // The exact failure observed live on 2026-08-24.
  assert.ok(isNearMissDomain('https://medi-gyn.com/news', 'medgyn.com'), 'near miss must be detected');

  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: 'MedGyn deployed an AI-assisted inventory automation system in 2025.[1]',
        citations: [
          { marker: 1, url: 'https://medi-gyn.com/press/ai-inventory', date: '2025-06-01', title: 'AI inventory' },
        ],
      },
    ],
    { name: 'MedGyn Products', domain: 'medgyn.com' }
  );

  assert.equal(items.length, 0, 'a near-miss citation must never produce a claim');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].reason, 'near_miss_domain');
});

test('year mismatch gate: prose saying 2026 for a source dated 2025-07-31 is dropped', () => {
  // The second failure observed live: the summary asserted a year the source
  // it cited did not support.
  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: 'In 2026 the company rolled out an AI-driven order automation platform.[1]',
        citations: [
          { marker: 1, url: 'https://premiumrx.com/news/automation', date: '2025-07-31', title: 'Automation' },
        ],
      },
    ],
    { name: 'Premium Rx National', domain: 'premiumrx.com' }
  );

  assert.equal(items.length, 0, 'a contradicted year must not be repaired into a claim');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].reason, 'year_mismatch');
  assert.match(dropped[0].detail, /2025/);
});

test("observedAt comes from the source's date, never from the prose", () => {
  const { items } = evidenceFromAnswer(
    [
      {
        text: 'Premium Rx launched an automation platform in 2025.[1]',
        citations: [
          { marker: 1, url: 'https://premiumrx.com/news/automation', date: '2025-07-31', title: 'Automation' },
        ],
      },
    ],
    { name: 'Premium Rx National', domain: 'premiumrx.com' }
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].observedAt, '2025-07-31', 'the source date wins');
});

test('a statement with no dated source is dropped', () => {
  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: 'The company uses AI to automate order processing across its warehouses.[1]',
        citations: [{ marker: 1, url: 'https://premiumrx.com/tech', title: 'Tech' }],
      },
    ],
    { name: 'Premium Rx National', domain: 'premiumrx.com' }
  );
  assert.equal(items.length, 0);
  assert.equal(dropped[0].reason, 'no_source_date');
});

test('a statement with no AI content is dropped even when perfectly sourced', () => {
  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: 'Premium Rx opened a new distribution centre in Ohio.[1]',
        citations: [{ marker: 1, url: 'https://premiumrx.com/news/ohio', date: '2026-01-15' }],
      },
    ],
    { name: 'Premium Rx National', domain: 'premiumrx.com' }
  );
  assert.equal(items.length, 0);
  assert.equal(dropped[0].reason, 'not_about_ai');
});

test('a statement that names no peer is dropped as unattributable', () => {
  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: 'The distribution sector is broadly adopting AI for demand forecasting.[1]',
        citations: [{ marker: 1, url: 'https://tradejournal.example.com/ai', date: '2026-02-01' }],
      },
    ],
    { name: 'Premium Rx National', domain: 'premiumrx.com' }
  );
  assert.equal(items.length, 0);
  assert.equal(dropped[0].reason, 'does_not_name_peer');
});

test('a source on the peer own domain attributes the claim without naming them', () => {
  assert.ok(
    attributesToPeer('The platform now automates order intake.', [
      { marker: 1, url: 'https://premiumrx.com/news/x', date: '2026-01-01' },
    ], { name: 'Premium Rx National', domain: 'premiumrx.com' })
  );
});

test('mentionsAi does not fire on substrings', () => {
  assert.ok(!mentionsAi('We supply pharmaceuticals to clinics in Cairo.'), '"Cairo" must not read as AI');
  assert.ok(!mentionsAi('Our retail chain serves the region.'), '"chain" must not read as AI');
  assert.ok(mentionsAi('We deployed an AI assistant.'));
  assert.ok(mentionsAi('Warehouse automation went live.'));
});

test('yearsIn finds asserted years', () => {
  assert.deepEqual(yearsIn('Launched in 2025, expanded in 2026.'), [2025, 2026]);
  assert.deepEqual(yearsIn('A 6-step process taking 45 minutes.'), []);
});

/* ===========================================================================
   Claim construction — the bracket hazard, and the never-invent-a-metric rule
   holding end to end.
   ======================================================================== */

import { sanitize, buildClaims, coverageFrom, observedClaimsFrom, demandClaimsFrom } from './stages/claims.ts';
import type { SubjectArtifact } from './stages/01-subject.ts';

test('sanitize neutralises brackets so a quotation cannot fake a declared blank', () => {
  const quoted = sanitize('Orders ship in 2 business days [sic] after approval [1].');
  assert.ok(!quoted.includes('['), 'no brackets may survive');
  assert.ok(quoted.includes('(sic)'));
});

const THIN_SUBJECT: SubjectArtifact = {
  domain: 'example.com',
  effectiveDomain: 'example.com',
  crawledAt: '2026-08-24T00:00:00.000Z',
  robots: { host: 'example.com', published: false, disallowRules: 0 },
  mapped: 3,
  selected: [],
  pages: [
    {
      url: 'https://example.com/',
      category: 'home',
      wordCount: 120,
      manualWorkQuotes: [{ phrase: 'call us', quote: 'Call us to place an order [1] within 2 business days.' }],
      systemsNamed: [],
      aiTermsFound: [],
      roleLines: [],
    },
  ],
  pagesCrawled: 1,
  categoryQuery: { query: 'x', seedText: 'x', derivedFrom: 'test' },
  categoriesMissing: ['help', 'careers', 'integrations', 'pricing'],
  notes: [],
};

test('every built claim passes the validator — brackets in scraped text included', () => {
  const claims = buildClaims({ subject: THIN_SUBJECT, peers: null, evidence: null, demand: null });
  assert.ok(claims.length > 0, 'a thin site still yields something');
  const { renderable, rejected } = partitionClaims(claims);
  assert.deepEqual(
    rejected.map((r) => `${r.claim.id}: ${r.problems.map((p) => p.code).join(',')}`),
    [],
    'construction must never emit an invalid claim'
  );
  assert.equal(renderable.length, claims.length);
});

test('a hypothesis claim declares every blank it uses and uses every blank it declares', () => {
  const claims = buildClaims({ subject: THIN_SUBJECT, peers: null, evidence: null, demand: null });
  const hypotheses = claims.filter((c) => c.tier === 'hypothesis');
  assert.ok(hypotheses.length > 0);
  for (const h of hypotheses) {
    assert.deepEqual(validateClaim(h), [], `${h.id} must be clean`);
    assert.ok((h.missingVariables ?? []).length >= 2, 'the arithmetic needs its inputs named');
  }
});

test('a thin subject fails the coverage threshold', () => {
  const claims = buildClaims({ subject: THIN_SUBJECT, peers: null, evidence: null, demand: null });
  const { renderable } = partitionClaims(claims);
  const coverage = scoreCoverage(
    coverageFrom({ subject: THIN_SUBJECT, peers: null, evidence: null, demand: null }, renderable)
  );
  assert.equal(coverage.sufficient, false, 'one page and no peers must not be sendable');
  assert.ok(coverage.shortfalls.some((s) => s.startsWith('peersIdentified')));
});

/* ===========================================================================
   Stage 04 — trend arithmetic and seed terms.
   ======================================================================== */

import { seedTermsFrom, summarizeTrend, type DemandArtifact } from './stages/04-demand.ts';

/** 24 months, newest first, at a fixed volume then a different one. */
const series = (recent: number, prior: number) => [
  ...Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: 12 - i, search_volume: recent })),
  ...Array.from({ length: 12 }, (_, i) => ({ year: 2025, month: 12 - i, search_volume: prior })),
];

test('trend direction is computed from the series, not asserted', () => {
  assert.equal(summarizeTrend(series(450, 900))?.direction, 'falling');
  assert.equal(summarizeTrend(series(900, 450))?.direction, 'rising');
  assert.equal(summarizeTrend(series(500, 500))?.direction, 'flat');
});

test('a small move counts as flat rather than a trend', () => {
  // Google volume buckets are coarse; calling a 5% move a trend invents a finding.
  assert.equal(summarizeTrend(series(105, 100))?.direction, 'flat');
});

test('a short series yields no trend at all rather than a guess', () => {
  assert.equal(summarizeTrend(series(450, 900).slice(0, 10)), null);
  assert.equal(summarizeTrend([]), null);
  assert.equal(summarizeTrend(undefined), null);
});

test('the falling trend seen live on "pharmacy automation" reproduces', () => {
  const trend = summarizeTrend(series(445, 793));
  assert.equal(trend?.direction, 'falling');
  assert.equal(trend?.recentMean, 445);
  assert.equal(trend?.priorMean, 793);
});

test('seed terms prefer bigrams over single words', () => {
  const terms = seedTermsFrom('regional pharmaceutical distributor supplying surgical products to clinics');
  assert.ok(terms.includes('pharmaceutical distributor'), `got ${terms.join(' | ')}`);
  assert.ok(terms.indexOf('pharmaceutical distributor') < terms.findIndex((t) => !t.includes(' ')));
});

test('seed terms from an empty category description are empty, not invented', () => {
  assert.deepEqual(seedTermsFrom('a leading company offering quality products'), []);
});

/* ===========================================================================
   The cost ledger. Never executed before: lib/budget.ts used constructor
   parameter properties, which node's strip-only TypeScript mode rejects, so
   importing it threw ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX and no test could
   reach it.
   ======================================================================== */

import { BudgetExceeded, Ledger } from './lib/budget.ts';

test('the ledger separates reported spend from estimated spend', () => {
  const ledger = new Ledger(5, 0.00333);
  ledger.reported('exa', 'search', 0.007);
  ledger.reported('dataforseo', 'keyword_overview', 0.01224);
  ledger.fromCredits('scrape', 3);
  ledger.free('firecrawl', 'scrape (cached)');

  assert.equal(Math.round(ledger.spentReported * 100000) / 100000, 0.01924);
  assert.equal(Math.round(ledger.spentEstimated * 100000) / 100000, 0.00999);
  assert.ok(ledger.spent > ledger.spentReported, 'the estimate is included in the total');
});

test('the ledger aborts rather than exceeding the ceiling', () => {
  const ledger = new Ledger(0.01);
  ledger.reported('exa', 'search', 0.009);
  assert.throws(() => ledger.assertHeadroom('another search', 0.03), BudgetExceeded);
});

test('a BudgetExceeded error reports what it refused', () => {
  const error = new BudgetExceeded(4.99, 5, 'perplexity peer lookup');
  assert.equal(error.spent, 4.99);
  assert.equal(error.attempted, 'perplexity peer lookup');
  assert.match(error.message, /refusing "perplexity peer lookup"/);
});

test('a service is labelled estimated if any of its entries were', () => {
  const ledger = new Ledger(5);
  ledger.fromCredits('scrape', 1);
  const firecrawl = ledger.byService().find((s) => s.service === 'firecrawl');
  assert.equal(firecrawl?.basis, 'estimated', 'Firecrawl reports credits, never dollars');
});


/* ===========================================================================
   Cache keys must be total over the request.

   Regression tests for the cache-poisoning bug found on the first live stage
   03 run: `JSON.stringify(request, Object.keys(request).sort())` treats its
   array argument as a recursive property allowlist, so every nested value was
   deleted before hashing. Six different Perplexity prompts hashed to one key
   and five peers were served the first peer's answer.
   ======================================================================== */

import { canonicalize } from './lib/cache.ts';

test('two different Perplexity prompts do not share a cache key', () => {
  const req = (content: string) => ({ model: 'sonar', max_tokens: 700, messages: [{ role: 'user', content }] });
  assert.notEqual(
    cacheKey('perplexity-chat', req('AI initiatives at AMSCO Medical')),
    cacheKey('perplexity-chat', req('AI initiatives at MedGyn Products')),
    'the prompt must reach the hash'
  );
});

test('two different DataForSEO payloads do not share a cache key', () => {
  const req = (target: string) => ({ endpoint: 'ranked_keywords/live', payload: { target, limit: 20 } });
  assert.notEqual(
    cacheKey('dataforseo', req('medgyn.com')),
    cacheKey('dataforseo', req('msdonline.com')),
    'the target must reach the hash'
  );
});

test('canonicalize reaches every level of nesting', () => {
  assert.match(canonicalize({ a: { b: { c: 'deep' } } }), /deep/);
  assert.match(canonicalize({ messages: [{ role: 'user', content: 'hello' }] }), /hello/);
});

test('canonicalize is stable regardless of key insertion order', () => {
  assert.equal(canonicalize({ x: 1, y: { b: 2, a: 3 } }), canonicalize({ y: { a: 3, b: 2 }, x: 1 }));
  assert.equal(cacheKey('exa-search', { q: 'a', n: 1 }), cacheKey('exa-search', { n: 1, q: 'a' }));
});

test('canonicalize distinguishes array order, which is meaningful in a request', () => {
  assert.notEqual(canonicalize({ keywords: ['a', 'b'] }), canonicalize({ keywords: ['b', 'a'] }));
});

/* ===========================================================================
   Two stage 02 defects the first live hpsrx.com run exposed.
   ======================================================================== */

import { deriveCategoryQuery } from './stages/01-subject.ts';
import { isAggregatorHost, isForeignCcTld } from './lib/domain.ts';

const homePage = (description: string) => [
  {
    url: 'https://www.hpsrx.com',
    category: 'home' as const,
    description,
    wordCount: 500,
    manualWorkQuotes: [],
    systemsNamed: [],
    aiTermsFound: [],
    roleLines: [],
  },
];

test('the category query does not begin with an orphaned legal suffix', () => {
  // The live run produced "Inc. is a small specialty distributor in women's
  // health…" and sent that to Exa and to the demand pull as a category.
  const { query } = deriveCategoryQuery(
    homePage(
      "HPSRx Enterprises, Inc. is a small specialty distributor in women's health. " +
        'We provide pharmaceuticals, medical devices, and over-the-counter products.'
    ),
    'hpsrx.com'
  );
  assert.ok(query.startsWith('small specialty distributor'), `got "${query}"`);
  assert.ok(!/^(inc|llc|ltd|corp)\b/i.test(query));
});

test('stacked legal suffixes and a copula are all peeled', () => {
  const { query } = deriveCategoryQuery(
    homePage('HPSRx Enterprises LLC is a distributor of surgical supplies to clinics nationwide.'),
    'hpsrx.com'
  );
  assert.ok(query.startsWith('distributor of surgical supplies'), `got "${query}"`);
});

test('a link-in-bio page is not a company website', () => {
  // linktr.ee survived every filter on the live run and was kept as a peer:
  // it carried a real company name and real category vocabulary, because it
  // was that company's own link page.
  assert.ok(isAggregatorHost('https://linktr.ee/femmepharma'));
  assert.ok(isAggregatorHost('https://beacons.ai/somebrand'));

  const { peers, rejected } = filterCandidates(
    [
      {
        result: exa(
          'https://linktr.ee/femmepharma',
          'FemmePharma Consumer Healthcare',
          'FemmePharma provides pharmaceutical and medical products for women’s health, clinics and surgery centers.'
        ),
        generator: 'category-search' as const,
      },
    ],
    'hpsrx.com',
    'HPSRx Enterprises',
    { categoryQuery: PHARMA_CATEGORY }
  );
  assert.equal(peers.length, 0);
  assert.equal(rejected[0].reason, 'aggregator_host');
});

test('geography filter catches a country code nobody enumerated', () => {
  // The live hpsrx.com run kept bluewater.ky — Cayman Islands — as a peer for
  // a US distributor, because .ky was missing from the old ccTLD denylist.
  assert.ok(isForeignCcTld('https://bluewater.ky'), '.ky is not a US market');
  assert.ok(isForeignCcTld('salamapharma.co.tz'));
  assert.ok(isForeignCcTld('rioclarense.com.br'));
  assert.ok(isForeignCcTld('example.co.uk'));
});

test('geography filter passes generics and the allowed market', () => {
  for (const d of ['hpsrx.com', 'medgyn.com', 'innovahealthsupplies.org', 'someco.io', 'clinic.ai', 'thing.ca', 'x.us']) {
    assert.equal(isForeignCcTld(d), false, `${d} must not be called foreign`);
  }
});

/* ===========================================================================
   Four report-quality defects the first live hpsrx.com report exposed.
   ======================================================================== */

import { assertsAbsence } from './stages/03-peer-evidence.ts';
import { looksLikeNavigation } from './stages/01-subject.ts';

test('an absence of evidence never becomes a dated threat', () => {
  // The live run rendered this under "Where AI is a threat to you", dated,
  // with three real citations. It is Perplexity saying it found nothing.
  const sentence =
    'The company pages returned describe products, quality systems, supply chain, and ' +
    'product development, but do not show dated published AI/ML/automation initiatives ' +
    'for Mazza Healthcare itself.[1]';

  assert.ok(assertsAbsence(sentence), 'absence language must be detected');

  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: sentence,
        citations: [
          { marker: 1, url: 'https://www.mazzahealthcare.com/experience', date: '2016-01-01' },
        ],
      },
    ],
    { name: 'Mazza Healthcare', domain: 'mazzahealthcare.com' }
  );

  assert.equal(items.length, 0, 'a "nothing found" statement is not a competitor move');
  assert.equal(dropped[0].reason, 'asserts_absence');
});

test('absence language is caught even though it mentions AI and cites real sources', () => {
  for (const s of [
    'I found nothing specific and citable about their AI initiatives.',
    'There is no evidence of any AI deployment at the company.',
    'The sources do not mention any machine learning programme.',
    'We were unable to verify the automation rollout.',
  ]) {
    assert.ok(assertsAbsence(s), `should be absence: ${s}`);
  }
});

test('a real AI move is not mistaken for absence language', () => {
  for (const s of [
    'MedGyn launched an AI-powered inventory system in March 2026.',
    'The company deployed robotic process automation across its billing team.',
    'Their automated dispensing platform went live in 2025.',
  ]) {
    assert.equal(assertsAbsence(s), null, `should pass: ${s}`);
  }
});

test('a product menu is not quoted as a description of manual work', () => {
  assert.ok(
    looksLikeNavigation(
      'Tenaculum Hooks Uterine Sounds Forceps Metal Curettes Biopsy Punches Dilators Speculums Scissors'
    ),
    'a run of Title Case nouns is a menu, not prose'
  );
  assert.ok(looksLikeNavigation('Home | About | Contact | Careers'));
  assert.equal(
    looksLikeNavigation('Please call us between 9am - 6pm to speak with a representative or email us.'),
    false,
    'real prose must survive'
  );
});

test('repeated manual-work phrases are capped and deduplicated', () => {
  // "call us" on four pages produced four near-identical bullets in the live run.
  const page = (url: string, category: 'home' | 'pricing' | 'company', phrase: string) => ({
    url,
    category,
    wordCount: 400,
    manualWorkQuotes: [{ phrase, quote: `Please ${phrase} during business hours and we will help you with your order.` }],
    systemsNamed: [],
    aiTermsFound: [],
    roleLines: [],
  });

  const subject: SubjectArtifact = {
    ...THIN_SUBJECT,
    pages: [
      page('https://x.com/', 'home', 'call us'),
      page('https://x.com/pay', 'pricing', 'call us'),
      page('https://x.com/contact', 'company', 'call us'),
    ],
  };

  const manual = observedClaimsFrom(subject).filter((c) => c.id.startsWith('obs-manual'));
  assert.equal(manual.length, 1, 'the same phrase on three pages is one finding');
});

test('claim statements do not disagree with their own subject', () => {
  // "Your help and support pages describes a step…" shipped in every report.
  const claims = buildClaims({ subject: THIN_SUBJECT, peers: null, evidence: null, demand: null });
  for (const c of claims) {
    assert.ok(!/pages describes/.test(c.statement), `agreement error in ${c.id}`);
    assert.ok(!/#/.test(c.statement), `markdown heading marker leaked into ${c.id}`);
  }
});

/* ===========================================================================
   The redirect that broke peer discovery on the live traditionshealth.com run.
   ======================================================================== */

import { dominantDomain, extractSignals, looksLikeScrapeNoise, namesSystem } from './stages/01-subject.ts';

test('the effective domain is read back from the map response', () => {
  // traditionshealth.com 301s to tct-cares.com; all 60 mapped URLs were on the
  // new host, so isHome matched nothing and the homepage was never scraped.
  const links = Array.from({ length: 60 }, (_, i) => ({ url: `https://www.tct-cares.com/page-${i}` }));
  assert.equal(dominantDomain(links), 'tct-cares.com');
  assert.equal(dominantDomain([]), '');
});

test('contact-page boilerplate is not accepted as a category description', () => {
  const contactPage = [
    {
      url: 'https://www.tct-cares.com/contact',
      category: 'company' as const,
      description:
        'Contact us. Our team is available 24 hours a day, 7 days a week to assist patients, ' +
        'caregivers, and health care providers.',
      wordCount: 200,
      manualWorkQuotes: [],
      systemsNamed: [],
      aiTermsFound: [],
      roleLines: [],
    },
  ];
  const { query, derivedFrom } = deriveCategoryQuery(contactPage, 'tct-cares.com');
  assert.ok(!/24 hours a day/.test(query), `contact boilerplate leaked: "${query}"`);
  assert.match(derivedFrom, /fallback/, 'with nothing usable it must say so, not improvise');
});

test('a real self-description still wins over a contact page', () => {
  const pages = [
    {
      url: 'https://www.tct-cares.com/',
      category: 'home' as const,
      description: 'Provider of home health, palliative and hospice care services across multiple states.',
      wordCount: 500,
      manualWorkQuotes: [],
      systemsNamed: [],
      aiTermsFound: [],
      roleLines: [],
    },
    {
      url: 'https://www.tct-cares.com/contact',
      category: 'company' as const,
      description: 'Contact us. Our team is available 24 hours a day, 7 days a week.',
      wordCount: 200,
      manualWorkQuotes: [],
      systemsNamed: [],
      aiTermsFound: [],
      roleLines: [],
    },
  ];
  const { query } = deriveCategoryQuery(pages, 'tct-cares.com');
  assert.match(query, /home health, palliative and hospice/);
});

test('both the old and new brand are stripped after a redirect', () => {
  const pages = [
    {
      url: 'https://www.tct-cares.com/',
      category: 'home' as const,
      description: 'Traditions Health, LLC is a provider of hospice and home health services to patients.',
      wordCount: 500,
      manualWorkQuotes: [],
      systemsNamed: [],
      aiTermsFound: [],
      roleLines: [],
    },
  ];
  const { query } = deriveCategoryQuery(pages, 'tct-cares.com', ['traditionshealth.com']);
  assert.ok(!/traditions/i.test(query), `old brand leaked: "${query}"`);
  assert.match(query, /provider of hospice and home health/);
});

test('a negative finding phrased as a noun denial is dropped', () => {
  // The second shape of the same failure, from the second live hpsrx.com run.
  // It was the one item holding that report's peer-evidence coverage above zero.
  const sentence =
    "The only MedGyn page mentioning AI was a 2025 women's health standards page that " +
    'contains a generic AI disclaimer, not a company initiative.[1]';

  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: sentence,
        citations: [
          { marker: 1, url: 'https://www.medgyn.com/womens-health-standards/', date: '2025-01-29' },
        ],
      },
    ],
    { name: 'MedGyn Products, Inc.', domain: 'medgyn.com' }
  );

  assert.equal(items.length, 0, 'a statement that the peer did nothing is not evidence');
  assert.ok(['asserts_absence', 'no_action_verb'].includes(dropped[0].reason), dropped[0].reason);
});

test('an AI move needs a verb of doing', () => {
  for (const s of [
    'MedGyn launched an AI-powered inventory system in March 2026.',
    'The company deployed robotic process automation across its billing team.',
    'Their automated dispensing platform went live in 2025.',
    'Premium Rx uses machine learning to forecast demand.',
    'The distributor partnered with a vendor to automate order intake.',
  ]) {
    assert.ok(describesAction(s), `should read as a move: ${s}`);
  }

  for (const s of [
    'The page mentioning AI was a standards document.',
    'Their website contains a reference to automation.',
    'The sources describe products and quality systems.',
    'An AI disclaimer appears in the footer.',
  ]) {
    assert.equal(describesAction(s), false, `should not read as a move: ${s}`);
  }
});

/* ===========================================================================
   Stage 04 seed-term quality — the defect that produced real figures about
   nothing on the live traditionshealth.com run.
   ======================================================================== */

test('marketing adjectives never become seed terms', () => {
  // The live run measured US demand for "compassionate", "fast support" and
  // "clear answers", and reported that "clear answers" was up 832%. Every
  // figure was correctly sourced and dated. None was about hospice care.
  const terms = seedTermsFrom(
    'Get compassionate care, fast support, and clear answers from The Care Team, a trusted ' +
      'provider for at-home hospice and palliative care services.',
    8
  );
  for (const junk of ['compassionate', 'fast support', 'clear answers', 'care team', 'trusted']) {
    assert.ok(!terms.includes(junk), `"${junk}" must not be a seed term; got ${terms.join(' | ')}`);
  }
  assert.ok(terms.includes('palliative care') || terms.includes('at-home hospice'), terms.join(' | '));
});

test('bigrams are not formed across punctuation', () => {
  // "…pharmaceuticals, medical devices…" produced "pharmaceuticals medical".
  const terms = seedTermsFrom(
    "specialty distributor in women's health. We provide pharmaceuticals, medical devices, and " +
      'over 90,000 items to clinics.',
    8
  );
  assert.ok(!terms.includes('pharmaceuticals medical'), `crossed a comma: ${terms.join(' | ')}`);
  assert.ok(!terms.some((t) => /^provide /.test(t)), `verb-led pair: ${terms.join(' | ')}`);
  assert.ok(terms.includes('specialty distributor'), terms.join(' | '));
});

test('a malformed token never reaches a paid API call', () => {
  const terms = seedTermsFrom("distributor in women's health and medical devices", 8);
  for (const t of terms) {
    assert.match(t, /^[a-z0-9][a-z0-9 -]*$/, `malformed seed term "${t}"`);
  }
});

test('seed terms attested in the body text are preferred', () => {
  const terms = seedTermsFrom(
    'provider of hospice and palliative care and gourmet catering services',
    8,
    'hospice care hospice team palliative medicine hospice admissions palliative consult'
  );
  // Attestation orders rather than truncates: the attested term must come
  // first, but an unattested one may still fill the quota.
  assert.equal(terms[0], 'hospice', terms.join(' | '));
  assert.ok(terms.indexOf('hospice') < terms.indexOf('gourmet catering'), terms.join(' | '));
});

test('role lines do not carry markdown links', () => {
  // "(Talk to a Care Specialist)(https://www.tct-cares.com/request-care/)"
  // rendered in the live report as a job title.
  const markdown = [
    '- [Talk to a Care Specialist](https://www.tct-cares.com/request-care/)',
    '- Registered Nurse - Hospice',
  ].join('\n');
  const signals = extractSignals(
    { url: 'https://x.com/careers', category: 'careers', weight: 9, matched: 'path:careers' },
    markdown
  );
  for (const line of signals.roleLines) {
    assert.ok(!/https?:\/\//.test(line), `URL leaked into a role line: ${line}`);
    assert.ok(!/\]\(/.test(line), `markdown link leaked: ${line}`);
  }
});

test('escaped markdown does not leak into a quoted claim', () => {
  const signals = extractSignals(
    { url: 'https://x.com/', category: 'home', weight: 100, matched: 'homepage' },
    '\\\\ \\\\ **Request Care Today** \\\\ \\\\ Fill out a care request form or give us a call at 833-483-2273.'
  );
  for (const q of signals.manualWorkQuotes) {
    assert.ok(!q.quote.includes('\\'), `backslash leaked: ${q.quote}`);
    assert.ok(!q.quote.includes('**'), `emphasis leaked: ${q.quote}`);
  }
});

test('an irrelevant long-tail ranking is not printed as a competitive signal', () => {
  // The live runs printed Care Hospice ranking "bmi index chart for females"
  // at position 86, and AMSCO ranking "djo global" at 49, as threats.
  const demand: DemandArtifact = {
    subjectDomain: 'x.com',
    categoryQuery: 'provider of at-home hospice and palliative care services',
    pulledAt: '2026-08-24T00:00:00.000Z',
    account: { login: 'x', balanceUsd: 51 },
    seedTerms: [],
    terms: [],
    peerRanked: [
      { peerDomain: 'carehospice.com', keyword: 'bmi index chart for females', searchVolume: 90500, rank: 86, url: null },
      { peerDomain: 'carehospice.com', keyword: 'hospice care near me', searchVolume: 8100, rank: 7, url: null },
    ],
    peerTotals: [{ peerDomain: 'carehospice.com', rankingKeywords: 524 }],
    sources: [],
    notes: [],
  };

  const claim = demandClaimsFrom(demand).find((c) => c.id.startsWith('dem-peer'))!;
  assert.ok(!/bmi index/.test(claim.statement), `long-tail noise printed: ${claim.statement}`);
  assert.match(claim.statement, /hospice care near me/);
  assert.match(claim.statement, /524 US Google search terms/);
  assert.deepEqual(validateClaim(claim), []);
});

test('a peer with no relevant top-20 term says so rather than reaching', () => {
  const demand: DemandArtifact = {
    subjectDomain: 'x.com',
    categoryQuery: 'provider of at-home hospice and palliative care services',
    pulledAt: '2026-08-24T00:00:00.000Z',
    account: null,
    seedTerms: [],
    terms: [],
    peerRanked: [
      { peerDomain: 'p.com', keyword: 'bmi index chart for females', searchVolume: 90500, rank: 86, url: null },
    ],
    peerTotals: [{ peerDomain: 'p.com', rankingKeywords: 12 }],
    sources: [],
    notes: [],
  };
  const claim = demandClaimsFrom(demand).find((c) => c.id.startsWith('dem-peer'))!;
  assert.match(claim.statement, /none in the top 20/);
  assert.deepEqual(validateClaim(claim), []);
});

test('browser and scrape boilerplate is never quoted as the company own words', () => {
  // The live meridianmedicalsupply.com report attributed an ad-blocker error
  // page to the prospect as a description of their manual process.
  assert.ok(
    looksLikeScrapeNoise(
      'ERR_BLOCKED_BY_CLIENT Reload This page has been blocked by an extension × Contact Us Please fill out this form'
    )
  );
  assert.ok(looksLikeScrapeNoise('Skip to main content Contact Us We are Ready to Help'));
  assert.equal(
    looksLikeScrapeNoise('Please fill out our account application form to get an account started.'),
    false,
    'real prose must survive'
  );

  const signals = extractSignals(
    { url: 'https://x.com/', category: 'home', weight: 100, matched: 'homepage' },
    'ERR_BLOCKED_BY_CLIENT Reload This page has been blocked by an extension × Please fill out this form to contact us.'
  );
  assert.equal(signals.manualWorkQuotes.length, 0, 'the whole quote is scrape noise');
});

test('a generic single word is dropped when a bigram already contains it', () => {
  // The live run measured "medical" (301,000 US searches) alongside
  // "medical supply" — a true figure about the wrong question.
  const terms = seedTermsFrom('locally owned medical supply company offering wholesale medical supply', 8);
  assert.ok(terms.includes('medical supply'), terms.join(' | '));
  assert.ok(!terms.includes('medical'), `redundant single survived: ${terms.join(' | ')}`);
  assert.ok(!terms.includes('supply'), `redundant single survived: ${terms.join(' | ')}`);
});

test('seed text stops after two sentences while the peer query keeps all of it', () => {
  // The live hpsrx.com meta description closed with "…excellent customer
  // service on a first name basis. We are licensed to ship to all 50 states."
  // Stage 04 measured US search demand for "first name" and "excellent customer".
  const { query, seedText } = deriveCategoryQuery(
    homePage(
      "HPSRx Enterprises, Inc. is a small specialty distributor in women's health. " +
        'We provide pharmaceuticals, medical devices, and over 90,000 items of medical supplies. ' +
        'Our dedicated team provides excellent customer service on a first name basis. ' +
        'We are licensed to ship to all 50 states.'
    ),
    'hpsrx.com'
  );
  assert.ok(!/first name/.test(seedText), `filler survived into seed text: "${seedText}"`);
  assert.ok(!/50 states/.test(seedText));
  assert.match(seedText, /specialty distributor/);
  assert.match(seedText, /medical devices/);

  // The peer-discovery query keeps the whole description on purpose: trimming
  // it returned a Zimbabwean distributor in place of AMSCO Medical.
  assert.match(query, /first name basis/, 'peer discovery needs the incidental detail');

  const terms = seedTermsFrom(seedText, 8);
  for (const junk of ['first name', 'name basis', 'excellent customer']) {
    assert.ok(!terms.includes(junk), `"${junk}" reached a paid API call: ${terms.join(' | ')}`);
  }
});

test("an apostrophe does not split a category phrase into a generic single", () => {
  // "women's health" formed no bigram, leaving a bare "health": 450,000 US
  // searches a month at difficulty 100, and not a category anyone sells into.
  const terms = seedTermsFrom("small specialty distributor in women's health and medical devices", 8);
  assert.ok(terms.includes('womens health'), terms.join(' | '));
  assert.ok(!terms.includes('health'), `generic single survived: ${terms.join(' | ')}`);
});

test('a call-to-action with a phone number is not a category description', () => {
  // The live compassus.com run used "Discover the difference. Call
  // 833.380.9583 today to learn more about our in-home hospice and care
  // services." as its category query, and Exa returned six single-location
  // agencies instead of a 300-programme operator's real competitors.
  const ctaPage = [
    {
      url: 'https://www.compassus.com/',
      category: 'home' as const,
      description:
        'Discover the difference. Call 833.380.9583 today to learn more about our in-home hospice and care services.',
      wordCount: 300,
      manualWorkQuotes: [],
      systemsNamed: [],
      aiTermsFound: [],
      roleLines: [],
    },
  ];
  const { query, derivedFrom } = deriveCategoryQuery(ctaPage, 'compassus.com');
  assert.ok(!/833/.test(query), `a phone number reached the category query: "${query}"`);
  assert.ok(!/Discover the difference/i.test(query), `CTA copy survived: "${query}"`);
  assert.match(derivedFrom, /fallback/, 'with nothing usable it must say so');
});

test('a statement disclaiming its own attribution is not peer evidence', () => {
  // The third shape of the negative-finding failure, and the costliest: this
  // claim carried the senderrarx.com run's peer-evidence count from one to two,
  // which is what marked the report sendable at 100% coverage.
  const sentence =
    'The search results surfaced a QuickRx-branded automated prescription pickup product from ' +
    'Bell and Howell, but that is not QuickRx Specialty Pharmacy and should not be attributed to ' +
    'this company.[1]';

  assert.ok(assertsAbsence(sentence), 'a non-attribution disclaimer must be detected');

  const { items, dropped } = evidenceFromAnswer(
    [
      {
        text: sentence,
        citations: [{ marker: 1, url: 'https://bhemea.com/quickrx', date: '2025-01-11' }],
      },
    ],
    { name: 'QuickRx Specialty Pharmacy', domain: 'quickrxspecialty.com' }
  );
  assert.equal(items.length, 0, 'a disclaimer must never become the peer’s initiative');
  assert.equal(dropped[0].reason, 'asserts_absence');
});

test('non-attribution language is caught in its common shapes', () => {
  for (const s of [
    'That product should not be credited to this company.',
    'This is not the same company as the one in the citation.',
    'The tool belongs to another vendor entirely.',
    'Not to be confused with the similarly named firm.',
    'The initiative is run by a different company.',
  ]) {
    assert.ok(assertsAbsence(s), `should be absence: ${s}`);
  }
});

test('blog and listing furniture is not quoted as a manual step', () => {
  assert.ok(
    looksLikeScrapeNoise(
      "4 min read How Specialty Pharmacy Technology is Freeing Nurses' Time Senderra : Mar 6, 2022"
    )
  );
  assert.ok(looksLikeScrapeNoise('Read more about our services and subscribe to our newsletter'));
  assert.equal(
    looksLikeScrapeNoise('All documents are fillable and can be submitted within the Physician Portal.'),
    false
  );
});

test('careers-derived claims are marked internal and never rendered', () => {
  // "Perform all tasks in a safe manner that is consistent with corporate
  // policies" is pharmacy-tech job-advert boilerplate. It rendered as a manual
  // step worth costing.
  const careers = {
    url: 'https://x.com/careers',
    category: 'careers' as const,
    wordCount: 400,
    manualWorkQuotes: [
      { phrase: 'paperwork', quote: 'Maintain current notes and paperwork related to the patient drug therapy and pharmacy care plan.' },
    ],
    systemsNamed: [],
    aiTermsFound: [],
    roleLines: ['Pharmacy Technician'],
  };
  const subject: SubjectArtifact = { ...THIN_SUBJECT, pages: [careers] };
  const claims = buildClaims({ subject, peers: null, evidence: null, demand: null });

  // Quotes and arithmetic derived from the careers page are internal. Site-wide
  // findings like obs-no-ai-language are not — they are about the whole surface,
  // not about a job advert.
  const derived = claims.filter(
    (c) => c.id.startsWith('obs-manual') || c.id.startsWith('hyp-') || c.id === 'obs-hiring'
  );
  assert.ok(derived.length > 0, 'the careers page should yield something');
  for (const c of derived) {
    assert.equal(c.internalOnly, true, `${c.id} came from a careers page and must be internal`);
  }
  assert.equal(
    claims.find((c) => c.id === 'obs-no-ai-language')?.internalOnly,
    undefined,
    'a site-wide finding is not careers-derived'
  );
});

/* ===========================================================================
   The lead-facing renderer.
   ======================================================================== */

import { linkClaimIds } from './render/report-html.ts';
import { normaliseBasis, sizeValue, stripPaddingAssumptions } from './lib/sizing.ts';

test('citation linking never eats an ordinary English word', () => {
  // A /(obs|cmp|dem|hyp)[a-z0-9._-]*­/ prefix pattern deleted the word
  // "Demand", so a finding in the live report opened mid-sentence.
  const footnotes = (id: string) => (id === 'dem-2' ? [6] : []);
  const ids = ['obs-manual-1', 'dem-2', 'dem-trend-1'];

  const out = linkClaimIds('Demand for the broad terms is shrinking (dem-2).', footnotes, ids);
  assert.match(out, /^Demand for the broad terms is shrinking/, `got: ${out}`);
  assert.match(out, /href="#src-6"/, 'the real citation must still become a link');

  for (const word of ['demand', 'demonstrate', 'competition', 'observed', 'hypothesis']) {
    assert.match(
      linkClaimIds(`The word ${word} must survive.`, footnotes, ids),
      new RegExp(word),
      `${word} was eaten`
    );
  }
});

test('a parenthetical group of citations collapses to one reference', () => {
  const footnotes = (id: string) => ({ 'dem-2': [6], 'dem-trend-1': [7] })[id] ?? [];
  const out = linkClaimIds('Both are falling (dem-2, dem-trend-1).', footnotes, ['dem-2', 'dem-trend-1']);
  /* One link, not a cluster. Six claims behind one sentence used to print
     "3 4 5 6 7 8"; the trail lives in the evidence appendix instead. */
  assert.match(out, /href="#src-6"/);
  assert.equal(out.match(/class="ref"/g)?.length, 1, `more than one link: ${out}`);
  assert.ok(!out.includes('dem-2'), `raw id survived: ${out}`);
  assert.ok(!/\(\s*\)/.test(out), `empty parens left: ${out}`);
});

test('sizeValue folds the unit in with one spacing convention', () => {
  assert.equal(sizeValue({ value: '20', unit: '%' }), '20%');
  assert.equal(sizeValue({ value: '20%', unit: '%' }), '20%', 'unit already in the value');
  assert.equal(sizeValue({ value: '8', unit: 'hours per week' }), '8 hours per week');
  assert.equal(sizeValue({ value: '45', unit: '/mo' }), '45/mo');
  assert.equal(sizeValue({ value: '500', unit: '' }), '500');
  assert.equal(sizeValue({ value: '27100', unit: 'per month' }), '27,100 per month');
  assert.equal(sizeValue({ value: '13.46', unit: 'USD' }), '$13.46', 'money reads as a prefix');
  assert.equal(sizeValue({ value: '$45k', unit: 'USD' }), '$45k', 'no doubled sign');
  assert.equal(sizeValue({ value: ' 500 ', unit: ' clients ' }), '500 clients');
});

test('a leading citation in a basis moves to the end', () => {
  assert.equal(
    normaliseBasis('From dem-4, Google data pulled 2026-08-25.'),
    'Google data pulled 2026-08-25. (dem-4)'
  );
  assert.equal(normaliseBasis('From dem-4.'), 'From dem-4.', 'nothing left to say');
  assert.equal(
    normaliseBasis('A round number chosen to keep the arithmetic legible.'),
    'A round number chosen to keep the arithmetic legible.'
  );
  assert.equal(normaliseBasis('From 2020 to 2024 the trend held.'), 'From 2020 to 2024 the trend held.');
});

test('a calendar constant is not an assumption', () => {
  const sizing = {
    assumptions: [
      { label: 'Advisors on the roster', value: '30', unit: '', basis: 'Round number.' },
      { label: 'Months in a year', value: '12', unit: '', basis: 'Calendar.' },
      { label: 'Hours saved each week', value: '2', unit: 'hours', basis: 'Round number.' },
    ],
    arithmetic: '30 x 2 x 48 = 2,880 hours a year.',
    question: 'Is that the right order of magnitude?',
  };
  const out = stripPaddingAssumptions({
    standing: '',
    questions: [],
    opportunities: [
      { heading: 'h', body: 'b', basis: 'b', claimIds: [], sizing },
    ],
    competitorSignal: { point: '', claimIds: [] },
    blindSpots: [],
  } as never);
  const kept = out.opportunities[0]!.sizing!.assumptions.map((a) => a.label);
  assert.deepEqual(kept, ['Advisors on the roster', 'Hours saved each week']);
});

test('padding is left alone when dropping it would leave one input', () => {
  const sizing = {
    assumptions: [
      { label: 'Months in a year', value: '12', unit: '', basis: 'Calendar.' },
      { label: 'Hours saved each month', value: '2', unit: 'hours', basis: 'Round number.' },
    ],
    arithmetic: '12 x 2 = 24 hours.',
    question: 'Right order of magnitude?',
  };
  const out = stripPaddingAssumptions({
    standing: '',
    questions: [],
    opportunities: [{ heading: 'h', body: 'b', basis: 'b', claimIds: [], sizing }],
    competitorSignal: { point: '', claimIds: [] },
    blindSpots: [],
  } as never);
  assert.equal(out.opportunities[0]!.sizing!.assumptions.length, 2, 'a sum needs its inputs shown');
});

test('mapWithConcurrency preserves order and bounds what is in flight', async () => {
  const started: number[] = [];
  let inFlight = 0;
  let peak = 0;
  const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    started.push(n);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70, 80], 'results must stay in input order');
  assert.equal(peak, 3, `at most 3 concurrent, saw ${peak}`);
  assert.equal(started.length, 8, 'every item runs exactly once');
});

test('mapWithConcurrency handles a limit above the item count', async () => {
  const out = await mapWithConcurrency([1, 2], 10, async (n) => n + 1);
  assert.deepEqual(out, [2, 3]);
  assert.deepEqual(await mapWithConcurrency([], 4, async (n) => n), []);
});

/* ===========================================================================
   Stage 06 sizing — assumptions are allowed, and structurally policed.
   ======================================================================== */

import { validateSynthesis, pruneSynthesis } from './stages/06-synthesis.ts';

const FACTS = {
  pagesCrawled: 10,
  peersIdentified: 8,
  peersWithDatedAiEvidence: 2,
  observedClaims: 11,
  comparativeClaims: 7,
};

const CLAIMS_FOR_SYNTH: Claim[] = [
  {
    id: 'obs-manual-1',
    tier: 'observed',
    angle: 'context',
    subject: 'self',
    statement: 'On your about page, a step runs on people rather than software: "developing mindset".',
    sources: [{ url: 'https://x.com/about', retrievedAt: '2026-08-24T00:00:00.000Z' }],
  },
];

const sizedSynthesis = (arithmetic: string, assumptions: unknown[]) => ({
  standing: 'You run an advisory business.',
  questions: [
    { question: 'Where does prep time go?', why: 'Your about page describes human work.', claimIds: ['obs-manual-1'], whatItChanges: 'Whether we start with prep.' },
  ],
  opportunities: [
    {
      heading: 'A commitment ledger',
      body: 'Durable state per client.',
      basis: 'Your own page names manual work.',
      claimIds: ['obs-manual-1'],
      sizing: { assumptions, arithmetic, question: 'Is that the right order of magnitude?' },
    },
  ],
  competitorSignal: { point: 'One peer has moved.', claimIds: ['obs-manual-1'] },
  blindSpots: ['We cannot see your volumes.'],
}) as never;

test('derived figures in the arithmetic are allowed — deriving them is the point', () => {
  // This rejected three of four sizings on the live Cultivate Advisors run and
  // left the document with no order of magnitude anywhere.
  const s = sizedSynthesis('500 clients × 20% churn = 100 lost a year. Half seen early is 50, a quarter saved is 12.', [
    { label: 'Active clients', value: '500', unit: 'clients', basis: 'A round number to keep the arithmetic legible.' },
    { label: 'Annual churn', value: '20', unit: '%', basis: 'A round placeholder; your real number replaces it.' },
  ]);
  const problems = validateSynthesis(s, CLAIMS_FOR_SYNTH, FACTS);
  assert.deepEqual(problems, [], `derived arithmetic must survive: ${JSON.stringify(problems)}`);
});

test('a sizing must show at least two declared inputs, each with a basis', () => {
  const oneInput = sizedSynthesis('500 × something = a lot.', [
    { label: 'Clients', value: '500', unit: 'clients', basis: 'Round number.' },
  ]);
  assert.ok(
    validateSynthesis(oneInput, CLAIMS_FOR_SYNTH, FACTS).some((p) => p.code === 'assumption_without_basis'),
    'one input is not arithmetic'
  );

  const noBasis = sizedSynthesis('500 × 20% = 100.', [
    { label: 'Clients', value: '500', unit: 'clients', basis: 'Round number.' },
    { label: 'Churn', value: '20', unit: '%', basis: '   ' },
  ]);
  const problems = validateSynthesis(noBasis, CLAIMS_FOR_SYNTH, FACTS);
  assert.ok(problems.some((p) => p.code === 'assumption_without_basis'), 'a basis is required');
});

test('a failed sizing drops the sizing, not the idea it belonged to', () => {
  const bad = sizedSynthesis('500 × 20% = 100.', [
    { label: 'Clients', value: '500', unit: 'clients', basis: '' },
  ]);
  const problems = validateSynthesis(bad, CLAIMS_FOR_SYNTH, FACTS);
  const { kept, dropped } = pruneSynthesis(bad, problems);
  assert.equal(kept.opportunities.length, 1, 'the recommendation survives');
  assert.equal(kept.opportunities[0].sizing, null, 'the arithmetic does not');
  assert.ok(dropped.some((d) => d.includes('sizing')));
});

test('a figure in an idea body still needs a source — only arithmetic is exempt', () => {
  const s = sizedSynthesis('500 × 20% = 100.', [
    { label: 'Clients', value: '500', unit: 'clients', basis: 'Round number.' },
    { label: 'Churn', value: '20', unit: '%', basis: 'Round placeholder.' },
  ]);
  s.opportunities[0].body = 'This would cut prep by 37% across the bench.';
  const problems = validateSynthesis(s, CLAIMS_FOR_SYNTH, FACTS);
  assert.ok(
    problems.some((p) => p.code === 'unsourced_numeral' && p.detail.includes('37')),
    `an invented figure in prose must still fail: ${JSON.stringify(problems)}`
  );
});

/* ===========================================================================
   Voice. Shared between the checker script and stage 06's repair pass.
   ======================================================================== */

import { checkVoice, describeFlags, textFromHtml } from './lib/voice.ts';
import { COPY } from './render/copy.ts';
import { synthesisProse } from './stages/06-synthesis.ts';

test('plain prose raises no flags', () => {
  assert.deepEqual(
    checkVoice("We read your site. Here's what we think. Tell us where we got it wrong."),
    []
  );
});

test('the tells that prompted this are caught', () => {
  const flagged = (t: string) => checkVoice(t).map((f) => f.id);
  assert.ok(flagged('It is not a chatbot, it is a workflow.').includes('not-x-but-y'));
  assert.ok(flagged('That is worth your time and it earns its place.').includes('rhetorical-worth'));
  assert.ok(flagged('No prep, no deck, no charge.').includes('triad'));
  assert.ok(flagged('We read your public surface to unlock value.').includes('jargon'));
  assert.ok(
    flagged('It does not need to be clever, it needs to be durable.').includes('inverted-moral')
  );
  assert.ok(
    flagged('Who has moved, and whether it worked').includes('comma-appendix-heading'),
    'the heading shape that was 4 of our 6 headings'
  );
});

test('one em-dash aside is a writer, several are a tic', () => {
  const one = 'We stopped there — that gap is the interesting part.';
  assert.deepEqual(checkVoice(one), [], 'a single aside is within budget');

  const many = [one, one, one, one].join(' ');
  const flags = checkVoice(many);
  assert.equal(flags[0].id, 'em-dash-aside');
  assert.equal(flags[0].count, 4);
  assert.ok(flags[0].examples.length <= 3, 'examples are capped for the repair prompt');
});

test('flags describe themselves well enough to act on', () => {
  const text = describeFlags(checkVoice('No prep, no deck, no charge. We read your public surface.'));
  assert.match(text, /three-item list/i);
  assert.match(text, /jargon|plain word/i);
  assert.match(text, /found \d+, allowed \d+/);
});

test('synthesisProse gathers every string a reader sees', () => {
  const prose = synthesisProse({
    standing: 'STANDING_TEXT',
    questions: [{ question: 'Q_TEXT', why: 'WHY_TEXT', claimIds: ['a'], whatItChanges: 'CHANGES_TEXT' }],
    opportunities: [
      {
        heading: 'HEAD_TEXT',
        body: 'BODY_TEXT',
        basis: 'BASIS_TEXT',
        claimIds: ['a'],
        sizing: {
          assumptions: [{ label: 'L', value: '5', unit: 'x', basis: 'ASSUMPTION_BASIS' }],
          arithmetic: 'ARITH_TEXT',
          question: 'SIZE_Q_TEXT',
        },
      },
    ],
    competitorSignal: { point: 'PEER_TEXT', claimIds: ['a'] },
    blindSpots: ['BLIND_TEXT'],
  } as never);

  for (const marker of [
    'STANDING_TEXT', 'Q_TEXT', 'WHY_TEXT', 'CHANGES_TEXT', 'HEAD_TEXT', 'BODY_TEXT',
    'BASIS_TEXT', 'ASSUMPTION_BASIS', 'ARITH_TEXT', 'SIZE_Q_TEXT', 'PEER_TEXT', 'BLIND_TEXT',
  ]) {
    assert.ok(prose.includes(marker), `${marker} is shown to readers and must be checked`);
  }
});

test('textFromHtml leaves em dashes intact so asides are still detectable', () => {
  const text = textFromHtml('<p>We stopped there &mdash; that gap is the interesting part.</p>');
  assert.match(text, /—/);
  assert.ok(!text.includes('<p>'));
});

test('a system name that is also an English word needs exact case and context', () => {
  // We told a business coaching firm their work runs through Epic, the hospital
  // EHR, because their page said something was epic.
  assert.equal(namesSystem('Epic growth is what we deliver.', 'Epic'), false);
  assert.equal(namesSystem('An epic journey for our clients.', 'Epic'), false);
  assert.equal(namesSystem('We integrate with Epic and Cerner.', 'Epic'), true);
  assert.equal(namesSystem('Our team uses Slack daily.', 'Slack'), true);
  assert.equal(namesSystem('We work in slack time.', 'Slack'), false);
  // Unambiguous names keep the loose match.
  assert.equal(namesSystem('runs on pointclickcare today', 'PointClickCare'), true);
});

test('the voice check ignores the client’s own quoted words', () => {
  // Cultivate Advisors was flagged twice for "Unlock" — their word, from their
  // homepage, quoted accurately by us.
  const html = '<p>Their homepage says <q>Unlock your potential and unlock growth</q> which we read as marketing.</p>';
  assert.deepEqual(checkVoice(textFromHtml(html)), [], 'quoted client copy is not our prose');
  assert.ok(
    checkVoice(textFromHtml('<p>We will unlock your potential.</p>')).some((f) => f.id === 'jargon'),
    'our own jargon is still caught'
  );
});

/* ===========================================================================
   Feedback from the Cultivate Advisors read, 2026-08-25. Every pattern here is
   a line someone objected to in a real draft.
   ======================================================================== */

test('hedging is allowed twice, not five times', () => {
  // "Don't need to stuff all the 'we'll probably be wrong' in here."
  const once = 'Our read is that advisor capacity is the ceiling. Some of this will be wrong.';
  assert.deepEqual(checkVoice(once), [], 'one caveat is honest');

  const overdone =
    'From the outside it looks like you sell advising. Everything here is provisional. ' +
    'We have only read your website. Correct us early. Some of this will be wrong.';
  const flags = checkVoice(overdone);
  assert.ok(flags.some((f) => f.id === 'over-hedging'), `expected over-hedging: ${JSON.stringify(flags)}`);
});

test('the reader is not an opponent', () => {
  // "Specific enough to argue with" and "correct them" both read as a dare.
  for (const t of [
    'Specific enough to argue with.',
    'Tell us how far off we are.',
    'Our guesses — correct them.',
  ]) {
    assert.ok(checkVoice(t).some((f) => f.id === 'adversarial'), `should flag: ${t}`);
  }
});

test('praise built out of a contrast is caught', () => {
  // "You win on judgement rather than on the quality of an answer" tells a
  // professional-services firm their answers are not the good part.
  assert.ok(
    checkVoice('You win on judgement, memory and accountability rather than on the quality of an answer.')
      .some((f) => f.id === 'faint-praise')
  );
  // "Unusual spot" reads as ignorant — it says we have not seen many like them.
  assert.ok(
    checkVoice("If that's right, you're in an unusual spot.").some((f) => f.id === 'faint-praise')
  );
  // Plain praise is fine.
  assert.deepEqual(checkVoice('You are good at judgement, memory and accountability.'), []);
});

test('the report headline is addressed to the company by name', () => {
  assert.match(COPY.headline, /\{company\}/, 'the opening line names them');
  assert.ok(!/if we had an hour/.test(COPY.headline));
});

test('the ideas heading never promises more ideas than it shows', () => {
  // A dropped idea left the heading saying "Three ideas" above two of them.
  assert.match(COPY.sections.opportunities.heading, /\{n\}/, 'the count is filled at render time');
  assert.ok(!/^Three /.test(COPY.sections.opportunities.heading));
});

/* -- the evidence ledger ------------------------------------------------ */

import { mergePeerEvidence, savePeerLedger, loadPeerLedger } from './lib/evidence-ledger.ts';

const cite = (url: string) => [{ url, title: 't' }];

test('a finding survives a run that does not return it', () => {
  const first = mergePeerEvidence(
    null,
    'peer.com',
    [{ statement: 'Launched an AI intake tool in March 2025.', observedAt: '2025-03-04', citations: cite('https://news.example/a') }],
    'run-1',
    '2026-08-25T00:00:00Z'
  );
  assert.equal(first.added.length, 1);
  assert.equal(first.recovered.length, 0);

  /* The flapping case: an hour later the same question returns nothing. */
  const second = mergePeerEvidence(first.ledger, 'peer.com', [], 'run-2', '2026-08-25T01:00:00Z');
  assert.equal(second.ledger.items.length, 1, 'evidence was lost');
  assert.equal(second.recovered.length, 1);
  assert.equal(second.added.length, 0);
});

test('the same source found twice is one finding, keeping the first wording', () => {
  const first = mergePeerEvidence(
    null,
    'peer.com',
    [{ statement: 'Launched an AI intake tool.', observedAt: '2025-03-04', citations: cite('https://news.example/a') }],
    'run-1',
    '2026-08-25T00:00:00Z'
  );
  const second = mergePeerEvidence(
    first.ledger,
    'peer.com',
    [{ statement: 'Deployed automation for patient intake.', observedAt: '2025-03-04', citations: cite('https://news.example/a/') }],
    'run-2',
    '2026-08-25T01:00:00Z'
  );
  assert.equal(second.ledger.items.length, 1, 'a reworded duplicate was stored twice');
  assert.equal(second.ledger.items[0]!.statement, 'Launched an AI intake tool.', 'wording changed under the reader');
  assert.equal(second.ledger.items[0]!.timesSeen, 2);
  assert.equal(second.ledger.items[0]!.firstSeenRun, 'run-1');
  assert.equal(second.ledger.items[0]!.lastSeenRun, 'run-2');
  assert.equal(second.added.length, 0);
});

test('two different sources are two findings, newest first', () => {
  const merged = mergePeerEvidence(
    null,
    'peer.com',
    [
      { statement: 'Older move.', observedAt: '2025-01-02', citations: cite('https://news.example/old') },
      { statement: 'Newer move.', observedAt: '2026-02-03', citations: cite('https://news.example/new') },
    ],
    'run-1',
    '2026-08-25T00:00:00Z'
  );
  assert.deepEqual(merged.ledger.items.map((i) => i.statement), ['Newer move.', 'Older move.']);
});

test('merging never mutates the ledger it was given', () => {
  const first = mergePeerEvidence(
    null,
    'peer.com',
    [{ statement: 'A.', observedAt: '2025-01-01', citations: cite('https://news.example/a') }],
    'run-1',
    '2026-08-25T00:00:00Z'
  );
  const snapshot = JSON.stringify(first.ledger);
  mergePeerEvidence(
    first.ledger,
    'peer.com',
    [{ statement: 'B.', observedAt: '2025-02-01', citations: cite('https://news.example/b') }],
    'run-2',
    '2026-08-25T01:00:00Z'
  );
  assert.equal(JSON.stringify(first.ledger), snapshot, 'a dry run mutated the corpus');
});

test('a saved ledger round-trips, and an unknown peer reads as empty', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'evidence-'));
  try {
    assert.equal(await loadPeerLedger(root, 'never-seen.com'), null);

    const { ledger } = mergePeerEvidence(
      null,
      'peer.com',
      [{ statement: 'A move.', observedAt: '2025-05-05', citations: cite('https://news.example/a') }],
      'run-1',
      '2026-08-25T00:00:00Z'
    );
    await savePeerLedger(root, ledger);
    const loaded = await loadPeerLedger(root, 'peer.com');
    assert.deepEqual(loaded, ledger);

    /* A domain that would escape the directory is written inside it, not above. */
    const nasty = mergePeerEvidence(null, '../../etc/peer.com', [], 'run-1', '2026-08-25T00:00:00Z');
    await savePeerLedger(root, nasty.ledger);
    const back = await loadPeerLedger(root, '../../etc/peer.com');
    assert.equal(back?.domain, '../../etc/peer.com');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
