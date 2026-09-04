/* ---------------------------------------------------------------------------
   Stage 03b — dated, sourced changes at the target itself.

   WHY THIS EXISTS. Cold outreach lives or dies on one sentence: the specific,
   dated thing we noticed about *them*. Until this stage the only dated facts
   the pipeline gathered were about peers (stage 03), so the "why now" had to
   be carried in by a teammate as a URL and a note (stage 00). That works, and
   it does not scale to a target a day: finding the reason to write is the
   research, and the research is what the machine is for.

   So this stage answers one question from the domain alone: what has changed
   here recently, dated, and where is that published? Three passes, weakest
   last:

     1. THEIR OWN SITE. Map the domain, pick the news, press and blog paths,
        scrape them, and keep verbatim lines that carry a date. We read the
        page, so these are Verified (lib/claim-status.ts) and they are the only
        things a cold email or LinkedIn message may open with. A dated line
        still has to describe something happening: see the awareness-month
        teaser in `datedQuotesFrom`.
     2. PERPLEXITY, citation-resolved, with the same gates stage 03 uses: the
        sentence has to describe an action, name the company, and rest on a
        cited source that carries a publication date. Third-party reporting we
        did not read ourselves is Cited: call material, never the opener.
     3. EXA news, date-filtered. Headlines quoted verbatim with the publisher
        and the published date. Also Cited.

   WHAT IS DELIBERATELY DIFFERENT FROM STAGE 03. Stage 03 requires an AI or
   automation term, because a peer's ordinary corporate news is padding in a
   report about AI exposure. Here the opposite holds: a new location, a funding
   round, an acquisition or a leadership change *is* the reason to write, and
   demanding the word "AI" would throw away every good opener. In its place
   this stage requires recency — an event outside the window is history, and
   opening a cold email with a two-year-old announcement reads worse than not
   writing at all.

   Every other gate stage 03 learned the hard way is kept, near-miss domains
   and absence language included. Read the header of 03-peer-evidence.ts for
   what those cost to discover.

   WHAT THIS STAGE MUST NOT DO. It does not touch LinkedIn, and it does not
   read anything that needs a login. Finding the person is a teammate's job.
--------------------------------------------------------------------------- */

import type { CacheOptions } from '../lib/cache.ts';
import type { Ledger } from '../lib/budget.ts';
import type { Claim, Source } from '../lib/claim.ts';
import { ask, citedSentences, cleanStatement, type ResolvedCitation } from '../lib/clients/perplexity.ts';
import { searchNews } from '../lib/clients/exa.ts';
import { map, scrape } from '../lib/clients/firecrawl.ts';
import {
  hostOf,
  isAggregatorHost,
  isNearMissDomain,
  isSubjectMirror,
  hasProfilePath,
  registrableDomain,
  textNamesSubject,
} from '../lib/domain.ts';
import {
  assertsAbsence,
  attributesToPeer,
  describesAction,
  selectAnnouncementPages,
  yearsIn,
  type DropReason,
  type DroppedStatement,
} from './03-peer-evidence.ts';
import { looksLikeNavigation, looksLikeScrapeNoise } from './01-subject.ts';

/**
 * How far back an event still counts as a reason to write.
 *
 * Eighteen months is a compromise. A quarter would be truer to "recently" and
 * would leave most small private companies with nothing at all; three years
 * turns "we noticed you opened a second location" into a sentence that gets
 * the email deleted. Where the window bites, the report says the opener is
 * older than a year rather than hiding it.
 */
export const NEWS_WINDOW_MONTHS = 18;

/**
 * Verbs of *changing*, on top of stage 03's verbs of *doing*.
 *
 * Stage 03 asks what a peer did about AI, so its ACTION_VERBS are the
 * vocabulary of shipping software. The reason to write to a company is wider
 * than that and mostly duller: they opened somewhere, they hired someone, they
 * raised money, they won a contract, they got accredited. None of those words
 * appear in stage 03's list, and adding them there would loosen a gate that is
 * tuned for a different question, so this stage keeps its own list and accepts
 * either.
 *
 * The gate stays positive for the same reason it is positive there: a sentence
 * that describes what a source does or does not say contains no verb of
 * change, and there is no end to the ways a summariser can phrase "I found
 * nothing".
 */
