/* ---------------------------------------------------------------------------
   Stage 01 — the subject's own public surface.

   Map the site, choose the pages that describe *operations* rather than
   marketing, scrape those, and pull deterministic signals out of the text.

   Page selection happens from the map response, before any scraping. The live
   probe on hpsrx.com is why: 31 links came back, only 9 carried a title or
   description, and three were sitemap XML. Selection therefore scores URL
   paths first and treats title and description as a bonus. Code that leaned on
   titles would have selected almost nothing on a Wix site and looked fine
   doing it.

   The highest-yield pages, per the README, are the ones that describe how the
   work actually gets done:

     help centre / support   a published description of their manual workflows
     careers                 what they're building and can't hire for
     integrations / API      their systems of record
     pricing / ordering      where the human steps are

   Everything extracted here is a quotation or a count with a URL behind it.
   Nothing is inferred, because inference is stage 05's problem and numbers are
   nobody's.
--------------------------------------------------------------------------- */

import type { CacheOptions } from '../lib/cache.ts';
import type { Ledger } from '../lib/budget.ts';
import { map, scrape, type FirecrawlLink } from '../lib/clients/firecrawl.ts';
import { registrableDomain } from '../lib/domain.ts';
import { robotsFor } from '../lib/http.ts';
import { mapWithConcurrency, PAGE_CONCURRENCY } from '../lib/concurrency.ts';

export type PageCategory =
  | 'home'
  | 'help'
  | 'careers'
  | 'integrations'
  | 'pricing'
  | 'company'
  | 'product'
  | 'other';

/**
 * Path keywords per category, with the weight that decides scrape order.
 * Ops-describing categories outrank marketing ones — that ordering is the
 * whole selection strategy, and it is deliberately visible in one table.
 */
const CATEGORY_RULES: { category: PageCategory; weight: number; keywords: string[]; cap: number }[] = [
  {
    category: 'help',
    weight: 10,
    cap: 4,
    keywords: ['help', 'support', 'docs', 'documentation', 'faq', 'knowledge', 'kb', 'guide', 'guides', 'how-it-works', 'how-to', 'training', 'resources', 'tutorial'],
  },
  {
    category: 'careers',
    weight: 9,
    cap: 3,
    keywords: ['career', 'careers', 'jobs', 'job', 'join-us', 'join', 'work-with-us', 'hiring', 'internship', 'internships', 'employment', 'openings', 'positions', 'team'],
  },
  {
    category: 'integrations',
    weight: 8,
    cap: 3,
    keywords: ['integration', 'integrations', 'api', 'developers', 'developer', 'connect', 'connections', 'ecosystem', 'partners', 'partner', 'technology', 'platform', 'interoperability', 'edi'],
  },
  {
    category: 'pricing',
    weight: 7,
    cap: 4,
    keywords: ['pricing', 'price', 'plans', 'ordering', 'order', 'orders', 'quote', 'payment', 'payments', 'billing', 'shipping', 'returns', 'terms', 'policy', 'policies', 'checkout-info'],
  },
  {
    category: 'company',
    weight: 5,
    cap: 3,
    keywords: ['about', 'about-us', 'company', 'company-profile', 'who-we-are', 'our-story', 'leadership', 'mission', 'history', 'contact', 'locations', 'compliance', 'quality', 'certifications'],
  },
  {
    category: 'product',
    weight: 3,
    cap: 3,
    keywords: ['products', 'services', 'solutions', 'capabilities', 'what-we-do', 'offerings', 'catalog', 'industries'],
  },
];

/** URLs that are never worth a credit. */
const SKIP_PATTERNS = [
  /\.(xml|json|txt|pdf|jpe?g|png|gif|svg|webp|ico|css|js|zip|csv|xlsx?|docx?)($|\?)/i,
  /sitemap/i,
  /\/(cart|checkout|login|log-in|signin|sign-in|signup|sign-up|account|my-account|wishlist)(\/|$)/i,
  /\/(thank-you|thanks|404|error|search)(\/|$|-)/i,
  /(privacy|cookie|gdpr|accessibility|sitemap|disclaimer)/i,
  /\?/,
];

