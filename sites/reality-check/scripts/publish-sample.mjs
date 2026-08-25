#!/usr/bin/env node
/**
 * Publish a generated brief as the public sample at /sample-brief.
 *
 * The brief page needs a "see a real one" and we cannot use a client's: the
 * document names a real company and quotes their pages back at them. So the
 * sample is the brief we ran on SeeSaw Labs itself, which is both publishable
 * and a stronger artifact than any example we could invent — the pipeline was
 * pointed at us with no special treatment, and the caveats section says what it
 * could not see about us either.
 *
 * Two changes to the generated document, both stated on the page rather than
 * done quietly:
 *   - `robots` goes from noindex to indexable. Every other brief is private;
 *     this one is marketing.
 *   - a banner is prepended saying whose brief this is and that nothing in it
 *     was edited after generation.
 *
 *   node scripts/publish-sample.mjs ../../tools/exposure/runs/seesawlabs.com/<runId>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/publish-sample.mjs <run directory>');
  process.exit(2);
}

const SITE_ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = join(SITE_ROOT, 'public', 'sample-brief');

let html = await readFile(join(dir, 'report.html'), 'utf8');
const coverage = JSON.parse(await readFile(join(dir, 'coverage.json'), 'utf8'));

/* Indexable, unlike every other brief. */
const before = html;
html = html.replace(
  '<meta name="robots" content="noindex, nofollow">',
  '<meta name="robots" content="index, follow">'
);
if (html === before) {
  console.error('Could not find the robots tag to flip — the renderer changed. Not publishing.');
  process.exit(3);
}

const banner = `<div style="background:#1a1a1a;color:#f7f6f3;padding:14px min(6vw,32px);font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.72rem;line-height:1.6;letter-spacing:.02em">
  <strong style="font-weight:600">This is a real brief, and it is about us.</strong>
  We pointed the pipeline at seesawlabs.com and published what came out.
  Nothing was edited afterwards, including the part where it tells us what we
  are missing. <a href="/brief" style="color:#f7f6f3;text-decoration:underline">Get one for your company &rarr;</a>
</div>`;

html = html.includes('<body>')
  ? html.replace('<body>', `<body>${banner}`)
  : html.replace(/(<main[^>]*>)/, `${banner}$1`);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'index.html'), html);

const pct = Math.round(coverage.score * 100);
console.error(`wrote public/sample-brief/index.html — coverage ${pct}%${coverage.sufficient ? '' : ' (BELOW THRESHOLD)'}`);
if (!coverage.sufficient) {
  console.error('Publishing our own thin brief as the sample would advertise the weakness. Regenerate first.');
  process.exit(4);
}