const CHANGE_VERBS = [
  'open', 'opens', 'opened', 'opening',
  'hire', 'hires', 'hired', 'hiring',
  'appoint', 'appoints', 'appointed', 'appointing', 'appointment of',
  'name', 'names', 'named', 'promote', 'promoted', 'promotes',
  'join', 'joins', 'joined', 'joining',
  'raise', 'raises', 'raised', 'raising', 'closed a', 'secured', 'secures',
  'receive', 'receives', 'received', 'awarded', 'awards', 'won', 'wins',
  'add', 'adds', 'added', 'adding',
  'move', 'moves', 'moved', 'moving', 'relocate', 'relocated', 'relocates',
  'merge', 'merged', 'merges', 'merger with', 'combined with',
  'certify', 'certified', 'accredited', 'licensed', 'licences', 'licenses',
  'begin', 'begins', 'began', 'beginning', 'start', 'starts', 'started',
  'complete', 'completes', 'completed', 'broke ground', 'breaks ground',
  'renew', 'renews', 'renewed', 'extend', 'extends', 'extended',
  'double', 'doubles', 'doubled', 'grew', 'grows', 'grow',
  'file', 'files', 'filed', 'submitted', 'approved', 'approves',
  'sign', 'signs', 'closes', 'close', 'shut', 'shuts', 'exited', 'exits',
  'reported', 'reports', 'posted', 'announced a',
];

/** True when the sentence says the company changed, rather than existed. */
export function describesChange(text: string): boolean {
  const flat = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return CHANGE_VERBS.some((v) => flat.includes(` ${v} `));
}

/* -- dates ---------------------------------------------------------------- */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const ISO = /\b(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/;
const MONTH_DAY_YEAR = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b`, 'i');
const DAY_MONTH_YEAR = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\.?,?\\s+(20\\d\\d)\\b`, 'i');
const MONTH_YEAR = new RegExp(`\\b(${MONTH_NAMES})\\.?,?\\s+(20\\d\\d)\\b`, 'i');

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The date a line asserts, as far into the day as the text supports.
 *
 * Deliberately narrow: month names and ISO dates only. Numeric forms like
 * 03/04/2026 are ambiguous between two conventions, and a date we guess wrong
 * lands in a sentence a stranger reads as "they did not check".
 */
