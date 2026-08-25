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
     --company "..."      display name for the company
     --peer <domain>      a competitor they named. Repeatable, and the single
                          highest-value thing an intake form can collect
     --no-synthesis       skip the analyst (debugging the evidence stages)
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
import { loadDotEnv, checkStage, formatCredentialReport, missingCredentials } from './lib/env.ts';
import type { CacheOptions } from './lib/cache.ts';
import { assembleReport } from './stages/05-assemble.ts';
import { runSubjectStage } from './stages/01-subject.ts';
import { runPeersStage, type PeersArtifact } from './stages/02-peers.ts';
import { runPeerEvidenceStage, type PeerEvidenceArtifact } from './stages/03-peer-evidence.ts';
import { runDemandStage, type DemandArtifact } from './stages/04-demand.ts';
import { buildClaims, coverageFrom } from './stages/claims.ts';
import { runSynthesisStage, type SynthesisArtifact } from './stages/06-synthesis.ts';
import { renderReportHtml } from './render/report-html.ts';
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
  company?: string;
  budget?: number;
  peers?: number;
  peerCrawl: boolean;
  quiet: boolean;
  /** Competitors named on the intake form. Repeatable: --peer a.com --peer b.com */
  namedPeers: string[];
  /** Skip the analyst. Only useful when debugging the evidence stages. */
  noSynthesis: boolean;
  /** Skip the wider web research pass before the analysis. */
  noResearch: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    domain: '',
    refresh: false,
    peerCrawl: true,
    quiet: false,
    namedPeers: [],
    noSynthesis: false,
    noResearch: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--refresh') args.refresh = true;
    else if (a === '--no-peer-crawl') args.peerCrawl = false;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--no-synthesis') args.noSynthesis = true;
    else if (a === '--no-research') args.noResearch = true;
    else if (a === '--peer') {
      const v = argv[++i];
      if (v) args.namedPeers.push(v);
    }
    else if (a === '--company') args.company = argv[++i];
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

  console.error(`AI Opportunity Brief — ${domain}`);
  console.error(`run ${runId}\n`);
  console.error('Credentials:');
  console.error(formatCredentialReport());
  console.error(`\nBudget ceiling for this run: $${ledger.ceiling.toFixed(2)}${args.refresh ? ' (cache reads bypassed)' : ''}\n`);

  const dir = await initRun(ROOT, {
    runId,
    domain,
    startedAt: now,
    companyName: args.company,
    trigger: args.trigger,
  });

  const stageNotes: string[] = [];

  /* Per-stage wall clock. This is not instrumentation for its own sake: whether
     a visitor waits on the page, waits for an email, or books a call while the
     run happens is a UX decision that needs a real number, and the number is
     dominated by one stage rather than spread evenly. Printed per stage and
     totalled at the end. */
  const runStart = Date.now();
  const timings: { stage: string; ms: number }[] = [];
  let stageStart = runStart;
  const mark = (stage: string) => {
    const ms = Date.now() - stageStart;
    timings.push({ stage, ms });
    stageStart = Date.now();
    console.error(`        ${(ms / 1000).toFixed(1)}s`);
  };

  /* stage 01 — mandatory. No subject crawl, no report. */
  const gate01 = checkStage('01-subject');
  if (!gate01.ok) {
    console.error(`Stage 01 cannot run: ${gate01.missing.join(', ')} missing. This stage is mandatory.`);
    process.exit(3);
  }
  console.error('[01/06] subject — mapping and scraping their own surface');
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
  mark('01 subject');

  /* stage 02 — peers. */
  let peers: PeersArtifact | null = null;
  const gate02 = checkStage('02-peers');
  if (!gate02.ok) {
    stageNotes.push(`stage 02 skipped: ${gate02.missing.join(', ')} missing`);
    console.error(`[02/06] peers — SKIPPED (${gate02.missing.join(', ')} missing)`);
  } else if (subject.pagesCrawled === 0) {
    stageNotes.push('stage 02 skipped: no subject pages crawled, so no category description to search with');
    console.error('[02/06] peers — SKIPPED (no subject content to derive a category from)');
  } else {
    console.error('[02/06] peers — Exa category search plus find-similar');
    try {
      peers = await runPeersStage(
        cache,
        ledger,
        domain,
        subject.categoryQuery.query,
        subject.pages.find((p) => p.category === 'home')?.title,
        now,
        { namedPeers: args.namedPeers }
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
  mark('02 peers');

  /* stage 03 — peer evidence. */
  let evidence: PeerEvidenceArtifact | null = null;
  const gate03 = checkStage('03-peer-evidence');
  if (!gate03.ok) {
    stageNotes.push(`stage 03 skipped: ${gate03.missing.join(', ')} missing`);
    console.error(`[03/06] peer evidence — SKIPPED (${gate03.missing.join(', ')} missing)`);
  } else if (!peers || peers.peers.length === 0) {
    stageNotes.push('stage 03 skipped: no peers to research');
    console.error('[03/06] peer evidence — SKIPPED (no peers)');
  } else {
    console.error('[03/06] peer evidence — Perplexity, citation-resolved, plus peer sites');
    try {
      evidence = await runPeerEvidenceStage(cache, ledger, domain, peers.peers, now, {
        maxPeers: args.peers ?? 6,
        crawlPeerSites: args.peerCrawl,
        pagesPerPeer: 2,
        /* Committed, not gitignored like runs/. It is research we paid for,
           about public companies from public sources, and a run on another
           machine should not start from nothing. */
        evidenceDir: join(ROOT, 'evidence'),
        runId,
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
  mark('03 peer evidence');

  /* stage 04 — demand. */
  let demand: DemandArtifact | null = null;
  const gate04 = checkStage('04-demand');
  if (!gate04.ok) {
    stageNotes.push(`stage 04 skipped: ${gate04.missing.join(', ')} missing`);
    console.error(`[04/06] demand — SKIPPED (${gate04.missing.join(', ')} missing)`);
  } else {
    console.error('[04/06] demand — DataForSEO Labs, pull date stamped inline');
    try {
      demand = await runDemandStage(cache, ledger, domain, subject.categoryQuery.query, now, {
        // Body text from the crawl, so a seed term has to be attested on the
        // site rather than just present in a meta description.
        // The trimmed opening sentences, not the full description: see
        // deriveCategoryQuery for why those are two different strings.
        seedText: subject.categoryQuery.seedText,
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
  mark('04 demand');

  /* claims — deterministic, no network, no model. */
  console.error('[05/06] claims — deterministic, no model');
  const input = { subject, peers, evidence, demand };
  const claims = buildClaims(input);
  const { renderable, rejected } = partitionClaims(claims);
  const coverage = scoreCoverage(coverageFrom(input, renderable));
  const company = args.company?.trim() || subject.pages.find((p) => p.category === 'home')?.title || domain;
  mark('05 claims');

  /* stage 06 — the analyst. Without this the document is a list of sourced
     facts, which is what the first live report was and why it read as a dump. */
  let synthesis: SynthesisArtifact | null = null;
  if (args.noSynthesis) {
    stageNotes.push('stage 06 skipped: --no-synthesis');
    console.error('[06/06] analysis — SKIPPED (--no-synthesis)');
  } else if (missingCredentials(['ANTHROPIC_API_KEY']).length > 0) {
    stageNotes.push('stage 06 skipped: ANTHROPIC_API_KEY missing');
    console.error('[06/06] analysis — SKIPPED (ANTHROPIC_API_KEY missing)');
  } else {
    console.error('[06/06] analysis — every figure checked against the claims it cites');
    try {
      synthesis = await runSynthesisStage(
        cache,
        ledger,
        {
          company,
          claims: renderable,
          subject,
          peers,
          evidence,
          trigger: args.trigger,
          oneLiner: args.category ?? subject.categoryQuery.seedText,
        },
        now,
        { research: !args.noResearch }
      );
      await writeArtifact(dir, '06-synthesis', synthesis);
      const s = synthesis.synthesis;
      console.error(
        `        ${s.questions.length} question(s), ${s.opportunities.length} opportunity(ies), ` +
          `${s.blindSpots.length} blind spot(s) — ${synthesis.model}`
      );
      for (const note of synthesis.notes) console.error(`        - ${note}`);
      for (const p of synthesis.problems) console.error(`        REJECTED ${p.field}: ${p.detail}`);
    } catch (error) {
      stageNotes.push(`stage 06 failed: ${(error as Error).message.slice(0, 200)}`);
      console.error(`        FAILED: ${(error as Error).message.slice(0, 200)}`);
    }
  }

  const { markdown } = assembleReport({
    meta: { runId, domain, startedAt: now, trigger: args.trigger },
    claims,
    coverage,
  });

  /* The deliverable a lead actually opens. */
  const html = renderReportHtml({
    meta: { runId, domain, startedAt: now, trigger: args.trigger },
    claims,
    coverage,
    subject,
    peers,
    companyName: company,
    bookingUrl: process.env.PUBLIC_CAL_LINK || undefined,
    synthesis: synthesis?.synthesis ?? null,
    synthesisModel: synthesis?.model,
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
  await writeFile(join(dir, 'report.html'), html);

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
  mark('06 analysis + render');
  console.error('\nTime per stage:');
  for (const t of timings) {
    console.error(`  ${t.stage.padEnd(22)} ${(t.ms / 1000).toFixed(1)}s`);
  }
  console.error(`  ${'TOTAL'.padEnd(22)} ${((Date.now() - runStart) / 1000).toFixed(1)}s`);
  console.error(`\n${ledger.format()}`);
  console.error(`\nwrote ${join(dir, 'report.html')}  (and report.md)`);
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
