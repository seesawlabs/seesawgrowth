/* ---------------------------------------------------------------------------
   Liveness: is every cited URL still there, and what does it look like?

   The mandatory human review used to be ten minutes of clicking every source
   in the register. This does the clicking at report time and attaches the
   result to each row: the HTTP status, where a redirect landed, when we
   checked, and a small screenshot. The verdict stays human. What changes is
   that the reviewer reads a column and glances at a strip of thumbnails
   instead of opening thirty tabs, which is how an unskippable step stops
   getting skipped.

   API endpoints are not pages. A DataForSEO URL answers 401 to an anonymous
   GET and there is nothing to screenshot; those rows say "API, data pulled
   under our credentials" and carry the pull date from the register.

   Screenshots go through the same headless Chrome the PDF does (lib/pdf.ts).
   No Chrome means no thumbnails and a note, never a failed run.
--------------------------------------------------------------------------- */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { findChrome } from './pdf.ts';
import { USER_AGENT } from './http.ts';

export type SourceKind = 'page' | 'api';

export interface SourceCheck {
  url: string;
  kind: SourceKind;
  /** HTTP status of the final response, or null when the request failed. */
  status: number | null;
  /** 2xx or 3xx-resolved-to-2xx. */
  ok: boolean;
  /** Where we ended up, when it differs from `url`. */
  finalUrl?: string;
  checkedAt: string;
  error?: string;
  /** Path to a PNG, when one was taken. */
  screenshot?: string;
  note?: string;
}

const API_HOSTS = ['api.dataforseo.com', 'api.firecrawl.dev', 'api.exa.ai', 'api.perplexity.ai'];

export function classify(url: string): SourceKind {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return API_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? 'api' : 'page';
  } catch {
    return 'page';
  }
}

/** One URL per row: the register lists sources once each, in first-use order. */
export function uniqueUrls(urls: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const key = u.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function fetchStatus(url: string, timeoutMs: number): Promise<Pick<SourceCheck, 'status' | 'ok' | 'finalUrl' | 'error'>> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    /* Read a little so servers that stream do not keep the socket open. */
    try {
      await res.body?.cancel();
    } catch {
      /* fine */
    }
    const finalUrl = res.url && res.url !== url ? res.url : undefined;
    return { status: res.status, ok: res.status >= 200 && res.status < 300, finalUrl };
  } catch (error) {
    return { status: null, ok: false, error: (error as Error).message.slice(0, 160) };
  }
}

function screenshot(chrome: string, url: string, file: string, timeoutMs: number): boolean {
  const run = spawnSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--window-size=800,600',
      '--virtual-time-budget=4000',
      `--user-agent=${USER_AGENT}`,
      `--screenshot=${file}`,
      url,
    ],
    { timeout: timeoutMs, encoding: 'utf8' }
  );
  if (run.error || !existsSync(file)) return false;
  try {
    return statSync(file).size > 1_000;
  } catch {
    return false;
  }
}

export interface LivenessOptions {
  /** Where screenshots are written. Created if missing. */
  dir: string;
  screenshots?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  now?: string;
}

/**
 * Check every URL. Fetches run a few at a time; screenshots run one at a
 * time, because each is a Chrome process. Never throws: a URL that cannot be
 * checked is a row that says so.
 */
export async function checkSources(urls: string[], opts: LivenessOptions): Promise<SourceCheck[]> {
  const now = opts.now ?? new Date().toISOString();
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const list = uniqueUrls(urls);
  const results: SourceCheck[] = list.map((url) => ({
    url,
    kind: classify(url),
    status: null,
    ok: false,
    checkedAt: now,
  }));

  /* Fetch statuses, a few at a time. */
  const pages = results.filter((r) => r.kind === 'page');
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pages.length) }, async () => {
      while (cursor < pages.length) {
        const r = pages[cursor++];
        Object.assign(r, await fetchStatus(r.url, timeoutMs));
      }
    })
  );
  for (const r of results) {
    if (r.kind === 'api') {
      r.ok = true;
      r.note = 'API endpoint; data was pulled under our credentials on the date in the register. Not a page.';
    }
  }

  /* Screenshots, one Chrome at a time. */
  if (opts.screenshots !== false) {
    const chrome = findChrome();
    if (!chrome) {
      for (const r of pages) r.note = [r.note, 'no Chrome on this machine, so no screenshot'].filter(Boolean).join('; ');
    } else {
      mkdirSync(opts.dir, { recursive: true });
      pages.forEach((r, i) => {
        if (r.status === null) return;
        const file = join(opts.dir, `source-${String(i + 1).padStart(2, '0')}.png`);
        if (screenshot(chrome, r.finalUrl ?? r.url, file, Math.max(timeoutMs, 30_000))) r.screenshot = file;
      });
    }
  }

  return results;
}

/** Inline a screenshot for a single-file HTML document. */
export function screenshotDataUri(file: string): string | null {
  try {
    return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}

/** A one-line human summary for the method section and the Slack message. */
export function summariseLiveness(checks: SourceCheck[]): string {
  const pages = checks.filter((c) => c.kind === 'page');
  const dead = pages.filter((c) => !c.ok);
  const apis = checks.length - pages.length;
  const parts = [`${pages.length} page(s) checked, ${pages.length - dead.length} reachable`];
  if (dead.length) parts.push(`${dead.length} not reachable: ${dead.map((d) => d.status ?? 'error').join(', ')}`);
  if (apis) parts.push(`${apis} API source(s) not fetched`);
  return parts.join('; ');
}