export function dateIn(text: string): { iso: string; matched: string } | null {
  const iso = text.match(ISO);
  if (iso) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}`, matched: iso[0] };

  const mdy = text.match(MONTH_DAY_YEAR);
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()];
    const day = Number(mdy[2]);
    if (month && day >= 1 && day <= 31) return { iso: `${mdy[3]}-${pad(month)}-${pad(day)}`, matched: mdy[0] };
  }

  const dmy = text.match(DAY_MONTH_YEAR);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    const day = Number(dmy[1]);
    if (month && day >= 1 && day <= 31) return { iso: `${dmy[3]}-${pad(month)}-${pad(day)}`, matched: dmy[0] };
  }

  const my = text.match(MONTH_YEAR);
  if (my) {
    const month = MONTHS[my[1].toLowerCase()];
    if (month) return { iso: `${my[2]}-${pad(month)}`, matched: my[0] };
  }

  return null;
}

/** True when `iso` (YYYY-MM or YYYY-MM-DD) is no older than `months` before `now`. */
export function withinMonths(iso: string, now: string, months = NEWS_WINDOW_MONTHS): boolean {
  const then = Date.parse(iso.length === 7 ? `${iso}-01T00:00:00Z` : `${iso.slice(0, 10)}T00:00:00Z`);
  const at = Date.parse(now);
  if (Number.isNaN(then) || Number.isNaN(at)) return false;
  const cutoff = new Date(at);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  /* A date in the future is a typo or a scheduled event, not a change. Allow a
     week of slack for timezones and for "effective 1 January" notices. */
  return then >= cutoff.getTime() && then <= at + 7 * 864e5;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* -- their own site ------------------------------------------------------- */

export interface DatedQuote {
  url: string;
  /** Verbatim, as it reads on the page. */
  quote: string;
  /** YYYY-MM-DD or YYYY-MM. */
  date: string;
  basis: 'in the quote' | 'the dated line above it';
}

/** Markdown to reader-visible lines: links unwrapped, images and tables gone. */
export function readableLines(markdown: string): string[] {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>#*\-+]+/, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !line.includes('|'));
}

const DATE_ONLY_MAX = 48;

/**
 * Dated lines from one page, kept verbatim.
 *
 * Two accepted shapes, because a news index uses both. Either the line carries
 * its own date ("On 12 August 2026 we opened…"), or the line above it is a
 * date and nothing else, which is how every press-release list on the web is
 * laid out. The second shape records that the date came from the line above,
 * so a reviewer knows what to check.
 */
export function datedQuotesFrom(
  markdown: string,
  url: string,
  now: string,
  opts: { limit?: number; windowMonths?: number } = {}
): DatedQuote[] {
  const limit = opts.limit ?? 2;
  const lines = readableLines(markdown);
  const out: DatedQuote[] = [];
  let pending: { iso: string } | null = null;

  const keep = (quote: string, iso: string, basis: DatedQuote['basis']) => {
    if (out.length >= limit) return;
    if (quote.length < 40 || quote.length > 300) return;
    if (looksLikeScrapeNoise(quote) || looksLikeNavigation(quote)) return;
    if (!withinMonths(iso, now, opts.windowMonths)) return;
    /* A dated line still has to say something happened. Live on senderrarx.com
       the dated cards on a news index included an evergreen awareness-month
       teaser — "Breast Cancer affects thousands throughout the United States
       every year" — dated, verbatim, on their own page, and no reason to write
       to anyone. The same positive gate stage 03 uses, widened by this stage's
       change verbs. */
    if (assertsAbsence(quote)) return;
    if (!describesAction(quote) && !describesChange(quote)) return;
    if (out.some((q) => q.quote === quote)) return;
    out.push({ url, quote, date: iso, basis });
  };

  for (const line of lines) {
    const found = dateIn(line);

    /* A line that is a date and little else labels what comes next. */
    if (found && line.length <= DATE_ONLY_MAX) {
      pending = { iso: found.iso };
      continue;
    }

    if (found) {
      /* A long paragraph carries its date in its first sentence; later
         sentences in it are undated as far as we can tell. */
      const first = line.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] ?? line;
      keep(first.length >= 40 ? first : line.slice(0, 300), found.iso, 'in the quote');
      pending = null;
      continue;
    }

    if (pending) {
      keep(line, pending.iso, 'the dated line above it');
      pending = null;
    }
  }

  return out;
}

/* -- the artifact --------------------------------------------------------- */

export type NewsOrigin = 'own-site' | 'search' | 'news-index';

export interface TargetNewsItem {
  /** Quotable prose: a verbatim line, a resolved Perplexity sentence, or a headline. */
  statement: string;
  /** The date of the event or of its publication. Never from a model's prose. */
  observedAt: string;
  origin: NewsOrigin;
  /** True only when we fetched and read the page ourselves. Drives Verified vs Cited. */
  readOnPage: boolean;
  sources: { url: string; title?: string; publisher?: string }[];
  /** How the date was established, for the reviewer. */
  dateBasis: string;
}

export interface TargetNewsArtifact {
  domain: string;
  gatheredAt: string;
  windowMonths: number;
  items: TargetNewsItem[];
  /** Items we read on their own site: the only cold-email openers. */
  ownSiteItems: number;
  pagesScraped: number;
  dropped: DroppedStatement[];
  dropSummary: Record<string, number>;
  notes: string[];
}

export interface TargetNewsOptions {
  windowMonths?: number;
  /** News, press and blog pages to scrape on their own site. */
  maxPages?: number;
  /** Dated lines kept from their own site, after sorting newest first. */
  maxOwnSiteItems?: number;
  quotesPerPage?: number;
  /** Skip the Perplexity pass (offline, or budget). */
  skipSearch?: boolean;
  /** Skip the Exa news pass. */
  skipNewsIndex?: boolean;
  maxHeadlines?: number;
}

export function targetPrompt(target: { name: string; domain: string }, since: string): string {
  return (
    `What has the company ${target.name} (website ${target.domain}) publicly announced, ` +
    `launched, opened, acquired, been funded for, or been reported doing since ${since}? ` +
    `Include only things you can cite to a dated published source: expansions, new locations, ` +
    `funding, acquisitions, partnerships, leadership changes, product launches, contracts, ` +
    `regulatory or licensing news. For each one, state what they did and when, in a single ` +
    `sentence, and cite the source. Do not include general industry trends, and do not include ` +
    `other companies with similar names. If you find nothing specific about this company, say ` +
    `so plainly.`
  );
}

/** The ISO month `months` before `now`, for the prompt's "since". */
export function sinceMonth(now: string, months: number): string {
  const at = new Date(Date.parse(now));
  at.setUTCMonth(at.getUTCMonth() - months);
  return at.toISOString().slice(0, 7);
}

/**
 * Apply every gate to one Perplexity answer about the target. Exported and
 * pure: the gates are the stage, and they are tested against real answers.
 */
export function newsFromAnswer(
  cited: { text: string; citations: ResolvedCitation[] }[],
  target: { name: string; domain: string },
  now: string,
  windowMonths = NEWS_WINDOW_MONTHS
): { items: TargetNewsItem[]; dropped: DroppedStatement[] } {
  const items: TargetNewsItem[] = [];
  const dropped: DroppedStatement[] = [];
  const drop = (text: string, reason: DropReason, detail: string) =>
    dropped.push({ peer: target.name, text: cleanStatement(text).slice(0, 200), reason, detail });

  for (const sentence of cited) {
    const clean = cleanStatement(sentence.text);
    if (clean.length < 30) {
      drop(sentence.text, 'too_short', `${clean.length} chars — not a statement`);
      continue;
    }

    const nearMiss = sentence.citations.find((c) => isNearMissDomain(c.url, target.domain));
    if (nearMiss) {
      drop(
        sentence.text,
        'near_miss_domain',
        `cited ${registrableDomain(nearMiss.url)} for ${target.domain} — near-identical name, different company`
      );
      continue;
    }

    const absence = assertsAbsence(clean);
    if (absence) {
      drop(sentence.text, 'asserts_absence', `states that nothing was found ("${absence}")`);
      continue;
    }

    if (!describesAction(clean) && !describesChange(clean)) {
      drop(sentence.text, 'no_action_verb', 'describes what a source says rather than something the company did');
      continue;
    }

    if (!attributesToPeer(clean, sentence.citations, target)) {
      drop(sentence.text, 'does_not_name_peer', `neither the sentence nor any cited source ties this to ${target.name}`);
      continue;
    }

    const dated = sentence.citations.filter((c) => c.date);
    if (dated.length === 0) {
      drop(sentence.text, 'no_source_date', `cited ${sentence.citations.length} source(s), none carrying a publication date`);
      continue;
    }

    const proseYears = yearsIn(clean);
    const sourceYears = new Set(dated.map((c) => Number(c.date!.slice(0, 4))));
    if (proseYears.length > 0 && !proseYears.some((y) => sourceYears.has(y))) {
      drop(
        sentence.text,
        'year_mismatch',
        `prose says ${proseYears.join('/')} but cited source(s) are dated ${[...sourceYears].join('/')}`
      );
      continue;
    }

    /* WHICH SOURCE'S DATE. Stage 03 takes the earliest dated citation, on the
       grounds that the first report of a move is its date. That reads oddly
       here when the sentence itself names a month: live on senderrarx.com a
       sentence about an investment announced on 10 December 2025 came back
       with an August citation first, and a report that prints "2025-08-08"
       beside that sentence looks careless. So where the prose names a month
       and a cited source is dated in it, that source's date is used — still
       the source's date, never the prose's — and where none is, the earliest
       stands and the basis says the sentence named a different month. */
    const ordered = [...dated].sort((a, b) => a.date!.localeCompare(b.date!));
    const proseDate = dateIn(clean);
    const month = proseDate?.iso.slice(0, 7);
    const matching = month ? ordered.find((c) => c.date!.slice(0, 7) === month) : undefined;
    const chosenCitation = matching ?? ordered[0];
    const observedAt = chosenCitation.date!;
    const basis = matching
      ? `publication date of ${hostOf(matching.url)}, the month the sentence names`
      : month
        ? `earliest cited source (${hostOf(ordered[0].url)}); the sentence names ${month}`
        : `publication date of ${hostOf(ordered[0].url)}`;
    if (!withinMonths(observedAt, now, windowMonths)) {
      drop(sentence.text, 'stale', `dated ${observedAt}, older than the ${windowMonths}-month window — history, not a reason to write`);
      continue;
    }

    items.push({
      statement: clean,
      observedAt,
      origin: 'search',
      readOnPage: false,
      dateBasis: basis,
      sources: [chosenCitation, ...ordered.filter((c) => c !== chosenCitation)].map((c) => ({
        url: c.url,
        title: c.title,
        publisher: c.publisher,
      })),
    });
  }

  return { items, dropped };
}

/**
 * Headlines from a date-filtered news search, kept verbatim.
 *
 * A headline is a published statement, so quoting it with its publisher and
 * date is honest in a way that summarising it would not be. Aggregators,
 * profile pages and mirrors of the company's own site are dropped: stage 02
 * learned that those dominate any search for a company name.
 */
export function headlinesFrom(
  results: { url: string; title?: string; publishedDate?: string; text?: string }[],
  target: { name: string; domain: string },
  now: string,
  opts: { windowMonths?: number; limit?: number } = {}
): { items: TargetNewsItem[]; dropped: DroppedStatement[] } {
  const items: TargetNewsItem[] = [];
  const dropped: DroppedStatement[] = [];
  const limit = opts.limit ?? 3;
  const drop = (text: string, reason: DropReason, detail: string) =>
    dropped.push({ peer: target.name, text: text.slice(0, 200), reason, detail });

  for (const r of results) {
    const title = (r.title ?? '').replace(/\s+/g, ' ').trim();
    if (title.length < 20) {
      drop(title || r.url, 'too_short', 'no usable headline');
      continue;
    }
    if (isNearMissDomain(r.url, target.domain)) {
      drop(title, 'near_miss_domain', `${registrableDomain(r.url)} is a near miss for ${target.domain}`);
      continue;
    }
    if (isAggregatorHost(r.url) || hasProfilePath(r.url) || isSubjectMirror(r.url, target.domain)) {
      drop(title, 'does_not_name_peer', `${hostOf(r.url)} is a directory, profile or mirror page, not reporting`);
      continue;
    }
    if (!r.publishedDate) {
      drop(title, 'no_source_date', 'the index returned no publication date');
      continue;
    }
    const iso = r.publishedDate.slice(0, 10);
    if (!withinMonths(iso, now, opts.windowMonths)) {
      drop(title, 'stale', `published ${iso}, outside the window`);
      continue;
    }
    /* The headline, or the article text, has to name them. A search for a
       company name returns plenty of pages that only mention the sector. */
    if (!textNamesSubject(`${title} ${(r.text ?? '').slice(0, 600)}`, target.domain, target.name)) {
      drop(title, 'does_not_name_peer', 'neither the headline nor the opening text names the company');
      continue;
    }
    if (items.some((i) => i.statement.includes(title))) continue;

    const publisher = hostOf(r.url);
    items.push({
      statement: `${publisher} reported: "${title}"`,
      observedAt: iso,
      origin: 'news-index',
      readOnPage: false,
      dateBasis: `publication date reported by the news index`,
      sources: [{ url: r.url, title, publisher }],
    });
    if (items.length >= limit) break;
  }

  return { items, dropped };
}

/* -- claims --------------------------------------------------------------- */

/**
 * Claims from this stage.
 *
 * Own-site items are `observed` and `readOnPage`, which makes them Verified:
 * we fetched the page and kept the words on it. Everything else is
 * `comparative` about the company itself with `readOnPage` false, which makes
 * it Cited — call material, and never the sentence a cold email opens with.
 */
export function newsClaimsFrom(artifact: TargetNewsArtifact, company: string): Claim[] {
  return artifact.items.map((item, i) => {
    const sources: Source[] = item.sources.map((s) => ({
      url: s.url,
      title: s.title?.slice(0, 160),
      publisher: s.publisher,
      retrievedAt: artifact.gatheredAt,
    }));
    return {
      id: `news-${i + 1}`,
      tier: item.readOnPage ? 'observed' : 'comparative',
      angle: 'context',
      subject: 'self',
      statement: item.readOnPage
        ? `${company} says on its own site, dated ${item.observedAt}: "${item.statement}"`
        : item.statement,
      sources,
      observedAt: item.observedAt,
      readOnPage: item.readOnPage,
      confidence: item.readOnPage ? 'high' : 'medium',
    };
  });
}

/* -- the stage ------------------------------------------------------------ */

export async function runTargetNewsStage(
  cache: CacheOptions,
  ledger: Ledger,
  target: { name: string; domain: string },
  now: string,
  opts: TargetNewsOptions = {}
): Promise<TargetNewsArtifact> {
  const windowMonths = opts.windowMonths ?? NEWS_WINDOW_MONTHS;
  const notes: string[] = [];
  const dropped: DroppedStatement[] = [];
  const items: TargetNewsItem[] = [];
  const seenQuotes = new Set<string>();
  let pagesScraped = 0;

  /* 1 — their own site. First, because it is the only pass that produces an
     opener we are allowed to use. */
  try {
    const mapped = await map(cache, ledger, target.domain, 60, now);
    const pages = selectAnnouncementPages(mapped.links ?? [], opts.maxPages ?? 3);
    if (pages.length === 0) notes.push('no news, press or blog path in their site map');
    for (const url of pages) {
      const page = await scrape(cache, ledger, url, now);
      if (!page.ok) {
        notes.push(`${url}: ${page.skipped ?? 'no markdown'}`);
        continue;
      }
      pagesScraped += 1;
      const quotes = datedQuotesFrom(page.markdown, url, now, {
        limit: opts.quotesPerPage ?? 2,
        windowMonths,
      });
      if (quotes.length === 0) notes.push(`${url}: no dated line inside the ${windowMonths}-month window`);
      for (const q of quotes) {
        /* Deduplicated across pages, not just within one. A news index and an
           article page carry the same teaser, and three copies of one line
           read as three findings. */
        if (seenQuotes.has(squash(q.quote))) continue;
        seenQuotes.add(squash(q.quote));
        items.push({
          statement: q.quote,
          observedAt: q.date,
          origin: 'own-site',
          readOnPage: true,
          dateBasis: q.basis,
          sources: [{ url: q.url, title: page.title }],
        });
      }
    }
  } catch (error) {
    notes.push(`own-site pass failed: ${(error as Error).message.slice(0, 160)}`);
  }

  /* 2 — Perplexity, citation-resolved. */
  if (!opts.skipSearch) {
    try {
      const answer = await ask(cache, ledger, targetPrompt(target, sinceMonth(now, windowMonths)), now, {
        label: `target ${target.domain}`,
      });
      const { cited, dropped: uncited } = citedSentences(answer);
      for (const u of uncited) {
        dropped.push({
          peer: target.name,
          text: u.text,
          reason: u.reason.startsWith('no citation') ? 'no_citation_marker' : 'unresolvable_marker',
          detail: u.reason,
        });
      }
      const result = newsFromAnswer(cited, target, now, windowMonths);
      items.push(...result.items);
      dropped.push(...result.dropped);
    } catch (error) {
      notes.push(`Perplexity failed for ${target.domain}: ${(error as Error).message.slice(0, 160)}`);
    }
  }

  /* 3 — Exa news, date-filtered. */
  if (!opts.skipNewsIndex) {
    try {
      const since = `${sinceMonth(now, windowMonths)}-01`;
      const response = await searchNews(cache, ledger, `${target.name} ${registrableDomain(target.domain)}`, 10, since, now);
      const result = headlinesFrom(response.results ?? [], target, now, {
        windowMonths,
        limit: opts.maxHeadlines ?? 3,
      });
      items.push(...result.items);
      dropped.push(...result.dropped);
    } catch (error) {
      notes.push(`Exa news failed for ${target.domain}: ${(error as Error).message.slice(0, 160)}`);
    }
  }

  /* Newest first: the reason to write is the most recent thing that happened. */
  items.sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  /* A cap per origin, applied after sorting, so a chatty news index cannot
     crowd out the searched items or fill the register with near-duplicates.
     Four openers is more than any message can use. */
  const capped: TargetNewsItem[] = [];
  const perOrigin: Record<string, number> = {};
  for (const item of items) {
    const cap = item.origin === 'own-site' ? (opts.maxOwnSiteItems ?? 4) : (opts.maxHeadlines ?? 3);
    perOrigin[item.origin] = (perOrigin[item.origin] ?? 0) + 1;
    if (perOrigin[item.origin] > cap) continue;
    capped.push(item);
  }
  if (capped.length < items.length) {
    notes.push(`kept ${capped.length} of ${items.length} dated item(s) after the per-origin cap; the newest survive`);
  }

  const dropSummary: Record<string, number> = {};
  for (const d of dropped) dropSummary[d.reason] = (dropSummary[d.reason] ?? 0) + 1;

  const ownSiteItems = capped.filter((i) => i.readOnPage).length;
  if (ownSiteItems === 0) {
    notes.push(
      'nothing dated on their own site inside the window: there is no Verified opener, so a cold ' +
        'email has nothing true and recent to lead with unless a teammate supplies one'
    );
  }

  return {
    domain: target.domain,
    gatheredAt: now,
    windowMonths,
    items: capped,
    ownSiteItems,
    pagesScraped,
    dropped,
    dropSummary,
    notes,
  };
}
