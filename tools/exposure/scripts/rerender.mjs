/**
 * Re-render a completed run's HTML from its stored artifacts.
 *
 * Presentation is the part of this pipeline that gets iterated on most, and a
 * full run costs real money and several minutes. Every input the renderer
 * takes is already written to the run directory, so re-reading them is exact:
 * the same claims, the same synthesis, the same coverage — only the layout
 * changes. If a re-render differs from the original in anything but styling,
 * that is a renderer bug worth knowing about.
 *
 *   node scripts/rerender.mjs runs/<domain>/<runId>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderReportHtml } from '../src/render/report-html.ts';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/rerender.mjs runs/<domain>/<runId>');
  process.exit(2);
}

const read = async (name) => JSON.parse(await readFile(join(dir, name), 'utf8'));

const meta = await read('00-meta.json');
const subject = await read('01-subject.json');
const peers = await read('02-peers.json');
const claims = await read('claims.json');
const coverage = await read('coverage.json');
const synthesis = await read('06-synthesis.json').catch(() => null);

const html = renderReportHtml({
  meta: {
    runId: meta.runId,
    domain: meta.domain,
    startedAt: meta.startedAt,
    trigger: meta.trigger,
  },
  claims,
  coverage,
  subject,
  peers,
  /* From the run's own metadata, so a re-render is addressed to the same
     company as the original. COMPANY_NAME overrides it for older runs, which
     were written before the field existed. */
  companyName: meta.companyName || process.env.COMPANY_NAME,
  bookingUrl: process.env.PUBLIC_CAL_LINK || undefined,
  synthesis: synthesis?.synthesis ?? null,
  synthesisModel: synthesis?.model,
});

const out = process.argv[3] || join(dir, 'report.html');
await writeFile(out, html);
console.error(`wrote ${out} (${(html.length / 1024).toFixed(1)} kB)`);
