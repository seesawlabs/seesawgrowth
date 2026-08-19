/* ---------------------------------------------------------------------------
   Development fixture — shape only.

   This exists so the report format can be iterated without spending API calls,
   and so the validator has something to bite on in tests.

   The company is not real and the values are deliberately placeholder-ish.
   Anything assembled from this carries a SYNTHETIC banner and must never be
   circulated as an example report — consistent with why `/sample` on the site
   shows structure rather than a mocked-up company.
--------------------------------------------------------------------------- */

import type { Claim } from '../lib/claim.ts';
import type { RunMeta } from '../lib/run.ts';

export const FIXTURE_META: RunMeta = {
  runId: '2026-08-19T00-00-00Z',
  domain: 'example-health.test',
  startedAt: '2026-08-19T00:00:00Z',
  trigger: 'Board asked for an AI plan by Q1 and we do not have one.',
  focus: 'Intake and eligibility',
};

const RETRIEVED = '2026-08-19';

export const FIXTURE_CLAIMS: Claim[] = [
  {
    id: 'obs-docs-intake',
    tier: 'observed',
    angle: 'context',
    subject: 'self',
    statement:
      'Your published help center documents a manual eligibility check that runs across ' +
      '6 discrete steps and two separate systems.',
    sources: [
      {
        url: 'https://example-health.test/help/eligibility',
        title: 'Submitting an eligibility request',
        retrievedAt: RETRIEVED,
      },
    ],
  },
  {
    id: 'obs-careers',
    tier: 'observed',
    angle: 'context',
    subject: 'self',
    statement:
      'You are currently hiring for 3 operations roles whose descriptions center on ' +
      'manual claim review.',
    sources: [
      {
        url: 'https://example-health.test/careers',
        title: 'Open roles',
        retrievedAt: RETRIEVED,
      },
    ],
  },
  {
    id: 'cmp-peer-a-intake',
    tier: 'comparative',
    angle: 'threat',
    subject: 'peer',
    peerName: 'Northwind Care',
    observedAt: '2026-03',
    statement:
      'shipped an AI-assisted intake product covering the same eligibility step your ' +
      'documentation describes as manual.',
    sources: [
      {
        url: 'https://northwind.test/blog/ai-intake',
        title: 'Introducing AI-assisted intake',
        publisher: 'Northwind Care',
        retrievedAt: RETRIEVED,
      },
    ],
  },
  {
    id: 'cmp-peer-b-notes',
    tier: 'comparative',
    angle: 'threat',
    subject: 'peer',
    peerName: 'Cedar Path Health',
    observedAt: '2026-01',
    statement:
      'published a customer-facing changelog entry describing automated clinical note ' +
      'summarization in production.',
    sources: [
      {
        url: 'https://cedarpath.test/changelog',
        title: 'Changelog — January',
        publisher: 'Cedar Path Health',
        retrievedAt: RETRIEVED,
      },
    ],
  },
  {
    id: 'cmp-gap-scheduling',
    tier: 'comparative',
    angle: 'opportunity',
    subject: 'peer',
    peerName: 'Northwind Care',
    statement:
      'has shipped nothing public in scheduling or capacity planning, and neither has any ' +
      'other peer we found — the category is open.',
    sources: [
      {
        url: 'https://northwind.test/product',
        title: 'Product overview',
        publisher: 'Northwind Care',
        retrievedAt: RETRIEVED,
      },
    ],
  },
  {
    id: 'hyp-eligibility-cost',
    tier: 'hypothesis',
    angle: 'opportunity',
    subject: 'self',
    statement:
      'If that 6-step eligibility check runs [checksPerMonth] times a month at ' +
      '[minutesEach] minutes each, it consumes [hoursPerYear] hours a year before any ' +
      'error rework.',
    sources: [
      {
        url: 'https://example-health.test/help/eligibility',
        title: 'Submitting an eligibility request',
        retrievedAt: RETRIEVED,
      },
    ],
    missingVariables: [
      { key: 'checksPerMonth', label: 'eligibility checks per month', unit: 'count' },
      { key: 'minutesEach', label: 'minutes per check today', unit: 'minutes' },
      { key: 'hoursPerYear', label: 'the resulting annual hours', unit: 'hours' },
    ],
    confidence: 'medium',
  },
];

/** Claims that must be rejected — the validator's teeth, exercised in tests. */
export const FIXTURE_BAD_CLAIMS: Claim[] = [
  {
    id: 'bad-unsourced-number',
    tier: 'observed',
    angle: 'threat',
    subject: 'self',
    statement: 'Your team loses roughly 30 hours a week to manual review.',
    sources: [],
  },
  {
    id: 'bad-undeclared-placeholder',
    tier: 'hypothesis',
    angle: 'opportunity',
    subject: 'self',
    statement: 'At [volumePerWeek] this would pay back immediately.',
    sources: [],
  },
  {
    id: 'bad-peer-unnamed',
    tier: 'comparative',
    angle: 'threat',
    subject: 'peer',
    statement: 'A competitor shipped something similar.',
    sources: [{ url: 'https://peer.test/news', retrievedAt: RETRIEVED }],
  },
];
