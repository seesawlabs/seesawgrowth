/* ---------------------------------------------------------------------------
   DataForSEO client — DataForSEO Labs, live endpoints.

   Auth is HTTP basic (login + password), not a bearer token, and the request
   body is an *array of tasks* rather than an object. Both are easy to get
   wrong from memory; both were probed live 2026-08-24.

   Credentials: DATAFORSEO_PASSWORD was wrong for three sessions and returned
   40100 "Authentication failed". A 200 with `status_code: 40100` in the body
   is how this API reports a bad password — the HTTP status is still 200, so
   `jsonRequest` cannot catch it and `verifyAuth()` has to read the envelope.
   That is why stage 04 verifies before it spends anything.

   Probed live 2026-08-24 on this account:

     appendix/user_data                  cost 0, money.total 51 (USD balance)
     dataforseo_labs/.../keyword_overview/live   cost 0.01224 for 3 keywords
     dataforseo_labs/.../ranked_keywords/live    cost 0.0132 for 10 rows

   Two things the probe taught us that guessing would not have:

     1. Labs endpoints are $0.012/request + $0.00012/result. The older
        `keywords_data/google_ads/search_volume/live` path is $0.09/request —
        7x more for the same search volume. Labs is the right family here.

     2. `keyword_info.last_updated_time` is Google's own refresh date for that
        keyword's data — on the probe, 2026-07-12, six weeks before the pull.
        So there are *two* dates on every demand figure: when we pulled it and
        how stale it already was when we did. A report that stamps only the
        pull date implies freshness it does not have, so stage 04 carries both.

   Cost is reported per response at the top-level `cost` field, in USD.
--------------------------------------------------------------------------- */

import { cached, type CacheOptions } from '../cache.ts';
import { requireCredential } from '../env.ts';
import { jsonRequest } from '../http.ts';
import type { Ledger } from '../budget.ts';

const BASE = 'https://api.dataforseo.com/v3';

/** US, English. The only market this pipeline sells into today. */
export const US_LOCATION_CODE = 2840;
export const EN_LANGUAGE_CODE = 'en';

/** Envelope every DataForSEO response shares. */
export interface DfsEnvelope<T> {
  version: string;
  status_code: number;
  status_message: string;
  /** USD, reported. Present on every response including free ones. */
  cost: number;
  tasks_count?: number;
  tasks_error?: number;
  tasks: {
    id: string;
    status_code: number;
    status_message: string;
    cost?: number;
    result_count?: number;
    result?: T[] | null;
  }[];
}

export interface KeywordInfo {
  last_updated_time?: string;
  competition?: number | null;
  competition_level?: string | null;
  cpc?: number | null;
  search_volume?: number | null;
  low_top_of_page_bid?: number | null;
  high_top_of_page_bid?: number | null;
  monthly_searches?: { year: number; month: number; search_volume: number | null }[];
}

export interface KeywordProperties {
  keyword_difficulty?: number | null;
  detected_language?: string | null;
}

export interface SearchIntentInfo {
  main_intent?: string | null;
  last_updated_time?: string | null;
}

export interface KeywordOverviewItem {
  keyword: string;
  location_code?: number;
  language_code?: string;
  keyword_info?: KeywordInfo;
  keyword_properties?: KeywordProperties;
  search_intent_info?: SearchIntentInfo;
}

export interface KeywordOverviewResult {
  items?: KeywordOverviewItem[] | null;
  items_count?: number;
}

export interface RankedKeywordItem {
  keyword_data?: {
    keyword?: string;
    keyword_info?: KeywordInfo;
    keyword_properties?: KeywordProperties;
  };
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number;
      rank_absolute?: number;
      domain?: string;
      title?: string;
      url?: string;
    };
  };
}

export interface RankedKeywordsResult {
  target?: string;
  total_count?: number;
  items_count?: number;
  items?: RankedKeywordItem[] | null;
}

