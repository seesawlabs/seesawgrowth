/* ---------------------------------------------------------------------------
   Disk cache for raw API responses.

   This is the difference between iterating on the report for free and paying
   for four APIs every time we change a heading. Every request is hashed and
   its raw response stored verbatim, so re-running assembly never re-fetches.

   It also gives provenance for free: the cache is the audit trail of what each
   service actually returned, which is what you want when a claim in a report
   is challenged.
--------------------------------------------------------------------------- */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface CacheEntry<T> {
  key: string;
  service: string;
  request: unknown;
  response: T;
  fetchedAt: string;
}

export interface CacheOptions {
  dir: string;
  /** Skip reads (still writes). Use when a stage's freshness matters. */
  refresh?: boolean;
}

export function cacheKey(service: string, request: unknown): string {
  const canonical = JSON.stringify(request, Object.keys(request as object).sort());
  const hash = createHash('sha256').update(`${service}:${canonical}`).digest('hex');
  return `${service}-${hash.slice(0, 16)}`;
}

function pathFor(dir: string, key: string): string {
  // Shard by first two chars so the directory stays browsable at volume.
  return join(dir, key.slice(0, 2), `${key}.json`);
}

export async function readCache<T>(
  opts: CacheOptions,
  service: string,
  request: unknown
): Promise<CacheEntry<T> | null> {
  if (opts.refresh) return null;
  const key = cacheKey(service, request);
  try {
    const raw = await readFile(pathFor(opts.dir, key), 'utf8');
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function writeCache<T>(
  opts: CacheOptions,
  service: string,
  request: unknown,
  response: T,
  now: string
): Promise<CacheEntry<T>> {
  const key = cacheKey(service, request);
  const entry: CacheEntry<T> = { key, service, request, response, fetchedAt: now };
  const file = pathFor(opts.dir, key);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(entry, null, 2));
  return entry;
}

/**
 * Cache-through wrapper. `fetcher` is only invoked on a miss.
 *
 * `now` is injected rather than read from the clock so a run's timestamps are
 * consistent and reproducible across stages.
 */
export async function cached<T>(
  opts: CacheOptions,
  service: string,
  request: unknown,
  now: string,
  fetcher: () => Promise<T>
): Promise<{ response: T; hit: boolean; fetchedAt: string }> {
  const existing = await readCache<T>(opts, service, request);
  if (existing) {
    return { response: existing.response, hit: true, fetchedAt: existing.fetchedAt };
  }
  const response = await fetcher();
  const entry = await writeCache(opts, service, request, response, now);
  return { response, hit: false, fetchedAt: entry.fetchedAt };
}