export interface SelectedPage {
  url: string;
  category: PageCategory;
  weight: number;
  /** Why this page was picked — kept so a thin run is explainable. */
  matched: string;
  titleFromMap?: string;
  descriptionFromMap?: string;
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + (u.hash ? '' : '')).toLowerCase();
  } catch {
    return '';
  }
}

function isHome(url: string, domain: string): boolean {
  const path = pathOf(url);
  return (path === '' || path === '/') && registrableDomain(url) === domain;
}

/** Path segments, plus hyphen-split words, so `careers-and-internships` hits. */
function tokensOf(url: string): string[] {
  const path = pathOf(url);
  const segments = path.split('/').filter(Boolean);
  const words = segments.flatMap((s) => s.split(/[-_.]/)).filter(Boolean);
  return [...new Set([...segments, ...words])];
}

export function categorize(link: FirecrawlLink): { category: PageCategory; weight: number; matched: string } | null {
  const tokens = tokensOf(link.url);
  const haystack = `${link.title ?? ''} ${link.description ?? ''}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const hit = rule.keywords.find((k) => tokens.includes(k));
    if (hit) return { category: rule.category, weight: rule.weight, matched: `path:${hit}` };
  }
  // Title and description are a fallback, not the primary signal — most links
  // in a real map response carry neither.
  for (const rule of CATEGORY_RULES) {
    const hit = rule.keywords.find((k) => k.length > 4 && haystack.includes(k));
    if (hit) return { category: rule.category, weight: rule.weight - 1, matched: `meta:${hit}` };
  }
  return null;
}

/**
 * Choose pages to scrape. Homepage always, then by weight, with a per-category
 * cap so one sprawling section can't consume the whole page budget.
 */
export function selectPages(links: FirecrawlLink[], domain: string, limit: number): SelectedPage[] {
  const selected: SelectedPage[] = [];
  const counts = new Map<PageCategory, number>();
  const seen = new Set<string>();

  const home = links.find((l) => isHome(l.url, domain));
  if (home) {
    selected.push({
      url: home.url,
      category: 'home',
      weight: 100,
      matched: 'homepage',
      titleFromMap: home.title,
      descriptionFromMap: home.description,
    });
    seen.add(home.url.replace(/\/$/, ''));
  }

  const scored = links
    .filter((l) => !seen.has(l.url.replace(/\/$/, '')))
    .filter((l) => !SKIP_PATTERNS.some((p) => p.test(l.url)))
    .map((l) => ({ link: l, hit: categorize(l) }))
    .filter((x): x is { link: FirecrawlLink; hit: NonNullable<ReturnType<typeof categorize>> } => x.hit !== null)
    .sort((a, b) => b.hit.weight - a.hit.weight || a.link.url.length - b.link.url.length);

  for (const { link, hit } of scored) {
    if (selected.length >= limit) break;
    const cap = CATEGORY_RULES.find((r) => r.category === hit.category)?.cap ?? 2;
    const used = counts.get(hit.category) ?? 0;
    if (used >= cap) continue;
    counts.set(hit.category, used + 1);
    seen.add(link.url.replace(/\/$/, ''));
    selected.push({
      url: link.url,
      category: hit.category,
      weight: hit.weight,
      matched: hit.matched,
      titleFromMap: link.title,
      descriptionFromMap: link.description,
    });
  }

  return selected;
}

/* -- signal extraction -------------------------------------------------- */

/**
 * Phrases that mean "a person does this step by hand". Each one is a hook for
 * a hypothesis claim later, and because we keep the surrounding quotation, the
 * claim cites their own words rather than our characterisation of them.
 */
const MANUAL_WORK_PHRASES = [
  'call us', 'give us a call', 'call our', 'phone in', 'by phone', 'over the phone',
  'fax', 'faxed', 'by mail', 'mail in', 'email us', 'email your', 'send us an email',
  'manually', 'by hand', 'paper', 'paperwork', 'spreadsheet', 'data entry',
  'our team will', 'a representative will', 'we will contact you', 'we will get back',
  'business days', 'allow up to', 'please complete', 'fill out', 'submit the form',
  'download the form', 'print', 'sign and return', 'requires approval', 'prior authorization',
];

/** Systems of record worth naming. A named system is an integration surface. */
const SYSTEMS_OF_RECORD = [
  'Epic', 'Cerner', 'Oracle Health', 'Meditech', 'Allscripts', 'athenahealth',
  'eClinicalWorks', 'NextGen', 'Point Click Care', 'PointClickCare', 'MatrixCare',
  'WellSky', 'Homecare Homebase', 'Netsmart', 'Surescripts', 'McKesson', 'Cardinal Health',
  'Salesforce', 'HubSpot', 'NetSuite', 'SAP', 'QuickBooks', 'Sage', 'Workday', 'ADP',
  'Shopify', 'Zendesk', 'ServiceNow', 'Jira', 'Slack', 'Microsoft Teams', 'SharePoint',
  'Snowflake', 'Databricks', 'Twilio', 'Stripe', 'DocuSign', 'HL7', 'FHIR', 'EDI', 'X12',
];

const AI_TERMS = [
  'artificial intelligence', 'machine learning', 'a.i.', ' ai ', 'ai-powered', 'ai powered',
  'llm', 'large language model', 'copilot', 'chatbot', 'chat bot', 'automation', 'automated',
  'predictive', 'algorithm', 'gpt', 'generative',
];

export interface PageSignals {
  url: string;
  category: PageCategory;
  title?: string;
  description?: string;
  wordCount: number;
  /** Verbatim quotations. Never paraphrased — they end up in claims. */
  manualWorkQuotes: { phrase: string; quote: string }[];
  systemsNamed: string[];
  aiTermsFound: string[];
  /** Careers pages only: lines that look like a role listing. */
  roleLines: string[];
  skipped?: string;
}

/** Sentence containing `phrase`, trimmed to something quotable. */
function quoteAround(text: string, index: number, phrase: string): string {
  const start = Math.max(0, text.lastIndexOf('.', index) + 1);
  const endDot = text.indexOf('.', index + phrase.length);
  const end = endDot === -1 ? Math.min(text.length, index + 160) : endDot + 1;
  return text
    .slice(start, end)
    // Escaped markdown ("\\ \\ **Request Care Today**") leaked into the live
    // report; strip the escapes and emphasis so the quote reads as the page does.
    .replace(/\\+/g, ' ')
    .replace(/\*\*?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-*>#|]+/, '')
    .trim()
    .slice(0, 240);
}

/**
 * Boilerplate that belongs to the browser or the scrape, not to the company.
 *
 * The live meridianmedicalsupply.com run quoted this into the report as a
 * description of one of their manual steps:
 *
 *   "ERR_BLOCKED_BY_CLIENT Reload This page has been blocked by an extension
 *    × Contact Us Please fill out this form…"
 *
 * The matched phrase ("fill out") was real and the page really said it. The
 * first half is a browser extension's error message that Firecrawl captured
 * and we then attributed to the prospect. "Skip to main content" reached a
 * report the same way. Quoting a company's own words back to them is the most
 * persuasive move this report has, and it only works if the words are theirs.
 */
const SCRAPE_NOISE = [
  // Article and listing furniture. The live senderrarx.com run quoted
  // "4 min read How Specialty Pharmacy Technology is Freeing Nurses' Time
  // Senderra : Mar 6, 2022, 9:56:57 PM News Senderra Specialty Pharmacy..."
  // as a description of a manual step. It is a blog index row.
  'min read', 'minute read', 'read more', 'share this', 'posted on',
  'published on', 'filed under', 'tagged with', 'related posts', 'next post',
  'previous post', 'subscribe to our', 'sign up for our newsletter',
  'err_blocked', 'err_', 'blocked by an extension', 'blocked by client',
  'skip to main content', 'skip to content', 'enable javascript',
  'javascript is disabled', 'your browser', 'browser does not support',
  'page not found', '404 error', 'access denied', 'are you a robot',
  'accept cookies', 'cookie policy', 'we use cookies', 'loading...',
  'please wait while', 'this site requires', 'update your browser',
];

export function looksLikeScrapeNoise(quote: string): boolean {
  const flat = quote.toLowerCase();
  return SCRAPE_NOISE.some((n) => flat.includes(n));
}

/**
 * True for a menu, product list or table fragment rather than prose.
 *
 * The live hpsrx.com run quoted this into the report as a description of a
 * manual step:
 *
 *   "Tenaculum Hooks Uterine Sounds Forceps Metal Curettes Biopsy Punches
 *    Dilators Speculums Needle Extenders Scissors Surgical Supplies…"
 *
 * It is a product menu that happened to sit near a matched phrase. The signal
 * that separates it from prose is function words: real sentences are full of
 * lowercase connective vocabulary ("we will contact you and provide you with"),
 * and a run of Title Case nouns has almost none.
 */
export function looksLikeNavigation(quote: string): boolean {
  if (/[|\u2502]/.test(quote)) return true;
  const lowercaseWords = quote
    .split(/\s+/)
    .filter((w) => /^[a-z][a-z'-]{1,}$/.test(w));
  return lowercaseWords.length < 4;
}

/**
 * System names that are also ordinary English words.
 *
 * A case-insensitive word match told Cultivate Advisors — a business coaching
 * firm — that their work runs through Epic, the hospital EHR. Their page said
 * something was epic. The claim then reached the analyst, which turned it into
 * a question about their clinical systems, and the whole report looked like it
 * had not been read by anyone.
 *
 * For these names we require the exact capitalisation and refuse a match at the
 * start of a sentence, where any word is capitalised. Unambiguous names like
 * "PointClickCare" keep the loose match.
 */
const AMBIGUOUS_SYSTEMS = new Set([
  'Epic', 'Sage', 'Slack', 'Workday', 'Jira', 'Stripe', 'Shopify', 'SAP', 'EDI',
]);

export function namesSystem(text: string, system: string): boolean {
  const escaped = system.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!AMBIGUOUS_SYSTEMS.has(system)) {
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  }
  /* Exact case, and never sentence-initial — including the very start of the
     text, where a heading like "Epic growth is what we deliver" would otherwise
     match. Requiring mid-sentence context costs us a real mention that happens
     to open a page, and that is the safer way to be wrong. */
  const re = new RegExp(`\\b${escaped}\\b`, 'g');
  for (const m of text.matchAll(re)) {
    if (m.index === 0) continue;
    const before = text.slice(0, m.index);
    if (/(^|[.!?])\s*$/.test(before)) continue;
    return true;
  }
  return false;
}

export function extractSignals(
  page: SelectedPage,
  markdown: string,
  title?: string,
  description?: string
): PageSignals {
  // Strip image markup and link targets so URLs don't count as prose.
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Heading markers, before quoting rather than after: a quotation spanning
    // a heading boundary otherwise carries "####" into the report.
    .replace(/#+/g, ' ')
    .replace(/\s+/g, ' ');
  const lower = text.toLowerCase();

  const manualWorkQuotes: { phrase: string; quote: string }[] = [];
  for (const phrase of MANUAL_WORK_PHRASES) {
    const index = lower.indexOf(phrase);
    if (index === -1) continue;
    const quote = quoteAround(text, index, phrase);
    if (quote.length < 20) continue;
    if (looksLikeNavigation(quote)) continue;
    if (looksLikeScrapeNoise(quote)) continue;
    if (manualWorkQuotes.some((q) => q.quote === quote)) continue;
    manualWorkQuotes.push({ phrase: phrase.trim(), quote });
  }

  const systemsNamed = SYSTEMS_OF_RECORD.filter((s) => namesSystem(text, s));

  const aiTermsFound = AI_TERMS.filter((t) => lower.includes(t)).map((t) => t.trim());

  const roleLines =
    page.category === 'careers'
      ? [...new Set(
          markdown
            // Same link and image stripping as the prose above: the live run
            // put "(Talk to a Care Specialist)(https://…/request-care/)" into
            // the report as a job title.
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/https?:\/\/\S+/g, ' ')
            .split('\n')
            .map((l) => l.replace(/^[\s\-*#>|]+/, '').trim())
            .filter((l) => l.length > 3 && l.length < 90)
            .filter((l) =>
              /\b(manager|director|specialist|coordinator|representative|analyst|engineer|developer|nurse|pharmacist|technician|associate|assistant|clerk|buyer|planner|supervisor|intern|internship|sales|account executive)\b/i.test(l)
            )
        )]
      : [];

  return {
    url: page.url,
    category: page.category,
    title,
    description,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    manualWorkQuotes,
    systemsNamed,
    aiTermsFound,
    roleLines,
  };
}

/* -- redirects ----------------------------------------------------------- */

/**
 * The domain the site actually lives on.
 *
 * Companies rebrand and redirect, and the intake form collects the domain the
 * prospect typed. On the live run, `traditionshealth.com` 301s to
 * `tct-cares.com`: all 60 mapped URLs came back on the new host, so `isHome`
 * matched nothing, the homepage was never scraped, and the category query fell
 * through to a contact page's boilerplate — which then drove peer discovery to
 * "24/7 nursing" companies. One redirect, and the make-or-break stage was
 * searching for the wrong category.
 *
 * So the effective domain is read back from the map response rather than
 * assumed. The requested domain is kept alongside it: which name the prospect
 * used is worth knowing, and a rebrand is itself a fact about the account.
 */
export function dominantDomain(links: FirecrawlLink[]): string {
  const counts = new Map<string, number>();
  for (const link of links) {
    const domain = registrableDomain(link.url);
    if (!domain) continue;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [domain, count] of counts) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }
  return best;
}

/* -- category query for stage 02 ---------------------------------------- */

/**
 * The natural-language description of what this company *is*, which stage 02
 * feeds to Exa's company search. Getting this right is most of what makes peer
 * discovery work, so it is derived from their own self-description rather than
 * from the domain name or a template.
 *
 * The subject's own name is stripped: a query containing "HPSRx" retrieves
 * pages about HPSRx, which is precisely the failure mode stage 02 exists to
 * avoid. Overridable from the CLI, because a human who knows the account will
 * beat this heuristic and should be able to say so.
 */
/**
 * A regex body matching a domain's brand label as it appears in prose.
 *
 * Domain labels concatenate words that the copy separates: `traditionshealth.com`
 * is written "Traditions Health" on the page, so a plain `\btraditionshealth\b`
 * matches nothing and the company's own name survives into the category query.
 * So for a label long enough to be distinctive, separators are allowed between
 * its characters. Short labels keep the strict form, because a loose three-letter
 * pattern matches most of the language.
 */
export function brandPattern(brand: string): string | null {
  const letters = brand.replace(/[^a-z0-9]/gi, '');
  if (letters.length < 3) return null;
  const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (letters.length < 6) return escape(letters);
  return letters.split('').map(escape).join("[\\s.'-]{0,2}");
}

export function deriveCategoryQuery(
  signals: PageSignals[],
  domain: string,
  alsoStrip: string[] = []
): { query: string; seedText: string; derivedFrom: string } {
  /**
   * Contact-page boilerplate is not a category description.
   *
   * "Contact us. Our team is available 24 hours a day, 7 days a week to assist
   * patients, caregivers, and health care providers" became the live category
   * query for a hospice provider, and Exa duly returned 24/7 answering
   * services: 24/7 Nursing Care, 24/7 Coastal Contact, 24ourCare, Hospice On
   * Call. Every one of them matched the query. None of them was the category.
   */
  const isContactBoilerplate = (url: string, text: string) =>
    /\/(contact|contact-us|get-in-touch|request|locations?)(\/|$)/i.test(url) ||
    // Call-to-action openers. "Discover the difference. Call 833.380.9583 today
    // to learn more about our in-home hospice services" became the live
    // category query for a 300-programme hospice operator, and peer discovery
    // returned six single-location agencies instead of its actual competitors.
    /^(contact|call|email|reach|get in touch|request|speak|talk|schedule|book|discover|learn|find out|get started|see how|explore|welcome|looking for|need help)\b/i.test(
      text.trim()
    ) ||
    // A phone number in a meta description means it is an advert, not a
    // description of the business.
    /(\+?\d[\d\s().-]{8,}\d)/.test(text) ||
    /\b(24 hours a day|7 days a week|business hours|toll[- ]free|call today|call now)\b/i.test(text);

  const preferred: PageCategory[] = ['home', 'company', 'product'];
  const candidates = preferred
    .flatMap((c) => signals.filter((s) => s.category === c))
    .flatMap((s) => [
      { text: s.description ?? '', from: `${s.url} (meta description)`, url: s.url },
      { text: s.title ?? '', from: `${s.url} (title)`, url: s.url },
    ])
    .filter((c) => c.text.trim().length > 40)
    .filter((c) => !isContactBoilerplate(c.url, c.text));

  const brands = [domain.split('.')[0], ...alsoStrip.map((d) => d.split('.')[0])].filter(Boolean);
  const brand = brands[0] ?? '';

  /**
   * Legal-suffix words, for stripping a company name down to its category.
   *
   * Applied *repeatedly at the start* of the remainder, because real
   * descriptions stack them. On the live hpsrx.com run the meta description
   * was "HPSRx Enterprises, Inc. is a small specialty distributor in women's
   * health…"; removing one suffix left "Inc. is a small specialty
   * distributor…", and that string went to Exa as the category description and
   * to stage 04 as the seed for the demand pull. Peer discovery survived it,
   * but a category query that opens with a legal suffix is a category query
   * nobody proofread.
   */
  const LEGAL_SUFFIX =
    "inc|llc|l\\.l\\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|pvt|private|" +
    "enterprises|enterprise|group|holdings|international|usa|partners|associates";

  const strip = (text: string) => {
    // Every brand the company answers to: a redirect means the old name and
    // the new one can both appear in the copy.
    let out = text;
    for (const b of brands) {
      const pattern = brandPattern(b);
      if (!pattern) continue;
      out = out
        .replace(new RegExp(`\\b${pattern}\\b[a-z ,.]*?\\b(${LEGAL_SUFFIX})\\b\\.?`, 'gi'), '')
        .replace(new RegExp(`\\b${pattern}\\b'?s?`, 'gi'), '');
    }
    out = out.replace(/\s{2,}/g, ' ');

    // Peel leading punctuation, orphaned legal suffixes and a leading copula
    // in a loop: removing any one of them can expose another.
    let previous: string;
    do {
      previous = out;
      out = out
        .replace(/^[\s,.\-–—|:;]+/, '')
        .replace(new RegExp(`^(${LEGAL_SUFFIX})\\b\\.?`, 'i'), '')
        .replace(/^(is|are|was|were|we|the|a|an)\s+/i, '');
    } while (out !== previous);

    return out.trim();
  };

  /**
   * TWO OUTPUTS, because the two consumers want opposite things — and this was
   * learned the hard way, by breaking one to fix the other.
   *
   * `seedText` is the first sentence or two. The live hpsrx.com description ran
   * 300 characters and closed with "Our dedicated team provides excellent
   * customer service on a first name basis. We are licensed to ship to all 50
   * states", and stage 04 duly paid to measure US search demand for "first
   * name" and "excellent customer". Trimming to the opening sentences fixed
   * that.
   *
   * `query` is the whole description, because trimming it made peer discovery
   * measurably worse. The short version of the HPSRx description returned a
   * Zimbabwean healthcare distributor and a Middle Eastern pharmaceutical
   * trader in place of AMSCO Medical, MedGyn and Mazza Healthcare: the
   * incidental detail Exa needs to locate a *specific* niche is exactly the
   * filler that ruins a keyword list.
   *
   * So the trailing sentences are noise to one stage and signal to the other,
   * and the fix is to stop making them share one string.
   */
  const firstSentences = (text: string, count = 2) => {
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const kept = parts.slice(0, count).join(' ').trim();
    return (kept.length >= 40 ? kept : text).slice(0, 300);
  };

  for (const candidate of candidates) {
    const stripped = strip(candidate.text);
    if (stripped.length >= 40) {
      return {
        query: stripped.slice(0, 300),
        seedText: firstSentences(stripped),
        derivedFrom: candidate.from,
      };
    }
  }
  const fallback = `companies similar to ${domain}`;
  return {
    query: fallback,
    seedText: fallback,
    derivedFrom: 'fallback — no usable self-description found on the site',
  };
}

