/* ---------------------------------------------------------------------------
   Stage 00 — verify the brief's evidence.

   A teammate preparing cold outreach knows something the crawl cannot: "they
   posted a VP of Operations role last week", "the CEO announced a new clinic
   on LinkedIn", "CMS changed the reporting rule in July". That observation is
   the whole reason to write now, and the email is worthless if it is wrong.

   So the brief carries it as a URL plus a note, and this stage does the one
   thing that turns it into evidence: it reads the page and looks for a
   verbatim passage that supports the note. If the passage is there, the
   result is a Verified claim (`brief-1`, `brief-2`, …) with the page as its
   source, and the email may cite it. If it is not there, nothing is created,
   the report says the evidence was not found, and the recommendation has to
   stand without it. The teammate's own words never become a claim.

   The verbatim check is mechanical: the model proposes a quote, the code
   confirms the quote appears in the page text after whitespace and quote
   normalisation. A model that paraphrases produces no claim.
--------------------------------------------------------------------------- */

import Anthropic from '@anthropic-ai/sdk';

import type { Claim } from '../lib/claim.ts';
import type { Ledger } from '../lib/budget.ts';
import { cached, type CacheOptions } from '../lib/cache.ts';
import { requireCredential } from '../lib/env.ts';
import { scrape } from '../lib/clients/firecrawl.ts';
import { registrableDomain } from '../lib/domain.ts';
import type { BriefEvidence } from '../lib/brief.ts';

/** Cheap and precise is what a quote finder needs. */
export const BRIEF_MODEL = 'claude-sonnet-5';

export interface BriefEvidenceResult {
  url: string;
  note: string;
  status: 'verified' | 'not_supported' | 'unreachable';
  title?: string;
  quote?: string;
  detail?: string;
  claimId?: string;
}

export interface BriefArtifact {
  results: BriefEvidenceResult[];
  claims: Claim[];
  notes: string[];
}

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”]/g, (c) => (c === '‘' || c === '’' ? "'" : '"'))
    .replace(/\s+/g, ' ')
    .trim();

/** True when `quote` appears in `page` allowing for whitespace and curly quotes. */
export function verbatim(quote: string, page: string): boolean {
  const q = squash(quote);
  return q.length >= 12 && squash(page).includes(q);
}

/** Strip markdown noise so a quote can be matched against what a reader sees. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`|]/g, ' ')
    .replace(/\s+/g, ' ');
}

async function findQuote(
  cache: CacheOptions,
  ledger: Ledger,
  args: { url: string; note: string; text: string },
  now: string
): Promise<{ quote: string | null; reason: string }> {
  const excerpt = args.text.slice(0, 14_000);
  const prompt = `A colleague says this page shows: "${args.note || '(no note given; find the most newsworthy dated statement on the page)'}"

Below is the page text. Find ONE passage, copied exactly and unchanged from the text, of 8 to 45 words, that supports what the colleague says. If nothing on the page supports it, say so.

Answer as JSON only: {"quote": "<exact passage or null>", "reason": "<one sentence>"}

PAGE TEXT:
${excerpt}`;

  const request = { model: BRIEF_MODEL, purpose: 'brief-quote', url: args.url, note: args.note, hash: excerpt.length };
  const { response, hit } = await cached<{ quote: string | null; reason: string }>(
    cache,
    'anthropic-brief',
    request,
    now,
    async () => {
      ledger.assertHeadroom(`anthropic brief-quote`, 0.05);
      const client = new Anthropic({ apiKey: requireCredential('ANTHROPIC_API_KEY') });
      const message = await client.messages.create({
        model: BRIEF_MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content.map((b) => ('text' in b ? b.text : '')).join('');
      const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
      try {
        const parsed = JSON.parse(json) as { quote?: unknown; reason?: unknown };
        return {
          quote: typeof parsed.quote === 'string' && parsed.quote.trim() ? parsed.quote.trim() : null,
          reason: typeof parsed.reason === 'string' ? parsed.reason : '',
        };
      } catch {
        return { quote: null, reason: 'model returned no parseable answer' };
      }
    }
  );
  if (hit) ledger.free('anthropic', 'brief-quote');
  else ledger.record({ service: 'anthropic', operation: `brief-quote ${BRIEF_MODEL}`, usd: 0.01, basis: 'estimated', cached: false });
  return response;
}

/**
 * Turn EVIDENCE lines into Verified claims, or into a recorded absence.
 * Never throws: an unreachable page is a result, not a failure.
 */
export async function verifyBriefEvidence(
  cache: CacheOptions,
  ledger: Ledger,
  items: BriefEvidence[],
  subjectDomain: string,
  now: string
): Promise<BriefArtifact> {
  const results: BriefEvidenceResult[] = [];
  const claims: Claim[] = [];
  const notes: string[] = [];
  let n = 0;

  for (const item of items) {
    const page = await scrape(cache, ledger, item.url, now);
    if (!page.ok || !page.markdown.trim()) {
      results.push({ url: item.url, note: item.note, status: 'unreachable', detail: page.skipped ?? 'empty page' });
      notes.push(`brief evidence unreachable: ${item.url} (${page.skipped ?? 'empty'})`);
      continue;
    }
    const text = plainText(page.markdown);
    const title = page.title;
    let found: { quote: string | null; reason: string };
    try {
      found = await findQuote(cache, ledger, { url: item.url, note: item.note, text }, now);
    } catch (error) {
      results.push({ url: item.url, note: item.note, status: 'not_supported', title, detail: `quote search failed: ${(error as Error).message.slice(0, 120)}` });
      continue;
    }
    if (!found.quote || !verbatim(found.quote, text)) {
      results.push({
        url: item.url,
        note: item.note,
        status: 'not_supported',
        title,
        detail: found.quote ? 'proposed quote is not verbatim on the page' : found.reason || 'nothing on the page supports the note',
      });
      notes.push(`brief evidence not supported by the page: ${item.url}`);
      continue;
    }

    n += 1;
    const id = `brief-${n}`;
    let host = '';
    try {
      host = registrableDomain(new URL(item.url).hostname);
    } catch {
      /* leave empty */
    }
    const ownSite = host !== '' && host === registrableDomain(subjectDomain);
    const claim: Claim = {
      id,
      tier: ownSite ? 'observed' : 'comparative',
      angle: 'context',
      subject: ownSite ? 'self' : 'peer',
      peerName: ownSite ? undefined : host || item.url,
      statement: `${title ? `"${title}" says: ` : 'The page says: '}"${found.quote}"`,
      sources: [{ url: item.url, title, retrievedAt: now }],
      confidence: 'high',
    };
    claims.push(claim);
    results.push({ url: item.url, note: item.note, status: 'verified', title, quote: found.quote, claimId: id });
  }

  if (items.length) notes.push(`brief evidence: ${claims.length} of ${items.length} URL(s) verified on the page`);
  return { results, claims, notes };
}
