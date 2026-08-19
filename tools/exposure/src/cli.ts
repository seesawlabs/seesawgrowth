/* ---------------------------------------------------------------------------
   CLI.

     npm run prototype              assemble the fixture -> runs/_prototype/
     npm run report -- <domain>     full pipeline (needs credentials)

   `prototype` needs no credentials and no network. It exists so the report
   format is reviewable and arguable before a single API call is spent.
--------------------------------------------------------------------------- */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { scoreCoverage, summarizeCoverage } from './lib/claim.ts';
import { initRun, writeArtifact } from './lib/run.ts';
import { assembleReport } from './stages/05-assemble.ts';
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

const [command] = process.argv.slice(2);

switch (command) {
  case 'prototype':
    await prototype();
    break;
  case 'report':
    console.error(
      'Not wired yet. Stages 01-04 need credentials — see README.md "Credentials".\n' +
        'Run `npm run prototype` to review the report format in the meantime.'
    );
    process.exit(2);
    break;
  default:
    console.error('Usage: cli.ts <prototype|report>');
    process.exit(1);
}