/* -- the stage ---------------------------------------------------------- */

export interface SubjectArtifact {
  domain: string;
  /** Where the site actually lives, if the requested domain redirects. */
  effectiveDomain: string;
  crawledAt: string;
  robots: { host: string; published: boolean; crawlDelayMs?: number; disallowRules: number };
  mapped: number;
  selected: SelectedPage[];
  pages: PageSignals[];
  pagesCrawled: number;
  categoryQuery: { query: string; seedText: string; derivedFrom: string };
  /** Categories the site simply doesn't have. The thin-target diagnosis. */
  categoriesMissing: PageCategory[];
  notes: string[];
}

export interface SubjectOptions {
  mapLimit?: number;
  pageLimit?: number;
  /** Pages scraped concurrently. Defaults to PAGE_CONCURRENCY. */
  concurrency?: number;
  categoryQueryOverride?: string;
}

export async function runSubjectStage(
  cache: CacheOptions,
  ledger: Ledger,
  domain: string,
  now: string,
  opts: SubjectOptions = {}
): Promise<SubjectArtifact> {
  const notes: string[] = [];
  const homeUrl = `https://${domain}`;
  const robots = await robotsFor(homeUrl);

  const mapped = await map(cache, ledger, domain, opts.mapLimit ?? 60, now);
  const links = mapped.links ?? [];
  if (links.length === 0) notes.push('Firecrawl map returned no links — the site may block crawling or be a single page.');

  const withTitles = links.filter((l) => l.title || l.description).length;
  notes.push(
    `map returned ${links.length} link(s), ${withTitles} with a title or description — ` +
      'selection is path-driven for exactly this reason'
  );

  // Where the site actually lives. A redirect here silently broke homepage
  // selection and, through it, peer discovery — see `dominantDomain`.
  const requested = registrableDomain(domain);
  const effectiveDomain = dominantDomain(links) || requested;
  if (effectiveDomain !== requested) {
    notes.push(
      `${requested} redirects to ${effectiveDomain} — ${links.length} of the mapped URLs are on ` +
        'the new host. Crawling and peer discovery follow the new domain; a rebrand is ' +
        'itself worth raising on the call.'
    );
  }

  const selected = selectPages(links, effectiveDomain, opts.pageLimit ?? 12);

  /* Scraped concurrently. Twelve pages in series was 48 seconds of a
     125-second run — see lib/concurrency.ts. Order is preserved so the
     artifact still reads in selection order. */
  const pages: PageSignals[] = await mapWithConcurrency(
    selected,
    opts.concurrency ?? PAGE_CONCURRENCY,
    async (page) => {
      const result = await scrape(cache, ledger, page.url, now);
      if (!result.ok) {
        return {
          url: page.url,
          category: page.category,
          wordCount: 0,
          manualWorkQuotes: [],
          systemsNamed: [],
          aiTermsFound: [],
          roleLines: [],
          skipped: result.skipped ?? `scrape returned no markdown (status ${result.statusCode ?? '?'})`,
        };
      }
      return extractSignals(page, result.markdown, result.title, result.description);
    }
  );

  const present = new Set(pages.filter((p) => !p.skipped).map((p) => p.category));
  const categoriesMissing = (['help', 'careers', 'integrations', 'pricing'] as PageCategory[]).filter(
    (c) => !present.has(c)
  );
  if (categoriesMissing.length > 0) {
    notes.push(`no page found for: ${categoriesMissing.join(', ')} — the ops-describing pages are the yield`);
  }

  const derived = deriveCategoryQuery(
    pages,
    effectiveDomain,
    effectiveDomain === requested ? [] : [requested]
  );
  const categoryQuery = opts.categoryQueryOverride
    ? {
        query: opts.categoryQueryOverride,
        seedText: opts.categoryQueryOverride,
        derivedFrom: 'supplied on the command line',
      }
    : derived;
  if (opts.categoryQueryOverride) {
    notes.push(`category query overridden; derived query would have been: "${derived.query}"`);
  }

  return {
    domain,
    effectiveDomain,
    crawledAt: now,
    robots: {
      host: robots.host,
      published: robots.fetched,
      crawlDelayMs: robots.crawlDelayMs,
      disallowRules: robots.rules.filter((r) => !r.allow).length,
    },
    mapped: links.length,
    selected,
    pages,
    pagesCrawled: pages.filter((p) => !p.skipped && p.wordCount > 0).length,
    categoryQuery,
    categoriesMissing,
    notes,
  };
}
