/* ---------------------------------------------------------------------------
   Exa client — company search and news search.

   Auth is `x-api-key`, not a Bearer token. Probed live 2026-08-24.

   The important finding is about `score`, and it is a trap rather than a
   detail. In a `category:"company"` search the scores came back as

     1, 0.889, 0.778, 0.667, 0.556, 0.444, 0.333, 0.222, 0.111, 0

   for ten results — exactly 1 - i/(n-1). It is the rank index rescaled, not a
   similarity, and it carries no information about how good a match anything
   is. The `findSimilar` endpoint's scores looked like real similarities
   (0.959, 0.934, …) but they measured "about the same entity", which is not
   "comparable company".

   So no score here is usable as confidence. Stage 02 derived confidence from
   agreement between two generators until 2026-09-04, when the second was cut:
   findSimilar retrieved pages *about* the subject rather than companies like
   it — directories, profile pages, mirrors — and contributed no surviving peer
   across seven live targets. Its client function went with it; the filters it
   taught us to write are still in lib/domain.ts.

   `contents.text` came back at no extra charge in the probe (total 0.017 =
   search 0.007 + summary 0.010); `summary` is the billed part. We ask for text
   and skip summary, because the text is what the names-the-subject filter
   needs and the summary is prose we would not quote anyway.
--------------------------------------------------------------------------- */

import { cached, type CacheOptions } from '../cache.ts';
import { requireCredential } from '../env.ts';
import { jsonRequest } from '../http.ts';
import type { Ledger } from '../budget.ts';

const BASE = 'https://api.exa.ai';

export interface ExaResult {
  id: string;
  url: string;
  title?: string;
  author?: string;
  /** See the module note: never use this as confidence. */
  score?: number;
  publishedDate?: string;
  text?: string;
  summary?: string;
  favicon?: string;
  image?: string;
  entities?: unknown;
}

export interface ExaResponse {
  requestId: string;
  resolvedSearchType?: string;
  results: ExaResult[];
  costDollars?: { total: number; search?: Record<string, number>; summary?: number };
  searchTime?: number;
}

function authHeaders(): Record<string, string> {
  return { 'x-api-key': requireCredential('EXA_API_KEY') };
}

async function call(
  cache: CacheOptions,
  ledger: Ledger,
  endpoint: 'search',
  request: Record<string, unknown>,
  label: string,
  now: string
): Promise<ExaResponse> {
  const { response, hit } = await cached<ExaResponse>(cache, `exa-${endpoint}`, request, now, async () => {
    ledger.assertHeadroom(`exa ${endpoint} ${label}`, 0.03);
    return jsonRequest<ExaResponse>(`${BASE}/${endpoint}`, {
      body: request,
      headers: authHeaders(),
      throttleHost: 'api.exa.ai',
    });
  });

  if (hit) ledger.free('exa', `${endpoint} ${label}`);
  else ledger.reported('exa', `${endpoint} ${label}`, response.costDollars?.total ?? 0);

  return response;
}

/** Neural company search. The generator that actually returns peers. */
export function searchCompanies(
  cache: CacheOptions,
  ledger: Ledger,
  query: string,
  numResults: number,
  now: string,
  textChars = 1200
): Promise<ExaResponse> {
  return call(
    cache,
    ledger,
    'search',
    {
      query,
      numResults,
      category: 'company',
      type: 'neural',
      contents: { text: { maxCharacters: textChars } },
    },
    query.slice(0, 48),
    now
  );
}

/**
 * News about one company, published since a date.
 *
 * `category: 'news'` plus `startPublishedDate` is the whole point: stage 03b
 * needs recent, dated reporting, and an undated result is unusable there. Exa
 * returns `publishedDate` per result and the stage drops anything without one,
 * so the filter is belt and braces rather than trust.
 *
 * `type: 'auto'` because a company name is a keyword query as much as a
 * semantic one, and neural search on a name returns the sector.
 */
export function searchNews(
  cache: CacheOptions,
  ledger: Ledger,
  query: string,
  numResults: number,
  startPublishedDate: string,
  now: string,
  textChars = 800
): Promise<ExaResponse> {
  return call(
    cache,
    ledger,
    'search',
    {
      query,
      numResults,
      category: 'news',
      type: 'auto',
      startPublishedDate,
      contents: { text: { maxCharacters: textChars } },
    },
    `news ${query.slice(0, 40)}`,
    now
  );
}
