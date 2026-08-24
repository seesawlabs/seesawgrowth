/* ---------------------------------------------------------------------------
   CLI.

     npm run prototype              assemble the fixture -> runs/_prototype/
     npm run report -- <domain>     full pipeline, stages 01-05

   `prototype` needs no credentials and no network. It exists so the report
   format is reviewable and arguable before a single API call is spent.

   `report` runs the real pipeline. Two properties it is built to have:

     - Every raw response is cached before it is parsed, so re-running a
       domain costs nothing and iterating on the report is free. The run
       summary reports how much of the spend was cache hits.

     - A stage that cannot run does not abort the run. Missing credentials or
       a dead API degrade the report and are reported as such, because four
       good stages and one honest gap beats nothing at all. The exception is
       stage 01: with no subject crawl there is no report to write.

   Flags:
     --refresh            bypass cache reads for this run
     --trigger "..."      what the prospect said is driving this
     --category "..."     override the derived category query (stage 02's input)
     --budget <usd>       override EXPOSURE_RUN_BUDGET_USD
     --peers <n>          how many peers to research in stage 03
     --no-peer-crawl      skip crawling peers' own sites (saves credits)
     --quiet              suppress the report on stdout; still writes files
--------------------------------------------------------------------------- */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { scoreCoverage, summarizeCoverage, partitionClaims } from './lib/claim.ts';
import { initRun, writeArtifact } from './lib/run.ts';
import { Ledger } from './lib/budget.ts';
import { loadDotEnv, checkStage, formatCredentialReport } from './lib/env.ts';
import type { CacheOptions } from './lib/cache.ts';
import { assembleReport } from './stages/05-assemble.ts';
import { runSubjectStage } from './stages/01-subject.ts';
import { runPeersStage, type PeersArtifact } from './stages/02-peers.ts';
import { runPeerEvidenceStage, type PeerEvidenceArtifact } from './stages/03-peer-evidence.ts';
import { runDemandStage, type DemandArtifact } from './stages/04-demand.ts';
import { buildClaims, coverageFrom } from './stages/claims.ts';
import { registrableDomain } from './lib/domain.ts';
import { FIXTURE_CLAIMS, FIXTURE_META } from './fixtures/prototype.ts';

const ROOT = new URL('..', import.meta.url).pathname;

async function prototype(): Promise<void> {
  const coverage = scoreCoverage({
    pagesCrawled: 9,
    peersIdentified: 4,
    peersWithDatedAiEvidence: 2,
    observedClaims: 4,
    comparativeClaims: 3,
  });

  const dir = await initRun(ROOT, FIXTURE_META);
  const { markdown, rejected } = assembleReport({
    meta: FIXTURE_META,
    claims: FIXTURE_CLAIMS,
    coverage,
    syntheticNotice:
      'SYNTHETIC FIXTURE — this company does not exist. Format prototype only; do not circulate.',
  });

  await writeArtifact(dir, 'claims', FIXTURE_CLAIMS);
  await writeArtifact(dir, 'coverage', coverage);
  await writeFile(join(dir, 'report.md'), markdown);

  console.log(markdown);
  console.error(`\n---\nwrote ${join(dir, 'report.md')}`);
  console.error(summarizeCoverage(coverage));
  if (rejected.length > 0) {
    console.error(`${rejected.length} claim(s) rejected by the validator:`);
    for (const r of rejected) {
      console.error(`  ${r.claim.id}: ${r.problems.map((p) => p.code).join(', ')}`);
    }
  }
}

/* -- argument parsing --------------------------------------------------- */

interface Args {
  domain: string;
  refresh: boolean;
  trigger?: string;
  category?: string;
  budget?: number;
  peers?: number;
  peerCrawl: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { domain: '', refresh: false, peerCrawl: true, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--refresh') args.refresh = true;
    else if (a === '--no-peer-crawl') args.peerCrawl = false;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--trigger') args.trigger = argv[++i];
    else if (a === '--category') args.category = argv[++i];
    else if (a === '--budget') args.budget = Number(argv[++i]);
    else if (a === '--peers') args.peers = Number(argv[++i]);
    else if (!a.startsWith('-') && !args.domain) args.domain = a;
  }
  return args;
}

/** Accepts a bare domain or a URL, and normalises to a registrable domain. */
function normalizeDomain(input: string): string {
  const trimmed = input.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return registrableDomain(trimmed) || trimmed.toLowerCase();
}

/* -- the pipeline ------------------------------------------------------- */

