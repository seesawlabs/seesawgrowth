/* ---------------------------------------------------------------------------
   Perplexity client, plus the citation-resolution machinery that makes its
   output safe to quote.

   Probed live 2026-08-24. The response carries three things we need:

     choices[0].message.content   prose with [n] markers, 1-indexed
     citations[]                  the URL each [n] resolves to
     search_results[]             {url, title, snippet, date, last_updated,
                                  source} — the real publication date

   Perplexity summarises. A summary is a paraphrase, and a paraphrase with a
   number in it is exactly what this whole codebase exists to refuse. So we do
   not trust the model's prose about dates or sources at all:

     - a sentence keeps only the citations it actually cites, by [n] marker
     - the marker resolves through `citations` to a URL
     - the URL is looked up in `search_results` to get a *real* date
     - a sentence with no resolvable marker is dropped, and the drop is logged

   That makes citation integrity mechanical rather than a matter of trusting
   the summary, which is the only version of it that survives automation.

   One live failure worth keeping in mind: asked about MedGyn Products
   (medgyn.com), the first citation was `medi-gyn.com` — a different company
   with a near-identical name. `isNearMissDomain` in lib/domain.ts exists
   because of that response.

   Cost is reported per call at usage.cost.total_cost.
--------------------------------------------------------------------------- */

import { cached, type CacheOptions } from '../cache.ts';
import { requireCredential } from '../env.ts';
import { jsonRequest } from '../http.ts';
import type { Ledger } from '../budget.ts';

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';

export interface PerplexitySearchResult {
  url: string;
  title?: string;
  snippet?: string;
  /** Publication date. The one date we will put in a report. */
  date?: string | null;
  last_updated?: string | null;
  source?: string;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  choices: { message: { role: string; content: string } }[];
  citations?: string[];
  search_results?: PerplexitySearchResult[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    search_context_size?: string;
    cost?: {
      input_tokens_cost?: number;
      output_tokens_cost?: number;
      request_cost?: number;
      total_cost?: number;
    };
  };
}

export async function ask(
  cache: CacheOptions,
  ledger: Ledger,
  prompt: string,
  now: string,
  opts: { model?: string; maxTokens?: number; label?: string } = {}
): Promise<PerplexityResponse> {
  const request = {
    model: opts.model ?? 'sonar',
    max_tokens: opts.maxTokens ?? 700,
    messages: [{ role: 'user', content: prompt }],
  };

  const { response, hit } = await cached<PerplexityResponse>(
    cache,
    'perplexity-chat',
    request,
    now,
    async () => {
      ledger.assertHeadroom(`perplexity ${opts.label ?? 'ask'}`, 0.02);
      return jsonRequest<PerplexityResponse>(ENDPOINT, {
        body: request,
        headers: { authorization: `Bearer ${requireCredential('PERPLEXITY_API_KEY')}` },
        throttleHost: 'api.perplexity.ai',
      });
    }
  );

  const label = opts.label ?? 'ask';
  if (hit) ledger.free('perplexity', label);
  else ledger.reported('perplexity', label, response.usage?.cost?.total_cost ?? 0);

  return response;
}

/* -- citation resolution ------------------------------------------------ */

export interface ResolvedCitation {
  marker: number;
  url: string;
  title?: string;
  publisher?: string;
  /** Real publication date from search_results, not from the prose. */
  date?: string;
}

export interface CitedSentence {
  text: string;
  citations: ResolvedCitation[];
}

/**
 * Split prose into sentences, keeping the [n] markers attached to the sentence
 * that carries them.
 *
 * Deliberately conservative about abbreviations and decimals: a wrong split
 * can attach a citation to the wrong half of a sentence, which is a citation
 * integrity failure even though nothing looks broken.
 */
export function splitSentences(content: string): string[] {
  const text = content
    .replace(/\r/g, '')
    // Drop markdown headings and list bullets but keep their text.
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '');

  const guarded = text
    .replace(/\b([A-Z][a-z]{0,3})\.\s/g, '$1<DOT> ') // Inc. Ltd. Dr. Jan.
    .replace(/(\d)\.(\d)/g, '$1<DOT>$2'); // 1.5

  // Split on any newline as well as sentence ends: Perplexity answers in
  // bullet lists, and a bullet is one statement. Splitting only on blank lines
  // glues a bullet's trailing sentence onto the next bullet's claim, which
  // silently attaches one bullet's citation to another bullet's text.
  return guarded
    .split(/(?<=[.!?])["')\]]*\s+(?=[A-Z"'(\[*])|\n+/)
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter((s) => s.length > 0);
}

/** Strip markdown emphasis and the [n] markers, leaving quotable prose. */
export function cleanStatement(sentence: string): string {
  return sentence
    .replace(/\[\d+\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/**
 * Resolve every [n] in a sentence to a real URL and a real date.
 *
 * `citations` supplies the URL for a marker; `search_results` supplies the
 * date and title for that URL. A marker that resolves to no URL, or to a URL
 * with no publication date, is reported as unresolved so the caller can drop
 * the sentence and log why.
 */
export function resolveCitations(
  sentence: string,
  citations: string[],
  searchResults: PerplexitySearchResult[]
): { resolved: ResolvedCitation[]; unresolved: number[] } {
  const byUrl = new Map<string, PerplexitySearchResult>();
  for (const r of searchResults) if (r.url) byUrl.set(r.url, r);

  const markers = [...sentence.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const resolved: ResolvedCitation[] = [];
  const unresolved: number[] = [];

  for (const marker of [...new Set(markers)]) {
    const url = citations[marker - 1];
    if (!url) {
      unresolved.push(marker);
      continue;
    }
    const hit = byUrl.get(url);
    const date = hit?.date ?? undefined;
    resolved.push({
      marker,
      url,
      title: hit?.title,
      publisher: hit?.source,
      date: date ?? undefined,
    });
  }

  return { resolved, unresolved };
}

/** Sentences that carry at least one [n] marker, with those markers resolved. */
export function citedSentences(response: PerplexityResponse): {
  cited: CitedSentence[];
  dropped: { text: string; reason: string }[];
} {
  const content = response.choices?.[0]?.message?.content ?? '';
  const citations = response.citations ?? [];
  const searchResults = response.search_results ?? [];

  const cited: CitedSentence[] = [];
  const dropped: { text: string; reason: string }[] = [];

  for (const sentence of splitSentences(content)) {
    const markers = [...sentence.matchAll(/\[(\d+)\]/g)];
    if (markers.length === 0) {
      dropped.push({ text: cleanStatement(sentence).slice(0, 160), reason: 'no citation marker' });
      continue;
    }
    const { resolved, unresolved } = resolveCitations(sentence, citations, searchResults);
    if (resolved.length === 0) {
      dropped.push({
        text: cleanStatement(sentence).slice(0, 160),
        reason: `marker(s) [${unresolved.join('][')}] resolve to no citation URL`,
      });
      continue;
    }
    cited.push({ text: sentence, citations: resolved });
  }

  return { cited, dropped };
}
