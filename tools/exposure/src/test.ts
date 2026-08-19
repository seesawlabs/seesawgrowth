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
    peersWithDatedAiEvidence: 1, // below the minimum of 2
    observedClaims: 6,
    comparativeClaims: 4,
  });
  assert.equal(c.sufficient, false);
  assert.ok(c.shortfalls.some((s) => s.startsWith('peersWithDatedAiEvidence')));
  assert.ok(c.score > 0.8, 'one near miss should still score high');
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
