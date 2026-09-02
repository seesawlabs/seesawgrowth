/* ---------------------------------------------------------------------------
   HTML to PDF through whatever Chrome is on the machine.

   No Puppeteer, no Playwright dependency: the research report is a print
   stylesheet and a static page, and headless Chrome's own --print-to-pdf does
   the job with nothing to install. GitHub's ubuntu runners ship Google Chrome;
   the Claude Code environment ships Playwright's Chromium under
   /opt/pw-browsers; a laptop has one or the other. `CHROME_BIN` overrides.

   Failure is a reason, not an exception. A run whose PDF could not be printed
   still produced the HTML and the email draft, and the release step decides
   what to do with a missing file. Chrome not being installed must never be
   why a paid-for run fails.
--------------------------------------------------------------------------- */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];

function onPath(name: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not here */
    }
  }
  return null;
}

function playwrightChromium(): string | null {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', join(process.env.HOME ?? '', '.cache/ms-playwright')].filter(
    (x): x is string => Boolean(x)
  );
  for (const root of roots) {
    let entries: string[] = [];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const e of entries.filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = join(root, e, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

export function findChrome(): string | null {
  for (const env of ['CHROME_BIN', 'PUPPETEER_EXECUTABLE_PATH', 'CHROME_PATH']) {
    const v = process.env[env];
    if (v && existsSync(v)) return v;
  }
  for (const n of NAMES) {
    const p = onPath(n);
    if (p) return p;
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(mac)) return mac;
  return playwrightChromium();
}

export interface PdfResult {
  ok: boolean;
  chrome?: string;
  reason?: string;
}

export function renderPdf(htmlPath: string, pdfPath: string, opts: { timeoutMs?: number } = {}): PdfResult {
  const chrome = findChrome();
  if (!chrome) return { ok: false, reason: 'no Chrome or Chromium found (set CHROME_BIN)' };

  const args = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=4000',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ];
  const run = spawnSync(chrome, args, { timeout: opts.timeoutMs ?? 90_000, encoding: 'utf8' });
  if (run.error) return { ok: false, chrome, reason: run.error.message };
  if (!existsSync(pdfPath)) {
    return { ok: false, chrome, reason: `chrome exited ${run.status} without writing a file: ${(run.stderr ?? '').slice(-300)}` };
  }
  const head = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
  if (head !== '%PDF-') return { ok: false, chrome, reason: 'output is not a PDF' };
  return { ok: true, chrome };
}
