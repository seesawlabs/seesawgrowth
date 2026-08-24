/* ---------------------------------------------------------------------------
   Firecrawl client — v2 map and scrape.

   Written against responses probed live on 2026-08-24 against hpsrx.com. Two
   things the probe taught us that guessing would not have:

     1. `map` returned 31 links but only 9 carried a title or description.
        So page *selection* cannot depend on titles — it has to work from URL
        paths, with title and description as a bonus when present. Code that
        assumed titles would have silently selected nothing here.

     2. `map` includes `sitemap.xml` and other non-page URLs, which have to be
        filtered before they eat scrape credits.

   Firecrawl reports `creditsUsed` per scrape but no dollar figure, so it is
   the one service whose cost is an estimate at a configured rate.
--------------------------------------------------------------------------- */

import { cached, type CacheOptions } from '../cache.ts';
import { requireCredential } from '../env.ts';
import { jsonRequest, mayFetch } from '../http.ts';
import type { Ledger } from '../budget.ts';

const BASE = 'https://api.firecrawl.dev/v2';

export interface FirecrawlLink {
  url: string;
  title?: string;
  description?: string;
}

export interface MapResponse {
  success: boolean;
  id?: string;
  links: FirecrawlLink[];
}

export interface ScrapeMetadata {
  title?: string;
  description?: string;
  sourceURL?: string;
  url?: string;
  statusCode?: number;
  contentType?: string;
  cacheState?: string;
  creditsUsed?: number;
  [key: string]: unknown;
}

export interface ScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: ScrapeMetadata;
  };
  error?: string;
}

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${requireCredential('FIRECRAWL_API_KEY')}` };
}

/**
 * Enumerate a site's URLs. One call, cheap, and it carries enough signal to
 * choose which pages are worth scraping — which is the whole reason to map
 * before scraping rather than crawling everything.
 */
export async function map(
  cache: CacheOptions,
  ledger: Ledger,
  url: string,
  limit: number,
  now: string
): Promise<MapResponse> {
  const request = { url, limit };
  const { response, hit } = await cached<MapResponse>(cache, 'firecrawl-map', request, now, async () => {
    ledger.assertHeadroom(`firecrawl map ${url}`, 0.01);
    return jsonRequest<MapResponse>(`${BASE}/map`, {
      body: request,
      headers: authHeaders(),
      throttleHost: 'api.firecrawl.dev',
    });
  });

  if (hit) ledger.free('firecrawl', `map ${url}`);
  // Map returns no creditsUsed; treat as 1 credit, labelled an estimate.
  else ledger.fromCredits(`map ${url}`, 1);

  return response;
}

export interface ScrapeResult {
  url: string;
  ok: boolean;
  markdown: string;
  title?: string;
  description?: string;
  statusCode?: number;
  /** Set when we declined to fetch, with the reason. */
  skipped?: string;
  cached: boolean;
}

/**
 * Scrape one page to markdown.
 *
 * robots.txt is checked here, before the request. Firecrawl does the fetching,
 * but choosing to request a page is our decision and so is the obligation.
 */
export async function scrape(
  cache: CacheOptions,
  ledger: Ledger,
  url: string,
  now: string
): Promise<ScrapeResult> {
  const permission = await mayFetch(url);
  if (!permission.allowed) {
    return { url, ok: false, markdown: '', skipped: permission.reason, cached: false };
  }

  const request = { url, formats: ['markdown'] };
  let response: ScrapeResponse;
  let hit: boolean;
  try {
    const result = await cached<ScrapeResponse>(cache, 'firecrawl-scrape', request, now, async () => {
      ledger.assertHeadroom(`firecrawl scrape ${url}`, 0.01);
      return jsonRequest<ScrapeResponse>(`${BASE}/scrape`, {
        body: request,
        headers: authHeaders(),
        throttleHost: 'api.firecrawl.dev',
      });
    });
    response = result.response;
    hit = result.hit;
  } catch (error) {
    return { url, ok: false, markdown: '', skipped: `fetch failed: ${(error as Error).message.slice(0, 160)}`, cached: false };
  }

  const credits = response.data?.metadata?.creditsUsed ?? 1;
  if (hit) ledger.free('firecrawl', `scrape ${url}`);
  else ledger.fromCredits(`scrape ${url}`, credits);

  return {
    url,
    ok: Boolean(response.success && response.data?.markdown),
    markdown: response.data?.markdown ?? '',
    title: response.data?.metadata?.title,
    description: response.data?.metadata?.description,
    statusCode: response.data?.metadata?.statusCode,
    cached: hit,
  };
}