async function report(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (!args.domain) {
    console.error('Usage: npm run report -- <domain> [--refresh] [--trigger "..."] [--category "..."]');
    process.exit(1);
  }

  const domain = normalizeDomain(args.domain);
  loadDotEnv(ROOT);

  // One timestamp for the whole run, so every artifact and every cache entry
  // agrees about when this happened.
  const now = new Date().toISOString();
  const runId = now.replace(/[:.]/g, '-');
  const ledger = new Ledger(args.budget);
  const cache: CacheOptions = { dir: join(ROOT, 'cache'), refresh: args.refresh };

  console.error(`AI Exposure Report — ${domain}`);
  console.error(`run ${runId}\n`);
  console.error('Credentials:');
  console.error(formatCredentialReport());
  console.error(`\nBudget ceiling for this run: $${ledger.ceiling.toFixed(2)}${args.refresh ? ' (cache reads bypassed)' : ''}\n`);

  const dir = await initRun(ROOT, {
    runId,
    domain,
    startedAt: now,
    trigger: args.trigger,
  });

  const stageNotes: string[] = [];

  /* stage 01 — mandatory. No subject crawl, no report. */
  const gate01 = checkStage('01-subject');
  if (!gate01.ok) {
    console.error(`Stage 01 cannot run: ${gate01.missing.join(', ')} missing. This stage is mandatory.`);
    process.exit(3);
  }
  console.error('[01/05] subject — mapping and scraping their own surface');
  const subject = await runSubjectStage(cache, ledger, domain, now, {
    categoryQueryOverride: args.category,
  });
  await writeArtifact(dir, '01-subject', subject);
  console.error(
    `        ${subject.mapped} URL(s) mapped, ${subject.selected.length} selected, ` +
      `${subject.pagesCrawled} crawled with content`
  );
  for (const note of subject.notes) console.error(`        - ${note}`);
  console.error(`        category query: "${subject.categoryQuery.query.slice(0, 110)}"`);
  console.error(`        derived from: ${subject.categoryQuery.derivedFrom}`);

  /* stage 02 — peers. */
  let peers: PeersArtifact | null = null;
  const gate02 = checkStage('02-peers');
  if (!gate02.ok) {
    stageNotes.push(`stage 02 skipped: ${gate02.missing.join(', ')} missing`);
    console.error(`[02/05] peers — SKIPPED (${gate02.missing.join(', ')} missing)`);
  } else if (subject.pagesCrawled === 0) {
    stageNotes.push('stage 02 skipped: no subject pages crawled, so no category description to search with');
    console.error('[02/05] peers — SKIPPED (no subject content to derive a category from)');
  } else {
    console.error('[02/05] peers — Exa category search plus find-similar');
    try {
      peers = await runPeersStage(
        cache,
        ledger,
        domain,
        subject.categoryQuery.query,
        subject.pages.find((p) => p.category === 'home')?.title,
        now
      );
      await writeArtifact(dir, '02-peers', peers);
      console.error(`        ${peers.peers.length} peer(s) kept, ${peers.rejected.length} rejected`);
      for (const p of peers.peers) {
        console.error(`          ${p.confidence.padEnd(6)} ${p.domain.padEnd(32)} ${p.name.slice(0, 40)}`);
      }
      const summary = Object.entries(peers.rejectionSummary)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      if (summary) console.error(`        rejections: ${summary}`);
      for (const note of peers.notes) console.error(`        - ${note}`);
    } catch (error) {
      stageNotes.push(`stage 02 failed: ${(error as Error).message.slice(0, 200)}`);
      console.error(`        FAILED: ${(error as Error).message.slice(0, 200)}`);
    }
  }

  /* stage 03 — peer evidence. */
  let evidence: PeerEvidenceArtifact | null = null;
  const gate03 = checkStage('03-peer-evidence');
  if (!gate03.ok) {
    stageNotes.push(`stage 03 skipped: ${gate03.missing.join(', ')} missing`);
    console.error(`[03/05] peer evidence — SKIPPED (${gate03.missing.join(', ')} missing)`);
  } else if (!peers || peers.peers.length === 0) {
    stageNotes.push('stage 03 skipped: no peers to research');
    console.error('[03/05] peer evidence — SKIPPED (no peers)');
  } else {
    console.error('[03/05] peer evidence — Perplexity, citation-resolved, plus peer sites');
    try {
      evidence = await runPeerEvidenceStage(cache, ledger, domain, peers.peers, now, {
        maxPeers: args.peers ?? 6,
        crawlPeerSites: args.peerCrawl,
        pagesPerPeer: 2,
      });
      await writeArtifact(dir, '03-peer-evidence', evidence);
      console.error(
        `        ${evidence.peersWithDatedAiEvidence} of ${evidence.peers.length} peer(s) ` +
          `produced dated, sourced AI evidence`
      );
      for (const p of evidence.peers) {
        const own = p.ownSurface ? `, ${p.ownSurface.aiQuotes.length} own-site quote(s)` : '';
        console.error(`          ${p.peerDomain.padEnd(32)} ${p.items.length} item(s)${own}`);
      }
      const drops = Object.entries(evidence.dropSummary)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      if (drops) console.error(`        dropped statements: ${drops}`);
      for (const note of evidence.notes) console.error(`        - ${note}`);
    } catch (error) {
      stageNotes.push(`stage 03 failed: ${(error as Error).message.slice(0, 200)}`);
      console.error(`        FAILED: ${(error as Error).message.slice(0, 200)}`);
    }
  }

  /* stage 04 — demand. */
  let demand: DemandArtifact | null = null;
  const gate04 = checkStage('04-demand');
  if (!gate04.ok) {
    stageNotes.push(`stage 04 skipped: ${gate04.missing.join(', ')} missing`);
    console.error(`[04/05] demand — SKIPPED (${gate04.missing.join(', ')} missing)`);
  } else {
    console.error('[04/05] demand — DataForSEO Labs, pull date stamped inline');
    try {
      demand = await runDemandStage(cache, ledger, domain, subject.categoryQuery.query, now, {
        // Body text from the crawl, so a seed term has to be attested on the
        // site rather than just present in a meta description.
        corpus: subject.pages
          .flatMap((p) => [p.title ?? '', p.description ?? '', ...p.manualWorkQuotes.map((q) => q.quote), ...p.roleLines])
          .join(' '),
        peerDomains: (peers?.peers ?? []).map((p) => p.domain),
        maxPeerLookups: 3,
      });
      await writeArtifact(dir, '04-demand', demand);
      console.error(`        ${demand.terms.length} term(s) measured, ${demand.peerRanked.length} peer ranking row(s)`);
      for (const note of demand.notes) console.error(`        - ${note}`);
    } catch (error) {
      stageNotes.push(`stage 04 failed: ${(error as Error).message.slice(0, 200)}`);
      console.error(`        FAILED: ${(error as Error).message.slice(0, 200)}`);
    }
  }

  /* claims + stage 05 — deterministic, no network. */
  console.error('[05/05] claims and assembly — deterministic, no model');
  const input = { subject, peers, evidence, demand };
  const claims = buildClaims(input);
  const { renderable, rejected } = partitionClaims(claims);
  const coverage = scoreCoverage(coverageFrom(input, renderable));

  const { markdown } = assembleReport({
    meta: { runId, domain, startedAt: now, trigger: args.trigger },
    claims,
    coverage,
  });

  await writeArtifact(dir, 'claims', claims);
  await writeArtifact(dir, 'coverage', coverage);
  await writeArtifact(dir, 'rejected-claims', rejected);
  await writeArtifact(dir, 'cost', {
    spent: ledger.spent,
    spentReported: ledger.spentReported,
    spentEstimated: ledger.spentEstimated,
    ceiling: ledger.ceiling,
    byService: ledger.byService(),
    entries: ledger.entries,
  });
  await writeFile(join(dir, 'report.md'), markdown);

  if (!args.quiet) console.log(markdown);

  console.error(`\n---\n${claims.length} claim(s) built, ${renderable.length} renderable, ${rejected.length} rejected`);
  for (const r of rejected) {
    console.error(`  REJECTED ${r.claim.id}: ${r.problems.map((p) => `${p.code} (${p.detail})`).join('; ')}`);
  }
  for (const note of stageNotes) console.error(`  NOTE ${note}`);
  console.error(`\n${summarizeCoverage(coverage)}`);
  console.error(
    `  pagesCrawled=${coverage.pagesCrawled} peersIdentified=${coverage.peersIdentified} ` +
      `peersWithDatedAiEvidence=${coverage.peersWithDatedAiEvidence} ` +
      `observedClaims=${coverage.observedClaims} comparativeClaims=${coverage.comparativeClaims}`
  );
  console.error(`\n${ledger.format()}`);
  console.error(`\nwrote ${join(dir, 'report.md')}`);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'prototype':
    await prototype();
    break;
  case 'report':
    await report(rest);
    break;
  default:
    console.error('Usage: cli.ts <prototype|report> [args]');
    process.exit(1);
}
