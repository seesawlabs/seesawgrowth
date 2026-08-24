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
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-*>#|]+/, '')
    .trim()
    .slice(0, 240);
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
    .replace(/\s+/g, ' ');
  const lower = text.toLowerCase();

  const manualWorkQuotes: { phrase: string; quote: string }[] = [];
  for (const phrase of MANUAL_WORK_PHRASES) {
    const index = lower.indexOf(phrase);
    if (index === -1) continue;
    const quote = quoteAround(text, index, phrase);
    if (quote.length < 20) continue;
    if (manualWorkQuotes.some((q) => q.quote === quote)) continue;
    manualWorkQuotes.push({ phrase: phrase.trim(), quote });
  }

  const systemsNamed = SYSTEMS_OF_RECORD.filter((s) =>
    new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  );

  const aiTermsFound = AI_TERMS.filter((t) => lower.includes(t)).map((t) => t.trim());

  const roleLines =
    page.category === 'careers'
      ? [...new Set(
          markdown
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
export function deriveCategoryQuery(signals: PageSignals[], domain: string): { query: string; derivedFrom: string } {
  const preferred: PageCategory[] = ['home', 'company', 'product'];
  const candidates = preferred
    .flatMap((c) => signals.filter((s) => s.category === c))
    .flatMap((s) => [
      { text: s.description ?? '', from: `${s.url} (meta description)` },
      { text: s.title ?? '', from: `${s.url} (title)` },
    ])
    .filter((c) => c.text.trim().length > 40);

  const brand = domain.split('.')[0];
  const strip = (text: string) =>
    text
      // Drop the company's own name, and any legal-suffix tail after it.
      .replace(new RegExp(`\\b${brand}\\b[a-z ,.]*?\\b(inc|llc|ltd|corp|enterprises|company|co)\\b\\.?`, 'gi'), '')
      .replace(new RegExp(`\\b${brand}\\b'?s?`, 'gi'), '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s,.\-–—|]+/, '')
      .replace(/^(is|are|we|the)\s+/i, '')
      .trim();

  for (const candidate of candidates) {
    const stripped = strip(candidate.text);
    if (stripped.length >= 40) {
      return { query: stripped.slice(0, 300), derivedFrom: candidate.from };
    }
  }
  return {
    query: `companies similar to ${domain}`,
    derivedFrom: 'fallback — no usable self-description found on the site',
  };
}

/* -- the stage ---------------------------------------------------------- */

export interface SubjectArtifact {
  domain: string;
  crawledAt: string;
  robots: { host: string; published: boolean; crawlDelayMs?: number; disallowRules: number };
  mapped: number;
  selected: SelectedPage[];
  pages: PageSignals[];
  pagesCrawled: number;
  categoryQuery: { query: string; derivedFrom: string };
  /** Categories the site simply doesn't have. The thin-target diagnosis. */
  categoriesMissing: PageCategory[];
  notes: string[];
}

export interface SubjectOptions {
  mapLimit?: number;
  pageLimit?: number;
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

  const selected = selectPages(links, registrableDomain(domain), opts.pageLimit ?? 12);
  const pages: PageSignals[] = [];

  for (const page of selected) {
    const result = await scrape(cache, ledger, page.url, now);
    if (!result.ok) {
      pages.push({
        url: page.url,
        category: page.category,
        wordCount: 0,
        manualWorkQuotes: [],
        systemsNamed: [],
        aiTermsFound: [],
        roleLines: [],
        skipped: result.skipped ?? `scrape returned no markdown (status ${result.statusCode ?? '?'})`,
      });
      continue;
    }
    pages.push(extractSignals(page, result.markdown, result.title, result.description));
  }

  const present = new Set(pages.filter((p) => !p.skipped).map((p) => p.category));
  const categoriesMissing = (['help', 'careers', 'integrations', 'pricing'] as PageCategory[]).filter(
    (c) => !present.has(c)
  );
  if (categoriesMissing.length > 0) {
    notes.push(`no page found for: ${categoriesMissing.join(', ')} — the ops-describing pages are the yield`);
  }

  const derived = deriveCategoryQuery(pages, registrableDomain(domain));
  const categoryQuery = opts.categoryQueryOverride
    ? { query: opts.categoryQueryOverride, derivedFrom: 'supplied on the command line' }
    : derived;
  if (opts.categoryQueryOverride) {
    notes.push(`category query overridden; derived query would have been: "${derived.query}"`);
  }

  return {
    domain,
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
