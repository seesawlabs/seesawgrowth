#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   The other half of the bundle upload in ci-release.mjs.

   A revise needs stages 01-05 on disk, and each workflow_dispatch is a fresh
   checkout on a fresh machine, so "on disk" means "downloaded here first".
   This fetches the JSON bundle a prior release put next to the client's html
   and writes it back into tools/exposure/runs/<domain>/<runId>/, so the CLI's
   `revise` command finds exactly what a same-machine dev session would have
   left behind. Run this, then run `revise` — see analysis.yml.

     node scripts/restore-run.mjs --domain <domain> --run <runId>
--------------------------------------------------------------------------- */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { reportIdFor, storageNameFor } from '../src/lib/magic-link.ts';

const SITE_ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const EXPOSURE_ROOT = resolve(SITE_ROOT, '../../tools/exposure');

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
};

const domain = arg('domain');
const runId = arg('run');
if (!domain || !runId) {
  console.error('Usage: node scripts/restore-run.mjs --domain <domain> --run <runId>');
  process.exit(1);
}

const secret = process.env.EXPOSURE_LINK_SECRET;
const base = process.env.EXPOSURE_REPORT_BASE_URL;
if (!secret || !base) {
  console.error(
    `Missing ${!secret ? 'EXPOSURE_LINK_SECRET' : 'EXPOSURE_REPORT_BASE_URL'} — cannot locate the bundle.`
  );
  process.exit(2);
}

const prefix = new URL(base).pathname.replace(/^\/+|\/+$/g, '');
const name = `${storageNameFor(reportIdFor(domain, runId), secret)}.bundle.json`;
const url = `${base.replace(/\/+$/, '')}/${name}`;

const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
if (!res.ok) {
  console.error(
    `Could not fetch the bundle for ${domain}/${runId} (${res.status} at ${url}).\n` +
      'Either this run predates bundling, or its release never completed.'
  );
  process.exit(3);
}
const bundle = await res.json();

const runDir = join(EXPOSURE_ROOT, 'runs', domain.replace(/[^a-z0-9.-]/gi, '_'), runId);
await mkdir(runDir, { recursive: true });

let written = 0;
for (const [key, value] of Object.entries(bundle)) {
  if (value == null) continue;
  await writeFile(join(runDir, `${key}.json`), JSON.stringify(value, null, 2));
  written += 1;
}

if (written === 0) {
  console.error(`Bundle for ${domain}/${runId} was empty. Nothing restored.`);
  process.exit(4);
}
console.log(`Restored ${written} file(s) into ${runDir}`);
