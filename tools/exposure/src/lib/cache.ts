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

/**
 * Deterministic JSON with object keys sorted at every depth.
 *
 * This replaces `JSON.stringify(request, Object.keys(request).sort())`, which
 * looked like a canonicaliser and was in fact a cache-poisoning bug. An array
 * second argument to `JSON.stringify` is a *recursive property allowlist*, not
 * a key order: only the top-level names survive, so every nested property was
 * silently deleted before hashing.
 *
 * Observed live on 2026-08-24, first run of stage 03. A Perplexity request is
 * `{model, max_tokens, messages}`, and `messages` holds the entire prompt, so
 * the serialised form was:
 *
 *   {"max_tokens":700,"messages":[{}],"model":"sonar"}
 *
 * The prompt vanished. All six peers hashed to one key, five were served the
 * first peer's answer from cache, and the run reported "5 from cache" as if
 * that were a saving. DataForSEO collided the same way — `{endpoint, payload}`
 * serialised to `{"endpoint":"...","payload":{}}`, so three peers' ranked
 * keywords were one peer's rows.
 *
 * Nothing about it looked broken from the outside, which is the point: this is
 * the exact class of failure — one company's evidence attributed to another —
 * that stage 03's citation gates exist to prevent, arriving through the cache
 * instead of through a model. Cache keys must be total over the request.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

export function cacheKey(service: string, request: unknown): string {
  const hash = createHash('sha256').update(`${service}:${canonicalize(request)}`).digest('hex');
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
