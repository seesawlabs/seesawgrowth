#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   The release half of .github/workflows/analysis.yml.

   Two modes, mirroring the two links in the Slack alert:

     --mode run    upload the brief, mint a link to READ it, post it to Slack
                   with the coverage figure and a "send it" link. Emails nobody.
     --mode send   mint the same link and email it to the recipient.

   THE REVIEW GATE SURVIVES BEING AUTOMATED. A `run` never emails. What it
   posts is a link for a human to read and a second link to act on. Turning the
   two commands into two clicks must not quietly turn them into one.

   WHY `send` NEEDS NO RUN DIRECTORY. The magic link is a signature over the
   report id, and the site fetches the document from the store. So sending is
   minting plus an email; the brief was uploaded during the run.
--------------------------------------------------------------------------- */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  mintToken,
  linkFor,
  reportIdFor,
  storageNameFor,
  DEFAULT_TTL_DAYS,
} from '../src/lib/magic-link.ts';
import { mintActionToken, actionLink } from '../src/lib/run-link.ts';
import { readyEmail, sendEmail } from '../src/lib/email.ts';

const SITE_ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const EXPOSURE_ROOT = resolve(SITE_ROOT, '../../tools/exposure');

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const mode = arg('mode', 'run');
const domain = arg('domain');
const email = arg('email');
const name = arg('name', '');
const company = arg('company', domain);
const runUrl = arg('run-url', '');

const die = (msg, code = 1) => {
  console.error(`\n${msg}\n`);
  process.exit(code);
};

if (!domain || !email) die('ci-release needs --domain and --email');

const secret = process.env.EXPOSURE_LINK_SECRET;
if (!secret) die('EXPOSURE_LINK_SECRET is not set. Nothing can be signed or stored.', 2);

const origin = process.env.PUBLIC_SITE_ORIGIN || 'https://seesawgrowth.vercel.app';
const runsDir = join(EXPOSURE_ROOT, 'runs', domain.replace(/[^a-z0-9.-]/gi, '_'));

async function newestRun() {
  try {
    const entries = await readdir(runsDir);
    return entries.filter((e) => !e.startsWith('.')).sort().at(-1) ?? null;
  } catch {
    return null;
  }
}

async function slack(text) {
  const hook = process.env.SLACK_WEBHOOK;
  if (!hook) {
    console.log(`[ci-release] Slack unset. Would have said:\n${text}`);
    return;
  }
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    /* Do not let Slack fetch our own links to build previews: the run link is
       a GET that renders a confirmation page, and an unfurl of it is a wasted
       request at best. */
    body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false }),
  });
  if (!res.ok) console.error(`[ci-release] Slack ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/* ------------------------------- send -------------------------------- */

if (mode === 'send') {
  const runId = arg('run') || (await newestRun());
  if (!runId) die('No run id given and none on disk. Cannot work out which brief to send.', 3);

  const reportId = reportIdFor(domain, runId);
  const link = linkFor(origin, mintToken({ reportId, email, ttlDays: DEFAULT_TTL_DAYS }, secret));

  const message = readyEmail({
    name,
    company,
    link,
    ttlDays: DEFAULT_TTL_DAYS,
    bookingUrl: process.env.PUBLIC_CAL_LINK ? `${origin}/book-call` : undefined,
  });
  const result = await sendEmail(email, message, { RESEND_TOKEN: process.env.RESEND_TOKEN });

  if (!result.sent) {
    await slack(`:x: *Could not email ${company}* — ${result.reason}\nThe link is valid, send it by hand:\n${link}`);
    die(`Not sent: ${result.reason}`, 6);
  }
  await slack(`:white_check_mark: *Sent to ${name} <${email}>* — ${company}\nThey have the link, valid ${DEFAULT_TTL_DAYS} days.`);
  console.log(`Emailed ${email}.`);
  process.exit(0);
}

/* -------------------------------- run -------------------------------- */

const runId = arg('run') || (await newestRun());
if (!runId) die('The pipeline left no run directory. Nothing to release.', 3);

const runPath = join(runsDir, runId);
let html, coverage;
try {
  html = await readFile(join(runPath, 'report.html'), 'utf8');
  coverage = JSON.parse(await readFile(join(runPath, 'coverage.json'), 'utf8'));
} catch (error) {
  die(`Could not read ${runPath}: ${error.message}`, 4);
}

const pct = Math.round(coverage.score * 100);
const storedName = `${storageNameFor(reportIdFor(domain, runId), secret)}.html`;

/* Upload before minting anything. A link that resolves to nothing is worse
   than no link, and this is the step most likely to fail on a fresh setup. */
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const base = process.env.EXPOSURE_REPORT_BASE_URL;
if (!blobToken || !base) {
  await slack(
    `:warning: *${company} (${domain})* generated at ${pct}% coverage, but there is nowhere to put it.\n` +
      `Set ${!blobToken ? 'BLOB_READ_WRITE_TOKEN' : 'EXPOSURE_REPORT_BASE_URL'} and run it again.` +
      (runUrl ? `\n${runUrl}` : '')
  );
  die('No blob store configured. The brief was generated but not stored.', 5);
}

const { put } = await import('@vercel/blob');
const prefix = new URL(base).pathname.replace(/^\/+|\/+$/g, '');
const pathname = prefix ? `${prefix}/${storedName}` : storedName;

let uploaded;
try {
  uploaded = await put(pathname, html, {
    access: 'public',
    contentType: 'text/html; charset=utf-8',
    token: blobToken,
    /* The name is an HMAC of the report id, so it is stable for a given run.
       Re-running a release for the same run should replace, not fail. */
    addRandomSuffix: false,
    allowOverwrite: true,
  });
} catch (error) {
  await slack(`:x: *Upload failed for ${company}* — ${String(error.message).slice(0, 300)}` + (runUrl ? `\n${runUrl}` : ''));
  die(`Upload failed: ${error.message}`, 7);
}
console.log(`Uploaded ${pathname}`);

/* What the reader clicks. The same link the client would get, so a reviewer
   sees exactly what was sent rather than a preview of it. */
const readLink = linkFor(
  origin,
  mintToken({ reportId: reportIdFor(domain, runId), email, ttlDays: DEFAULT_TTL_DAYS }, secret)
);

/* And the link that sends it, carrying the run id so the click needs nothing. */
const sendLink = actionLink(
  origin,
  mintActionToken(
    { a: 'send', domain, email, name, company, category: '', peers: [], run: runId },
    secret
  )
);

const short = coverage.sufficient
  ? `:white_check_mark: *${pct}% coverage* — enough to send.`
  : `:warning: *${pct}% coverage — below threshold.* Short: ${(coverage.shortfalls ?? []).join('; ')}. Read it before deciding.`;

await slack(
  [
    `*${company}* (${domain}) — analysis ready`,
    short,
    `For ${name} <${email}>`,
    '',
    `:eyes: *Read it first:* ${readLink}`,
    `:outbox_tray: *Then send it:* ${sendLink}`,
    runUrl ? `\n_${runUrl}_` : '',
  ]
    .filter(Boolean)
    .join('\n')
);

console.log(`\nReady. Coverage ${pct}%. Review: ${readLink}\n`);
if (!uploaded?.url) console.error('Note: upload returned no URL, which is unexpected.');
