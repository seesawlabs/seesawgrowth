#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Release a generated report to its recipient.

   The second half of fulfilling a request. `npm run report` in tools/exposure
   produces the document; this puts it where the site can serve it, mints the
   magic link, and prints it. It is the step a human performs today, and the
   step a worker will perform when the review gate retires — so it is a script
   rather than a paragraph in a runbook.

     node scripts/release-report.mjs --domain senderrarx.com --email d@x.com

   By default it releases the newest run for that domain, refuses to release a
   report below the coverage threshold, and prints the link rather than sending
   it. Nothing here emails anyone yet: RESEND_TOKEN is not wired, and a script
   that silently fails to send is worse than one that hands you a link to paste.

   Flags:
     --run <id>       release a specific run instead of the newest
     --force          release below the coverage threshold anyway
     --ttl <days>     link lifetime (default 30)
     --base <url>     site origin for the link
--------------------------------------------------------------------------- */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { mintToken, linkFor, reportIdFor, DEFAULT_TTL_DAYS } from '../src/lib/magic-link.ts';

const HERE = new URL('.', import.meta.url).pathname;
const SITE_ROOT = resolve(HERE, '..');
const EXPOSURE_ROOT = resolve(SITE_ROOT, '../../tools/exposure');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const domain = arg('domain');
const email = arg('email');
if (!domain || !email) {
  console.error('Usage: node scripts/release-report.mjs --domain <domain> --email <email>');
  process.exit(1);
}

/* Same minimal .env reader the pipeline uses — the secret lives in one place
   and this script must agree with the route that verifies the token. */
async function loadEnv(dir) {
  try {
    const raw = await readFile(join(dir, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (v.length >= 2 && /^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
      if (v && !process.env[k]) process.env[k] = v;
    }
  } catch {
    /* no .env — the environment is expected to carry the values */
  }
}
await loadEnv(SITE_ROOT);
await loadEnv(EXPOSURE_ROOT);

const secret = process.env.EXPOSURE_LINK_SECRET;
if (!secret) {
  console.error(
    'EXPOSURE_LINK_SECRET is not set. Generate one and set it in both this site and\n' +
      'the environment serving /r/<token>, or every link will fail to verify:\n\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"\n'
  );
  process.exit(2);
}

const runsDir = join(EXPOSURE_ROOT, 'runs', domain.replace(/[^a-z0-9.-]/gi, '_'));
let runId = arg('run');
if (!runId) {
  try {
    const entries = await readdir(runsDir);
    runId = entries.filter((e) => !e.startsWith('.')).sort().at(-1);
  } catch {
    console.error(`No runs found for ${domain}. Generate one first:\n  cd tools/exposure && npm run report -- ${domain}`);
    process.exit(3);
  }
}
if (!runId) {
  console.error(`No runs found for ${domain}.`);
  process.exit(3);
}

const runPath = join(runsDir, runId);
const read = async (name) => JSON.parse(await readFile(join(runPath, `${name}.json`), 'utf8'));

let coverage;
let html;
try {
  coverage = await read('coverage');
  html = await readFile(join(runPath, 'report.html'), 'utf8');
} catch (error) {
  console.error(
    `Could not read ${runPath}: ${error.message}\n` +
      'report.html is written by `npm run report` — an older run may only have report.md.'
  );
  process.exit(4);
}

const pct = Math.round(coverage.score * 100);
if (!coverage.sufficient && !flag('force')) {
  console.error(
    `\nRefusing to release: coverage ${pct}% is below threshold.\n` +
      `  Short: ${coverage.shortfalls.join('; ')}\n\n` +
      'A thin report to a good prospect is worse than none — route this one to a call\n' +
      'instead, or pass --force if you have read it and disagree.\n'
  );
  process.exit(5);
}

/* Store the document where the site's report store will look for it. The disk
   backend is the operator path; set EXPOSURE_REPORT_BASE_URL and upload there
   instead once this runs somewhere other than a laptop. */
const storeDir = process.env.EXPOSURE_REPORT_DIR ?? join(SITE_ROOT, '.reports');
const reportId = reportIdFor(domain, runId);
await mkdir(storeDir, { recursive: true });
await writeFile(join(storeDir, `${reportId}.html`), html);

const ttlDays = Number(arg('ttl', DEFAULT_TTL_DAYS));
const base = arg('base', process.env.PUBLIC_SITE_ORIGIN ?? 'https://realitycheck.seesawlabs.com');
const token = mintToken({ reportId, email, ttlDays }, secret);

console.log(`\n  ${domain} · run ${runId}`);
console.log(`  coverage ${pct}%${coverage.sufficient ? '' : '  (released with --force)'}`);
console.log(`  stored   ${join(storeDir, `${reportId}.html`)}`);
console.log(`  expires  ${ttlDays} days\n`);
console.log(`  ${linkFor(base, token)}\n`);

if (!process.env.RESEND_TOKEN) {
  console.log('  RESEND_TOKEN unset — nothing was emailed. Send the link above by hand.\n');
}