function authHeader(): Record<string, string> {
  const login = requireCredential('DATAFORSEO_LOGIN');
  const password = requireCredential('DATAFORSEO_PASSWORD');
  return { authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}` };
}

/**
 * A DataForSEO failure arrives as HTTP 200 with an error code in the body, so
 * every response has to be inspected rather than trusted. 40100 specifically
 * means the login or password is wrong.
 */
export class DataForSeoError extends Error {
  // Explicit fields, not constructor parameter properties: node's strip-only
  // TypeScript mode rejects those. See the same note in lib/budget.ts.
  readonly statusCode: number;
  readonly statusMessage: string;
  readonly endpoint: string;

  constructor(statusCode: number, statusMessage: string, endpoint: string) {
    super(
      statusCode === 40100
        ? `DataForSEO rejected the credentials (40100 ${statusMessage}) on ${endpoint}. ` +
            'Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD — presence is not validity.'
        : `DataForSEO ${statusCode} ${statusMessage} on ${endpoint}`
    );
    this.name = 'DataForSeoError';
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
    this.endpoint = endpoint;
  }
}

export function assertOk<T>(body: DfsEnvelope<T>, endpoint: string): DfsEnvelope<T> {
  if (body.status_code !== 20000) {
    throw new DataForSeoError(body.status_code, body.status_message, endpoint);
  }
  return body;
}

/** First task's result rows, or [] — a task can succeed with no data. */
export function firstResult<T>(body: DfsEnvelope<T>): T | null {
  return body.tasks?.[0]?.result?.[0] ?? null;
}

async function post<T>(
  cache: CacheOptions,
  ledger: Ledger,
  endpoint: string,
  payload: Record<string, unknown>,
  label: string,
  now: string,
  expected: number
): Promise<DfsEnvelope<T>> {
  // Cache on an object, not the array body: cacheKey sorts object keys for a
  // stable hash, and an array's key order is positional rather than canonical.
  const request = { endpoint, payload };

  const { response, hit } = await cached<DfsEnvelope<T>>(
    cache,
    'dataforseo',
    request,
    now,
    async () => {
      ledger.assertHeadroom(`dataforseo ${label}`, expected);
      return jsonRequest<DfsEnvelope<T>>(`${BASE}/${endpoint}`, {
        body: [payload],
        headers: authHeader(),
        throttleHost: 'api.dataforseo.com',
      });
    }
  );

  if (hit) ledger.free('dataforseo', `${endpoint} ${label}`);
  else ledger.reported('dataforseo', `${endpoint} ${label}`, response.cost ?? 0);

  return assertOk(response, endpoint);
}

/**
 * Free auth check. Confirms the credentials *and* reports the account balance,
 * because a valid login with an empty wallet fails in a way that looks like a
 * bug in this code. Not cached: an auth check reading a stale cache entry is
 * an auth check that proves nothing.
 */
export async function verifyAuth(): Promise<{ login: string; balanceUsd: number }> {
  const body = await jsonRequest<
    DfsEnvelope<{ login?: string; money?: { total?: number; balance?: number } }>
  >(`${BASE}/appendix/user_data`, {
    headers: authHeader(),
    method: 'GET',
    throttleHost: 'api.dataforseo.com',
  });
  assertOk(body, 'appendix/user_data');
  const result = firstResult(body);
  return {
    login: result?.login ?? '(unknown)',
    balanceUsd: result?.money?.total ?? result?.money?.balance ?? 0,
  };
}

/**
 * Search volume, CPC, difficulty and intent for a list of terms. One request
 * covers the whole list, which is why stage 04 batches rather than looping.
 */
export function keywordOverview(
  cache: CacheOptions,
  ledger: Ledger,
  keywords: string[],
  now: string
): Promise<DfsEnvelope<KeywordOverviewResult>> {
  return post<KeywordOverviewResult>(
    cache,
    ledger,
    'dataforseo_labs/google/keyword_overview/live',
    {
      keywords,
      location_code: US_LOCATION_CODE,
      language_code: EN_LANGUAGE_CODE,
    },
    `${keywords.length} keyword(s)`,
    now,
    0.05
  );
}

/** Terms a domain already ranks for, highest volume first. */
export function rankedKeywords(
  cache: CacheOptions,
  ledger: Ledger,
  target: string,
  limit: number,
  now: string
): Promise<DfsEnvelope<RankedKeywordsResult>> {
  return post<RankedKeywordsResult>(
    cache,
    ledger,
    'dataforseo_labs/google/ranked_keywords/live',
    {
      target,
      location_code: US_LOCATION_CODE,
      language_code: EN_LANGUAGE_CODE,
      limit,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
    },
    target,
    now,
    0.05
  );
}

/** Provenance URL for a demand figure. The cache key is the real audit trail. */
export function sourceUrlFor(endpoint: string): string {
  return `${BASE}/${endpoint}`;
}
