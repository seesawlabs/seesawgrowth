/* ---------------------------------------------------------------------------
   Stage 03 — dated, sourced AI moves per peer.

   Perplexity answers the research question; Firecrawl reads the peer's own
   surface. Neither is trusted to state a fact on its own.

   THE PROBLEM THIS STAGE EXISTS TO SOLVE.

   Perplexity summarises, and a summary is a paraphrase. A paraphrase with a
   date or a number in it is precisely what this codebase refuses to ship. So
   nothing here quotes the model's account of *when* something happened or
   *who* it happened to. Every claim is rebuilt from `search_results` — a real
   URL and a real publication date — joined back to the sentence that cited
   that URL by its [n] marker. A sentence whose markers resolve to nothing is
   dropped and the drop is logged, because a silent drop is how a discovery
   regression hides.

   TWO LIVE FAILURE MODES, both observed 2026-08-24, both gated below. These
   are regression tests with a cost, not hypotheticals:

     1. NEAR-MISS DOMAIN. Asked about MedGyn Products (medgyn.com), the first
        citation was `medi-gyn.com` — a different company with a near-identical
        name. Punctuation-insensitive equality calls those the same company;
        plain equality calls them unrelated third-party coverage. Both are
        wrong, so `isNearMissDomain` makes a near miss its own verdict and the
        claim is dropped. Attributing another company's AI launch to a peer is
        the single most embarrassing failure this report could contain.

     2. YEAR MISMATCH. The prose said "2026" while the source it cited was
        dated 2025-07-31. The source's date wins, always — and where the prose
        names a year that no cited source's date supports, the sentence is
        dropped rather than corrected. Repairing it would mean deciding which
        half of a contradiction to believe, and we are not in a position to
        know.

   `observedAt` on every claim comes from `search_results[].date`. It never
   comes from the prose. That is the whole design.
--------------------------------------------------------------------------- */

import type { CacheOptions } from '../lib/cache.ts';
import type { Ledger } from '../lib/budget.ts';
import { ask, citedSentences, cleanStatement, type ResolvedCitation } from '../lib/clients/perplexity.ts';
import { map, scrape } from '../lib/clients/firecrawl.ts';
import { isNearMissDomain, nameKey, registrableDomain } from '../lib/domain.ts';
import { mapWithConcurrency, PEER_CONCURRENCY } from '../lib/concurrency.ts';
import type { PeerCandidate } from './02-peers.ts';

/**
 * A statement only counts as an AI move if it says so. Without this, generic
 * corporate news ("opened a distribution centre") arrives dated and sourced
 * and lands in a report about AI exposure, which reads as padding.
 */
const AI_TERMS = [
  'ai', 'a.i.', 'artificial intelligence', 'machine learning', 'ml model',
  'llm', 'large language model', 'generative', 'genai', 'gpt', 'copilot',
  'chatbot', 'chat bot', 'virtual assistant', 'automation', 'automated',
  'automate', 'robotic', 'robotics', 'rpa', 'predictive', 'algorithm',
  'computer vision', 'natural language', 'digital transformation',
];

/**
 * Absence-of-evidence language.
 *
 * THE MOST DANGEROUS THING PERPLEXITY RETURNS, and it defeated every other
 * gate on the first live run. Asked about Mazza Healthcare, it answered:
 *
 *   "The company pages returned describe products, quality systems, supply
 *    chain, and product development, but do not show dated published
 *    AI/ML/automation initiatives for Mazza Healthcare itself."
 *
 * That is an honest and useful answer — and it passed every check. It names
 * the peer. It cites three real, dated URLs. It contains "automation", so the
 * AI-relevance gate fired positive. It rendered in the report under "Where AI
 * is a threat to you", carrying a date, as though a competitor had done
 * something. The one thing it does not contain is a competitor doing anything.
 *
 * An assertion that nothing was found is not evidence of a move, and inverting
 * a negative into a dated threat is a fabrication in every sense that matters
 * even though every individual component was sourced. So absence language is
 * its own verdict, checked before AI relevance.
 */
const ABSENCE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(?:no|not|nothing|never)\b[^.]{0,80}\b(?:dated|citable|published|public|specific|documented|verifiable)\b/i, label: 'no citable evidence' },
  { pattern: /\b(?:do|does|did)\s+not\s+(?:show|describe|mention|indicate|disclose|report|reveal|detail|include|appear|identify)/i, label: 'the sources do not show it' },
  { pattern: /\b(?:could|can)\s*n(?:o|\u2019|')?t\s+(?:find|locate|identify|verify|confirm)/i, label: 'could not find' },
  { pattern: /\b(?:unable|failed)\s+to\s+(?:find|locate|identify|verify|confirm)/i, label: 'unable to find' },
  { pattern: /\bfound\s+(?:nothing|no)\b/i, label: 'found nothing' },
  { pattern: /\bno\s+(?:evidence|record|records|announcement|announcements|indication|information|details|initiative|initiatives|mention|sign)\b/i, label: 'no evidence' },
  { pattern: /\bnothing\s+(?:specific|citable|public|found|available)\b/i, label: 'nothing specific' },
  { pattern: /\b(?:absence|lack)\s+of\b/i, label: 'absence of' },
  { pattern: /\bnot\s+(?:a|an|its own|their own)\b[^.]{0,40}\b(?:initiative|deployment|announcement|program|programme|project|rollout|investment|offering|adoption)\b/i, label: 'explicitly not an initiative' },
  { pattern: /\bdisclaimer\b/i, label: 'a disclaimer, not a deployment' },
  { pattern: /\brather than\s+(?:a|an)\b[^.]{0,40}\b(?:initiative|deployment|announcement|product)\b/i, label: 'explicitly not an initiative' },
  /* Explicit non-attribution. The third shape of this failure, and the one
     that did real damage: asked about QuickRx Specialty Pharmacy, Perplexity
     answered "the search results surfaced a QuickRx-branded automated
     prescription pickup product from Bell and Howell, but that is not QuickRx
     Specialty Pharmacy and should not be attributed to this company."

     Correct, careful, and it passed every gate — it names the peer, cites a
     dated source, and contains "automated", which the action-verb check reads
     as a move. It rendered as the peer's second AI initiative and it was the
     claim that carried this run's peer-evidence count from one to two, which
     is what took coverage to 100% and marked the report sendable. A sentence
     that exists to disclaim an attribution must never become one. */
  { pattern: /\bshould not be (?:attributed|credited|confused|conflated|associated)\b/i, label: 'explicitly disclaims the attribution' },
  { pattern: /\b(?:is|are|was|were) not\s+(?:the same|this|that)\b/i, label: 'explicitly a different entity' },
  { pattern: /\b(?:a |an )?(?:different|another|separate|unrelated|third[- ]party)\s+(?:company|vendor|firm|entity|organisation|organization|business|product)\b/i, label: 'names a different company' },
  { pattern: /\bnot\s+(?:to be )?(?:confused|conflated)\s+with\b/i, label: 'explicitly a different entity' },
  { pattern: /\bbelongs? to (?:a |an )?(?:different|another)\b/i, label: 'belongs to another company' },
];

/** True when a statement asserts that nothing was found, rather than a fact. */
/**
 * Verbs that mean the peer actually did something.
 *
 * A POSITIVE REQUIREMENT, and the reason for it is that blocklisting denials
 * is whack-a-mole. The absence gate below was written for one live failure
 * ("…do not show dated published AI/ML/automation initiatives"), and the very
 * next run produced a different shape of the same thing:
 *
 *   "The only MedGyn page mentioning AI was a 2025 women's health standards
 *    page that contains a generic AI disclaimer, not a company initiative."
 *
 * Dated, correctly attributed, real citation, contains "AI" — and it is a
 * statement that MedGyn has done nothing. It was the one item holding
 * hpsrx.com's peer-evidence coverage above zero.
 *
 * There is no end to the ways a summariser can phrase "I found nothing", so
 * the gate is inverted: an AI *move* is a peer doing something, and a sentence
 * describing one contains a verb of doing. "Mentioning", "describes",
 * "contains" and "was" are not such verbs. This rejects some real moves phrased
 * unusually, and that is the correct trade: a dropped claim costs us one
 * bullet, an inverted negative costs the reader's trust in every other bullet.
 */
const ACTION_VERBS = [
  'launch', 'launched', 'launches', 'launching',
  'deploy', 'deployed', 'deploys', 'deploying', 'deployment of',
  'implement', 'implemented', 'implements', 'implementing', 'implementation of',
  'introduce', 'introduced', 'introduces', 'introducing',
  'announce', 'announced', 'announces', 'announcing',
  'roll out', 'rolled out', 'rolls out', 'rolling out',
  'adopt', 'adopted', 'adopts', 'adopting', 'adoption of',
  'partner', 'partnered', 'partners with', 'partnering',
  'acquire', 'acquired', 'acquires', 'acquiring', 'acquisition of',
  'invest', 'invested', 'invests', 'investing', 'investment in',
  'integrate', 'integrated', 'integrates', 'integrating', 'integration of',
  'pilot', 'piloted', 'piloting',
  'release', 'released', 'releases', 'releasing',
  'unveil', 'unveiled', 'unveils',
  'build', 'built', 'builds', 'building',
  'develop', 'developed', 'develops', 'developing',
  'use', 'uses', 'used', 'using', 'utilise', 'utilises', 'utilize', 'utilizes',
  'automate', 'automates', 'automated', 'automating',
  'went live', 'goes live', 'go live', 'live with',
  'signed', 'selected', 'switched to', 'migrated', 'upgraded',
  'expanded', 'scaled', 'operates', 'runs', 'powers', 'powered by',
  'offers', 'offering', 'provides', 'delivers', 'enables',
];

/**
 * True when the sentence describes the peer doing something, rather than
 * describing what a source does or does not say.
 */
export function describesAction(text: string): boolean {
  const flat = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return ACTION_VERBS.some((v) => flat.includes(` ${v} `));
}

export function assertsAbsence(text: string): string | null {
  for (const { pattern, label } of ABSENCE_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function mentionsAi(text: string): boolean {
  const flat = ` ${text.toLowerCase().replace(/[^a-z0-9.]+/g, ' ')} `;
  return AI_TERMS.some((t) => flat.includes(` ${t} `));
}

/** Four-digit years a sentence asserts, 1990-2099. */
export function yearsIn(text: string): number[] {
  const found = [...text.matchAll(/\b(19[9]\d|20\d\d)\b/g)].map((m) => Number(m[1]));
  return [...new Set(found)];
}

export type DropReason =
  | 'no_citation_marker'
  | 'unresolvable_marker'
  | 'no_source_date'
  | 'year_mismatch'
  | 'near_miss_domain'
  | 'asserts_absence'
  | 'no_action_verb'
  | 'not_about_ai'
  | 'does_not_name_peer'
  | 'too_short';

export interface DroppedStatement {
  peer: string;
  text: string;
  reason: DropReason;
  detail: string;
}

export interface PeerEvidenceItem {
  peerName: string;
  peerDomain: string;
  /** Cleaned prose, [n] markers stripped. Quotable. */
  statement: string;
  /** From search_results[].date. Never from the prose. */
  observedAt: string;
  citations: ResolvedCitation[];
}

/**
 * Does this sentence actually attribute the move to *this* peer?
 *
 * Perplexity drifts: asked about one distributor it will happily describe the
 * sector. A sentence passes if it names the peer, or if a cited source is on
 * the peer's own domain (a press release on their site is about them). Prose
 * that does neither is unattributable, so it is dropped.
 */
export function attributesToPeer(
  sentence: string,
  citations: ResolvedCitation[],
  peer: { name: string; domain: string }
): boolean {
  const flat = sentence.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = nameKey(peer.name);
  if (key.length >= 4 && flat.includes(key)) return true;

  const brand = registrableDomain(peer.domain).split('.')[0] ?? '';
  if (brand.length >= 4 && flat.includes(brand)) return true;

  return citations.some((c) => registrableDomain(c.url) === registrableDomain(peer.domain));
}

/**
 * Turn one Perplexity answer into evidence items, applying every gate and
 * recording every drop.
 *
 * Exported and pure so the gates are unit-testable against the exact
 * responses that produced the two live failures.
 */
export function evidenceFromAnswer(
  cited: { text: string; citations: ResolvedCitation[] }[],
  peer: { name: string; domain: string }
): { items: PeerEvidenceItem[]; dropped: DroppedStatement[] } {
  const items: PeerEvidenceItem[] = [];
  const dropped: DroppedStatement[] = [];
  const drop = (text: string, reason: DropReason, detail: string) =>
    dropped.push({ peer: peer.name, text: cleanStatement(text).slice(0, 200), reason, detail });

  for (const sentence of cited) {
    const clean = cleanStatement(sentence.text);
    if (clean.length < 30) {
      drop(sentence.text, 'too_short', `${clean.length} chars — not a statement`);
      continue;
    }

    // GATE 1 — near-miss domain. Runs first: a citation to a near-identically
    // named *different company* poisons the claim no matter what else is right.
    const nearMiss = sentence.citations.find((c) => isNearMissDomain(c.url, peer.domain));
    if (nearMiss) {
      drop(
        sentence.text,
        'near_miss_domain',
        `cited ${registrableDomain(nearMiss.url)} for peer ${peer.domain} — near-identical name, ` +
          'different company (the medi-gyn.com / medgyn.com failure)'
      );
      continue;
    }

    // GATE 2 — absence language. Runs before AI relevance, because a sentence
    // saying "no dated AI initiatives were found" contains "AI" and would
    // otherwise sail through as a dated, sourced, correctly attributed threat.
    const absence = assertsAbsence(clean);
    if (absence) {
      drop(
        sentence.text,
        'asserts_absence',
        `states that nothing was found ("${absence}") — an absence of evidence is not a move`
      );
      continue;
    }

    if (!mentionsAi(clean)) {
      drop(sentence.text, 'not_about_ai', 'no AI or automation term — not an AI move');
      continue;
    }

    // GATE 3 — a move needs a verb of doing. See ACTION_VERBS: this is the
    // positive form of the absence check, and it is the one that generalises.
    if (!describesAction(clean)) {
      drop(
        sentence.text,
        'no_action_verb',
        'describes what a source says rather than something the peer did'
      );
      continue;
    }

    if (!attributesToPeer(clean, sentence.citations, peer)) {
      drop(
        sentence.text,
        'does_not_name_peer',
        `neither the sentence nor any cited source ties this to ${peer.name}`
      );
      continue;
    }

    // A dated claim needs a date, and the only dates we accept come from
    // search_results. Prose dates are paraphrase.
    const dated = sentence.citations.filter((c) => c.date);
    if (dated.length === 0) {
      drop(
        sentence.text,
        'no_source_date',
        `cited ${sentence.citations.length} source(s), none carrying a publication date`
      );
      continue;
    }

    // GATE 4 — year mismatch. If the prose names a year, some cited source's
    // date must agree with it. Prefer the source's date; drop on conflict.
    const proseYears = yearsIn(clean);
    const sourceYears = new Set(dated.map((c) => Number(c.date!.slice(0, 4))));
    if (proseYears.length > 0 && !proseYears.some((y) => sourceYears.has(y))) {
      drop(
        sentence.text,
        'year_mismatch',
        `prose says ${proseYears.join('/')} but cited source(s) are dated ` +
          `${[...sourceYears].join('/')} — the source's date wins, so this is dropped`
      );
      continue;
    }

    // Earliest dated citation: the first report of a move is its date.
    const ordered = [...dated].sort((a, b) => a.date!.localeCompare(b.date!));
    items.push({
      peerName: peer.name,
      peerDomain: peer.domain,
      statement: clean,
      observedAt: ordered[0].date!,
      citations: ordered,
    });
  }

  return { items, dropped };
}

/* -- the peer's own surface --------------------------------------------- */

/** URL paths where a company announces things. */
const ANNOUNCEMENT_KEYWORDS = [
  'news', 'press', 'press-release', 'newsroom', 'blog', 'announcement',
  'announcements', 'media', 'insights', 'articles', 'technology', 'innovation',
  'ai', 'automation', 'digital',
];

export function selectAnnouncementPages(
  links: { url: string }[],
  limit: number
): string[] {
  const scored: { url: string; score: number }[] = [];
  for (const link of links) {
    let path: string;
    try {
      path = new URL(link.url).pathname.toLowerCase();
    } catch {
      continue;
    }
    if (/\.(xml|json|pdf|jpe?g|png|gif|svg|css|js|zip)($|\?)/i.test(link.url)) continue;
    if (/sitemap|\/cart|\/checkout|\/login|\/account/i.test(link.url)) continue;
    const tokens = path.split('/').flatMap((s) => s.split(/[-_.]/)).filter(Boolean);
    const index = ANNOUNCEMENT_KEYWORDS.findIndex((k) => tokens.includes(k));
    if (index === -1) continue;
    // Earlier keyword = better, shorter path = closer to the index page.
    scored.push({ url: link.url, score: index * 100 + path.length });
  }
  scored.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of scored) {
    const norm = s.url.replace(/\/$/, '');
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(s.url);
    if (out.length >= limit) break;
  }
  return out;
}

export interface PeerOwnSurface {
  peerDomain: string;
  pagesScraped: number;
  /** Verbatim sentences from the peer's own site that mention AI. */
  aiQuotes: { url: string; quote: string }[];
  notes: string[];
}

/**
 * Sentences on a page that mention AI, kept verbatim. A peer's own words about
 * their AI work are stronger evidence than anyone's summary of them — and
 * because we keep the quotation and the URL, the claim cites them rather than
 * characterising them.
 */
export function aiQuotesFrom(markdown: string, url: string, limit = 3): { url: string; quote: string }[] {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ');
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const out: { url: string; quote: string }[] = [];
  for (const raw of sentences) {
    const quote = raw.replace(/^[\s\-*>#|]+/, '').trim();
    if (quote.length < 40 || quote.length > 300) continue;
    if (!mentionsAi(quote)) continue;
    if (out.some((q) => q.quote === quote)) continue;
    out.push({ url, quote });
    if (out.length >= limit) break;
  }
  return out;
}

/* -- the stage ---------------------------------------------------------- */

export interface PeerEvidence {
  peerName: string;
  peerDomain: string;
  confidence: PeerCandidate['confidence'];
  items: PeerEvidenceItem[];
  ownSurface?: PeerOwnSurface;
  /** True when this peer contributed at least one dated, sourced AI move. */
  hasDatedAiEvidence: boolean;
}

export interface PeerEvidenceArtifact {
  subjectDomain: string;
  gatheredAt: string;
  peers: PeerEvidence[];
  dropped: DroppedStatement[];
  dropSummary: Record<string, number>;
  peersWithDatedAiEvidence: number;
  notes: string[];
}

export interface PeerEvidenceOptions {
  /** How many peers to research. Each costs one Perplexity call. */
  maxPeers?: number;
  /** Crawl each peer's own site as well. Costs Firecrawl credits. */
  crawlPeerSites?: boolean;
  pagesPerPeer?: number;
  /** Peers researched concurrently. Defaults to PEER_CONCURRENCY. */
  concurrency?: number;
}

/**
 * The research question. Deliberately asks for dates and sources and nothing
 * else — a prompt that invites narrative gets narrative, and narrative is what
 * the gates above spend their time throwing away.
 */
export function peerPrompt(peer: { name: string; domain: string }): string {
  return (
    `What specific artificial intelligence, machine learning, or automation ` +
    `initiatives has the company ${peer.name} (website ${peer.domain}) announced ` +
    `or deployed? Include only things you can cite to a dated published source. ` +
    `For each one, state what they did and when, in a single sentence, and cite ` +
    `the source. Do not include general industry trends, and do not include other ` +
    `companies with similar names. If you find nothing specific about this ` +
    `company, say so plainly.`
  );
}

export async function runPeerEvidenceStage(
  cache: CacheOptions,
  ledger: Ledger,
  subjectDomain: string,
  peers: PeerCandidate[],
  now: string,
  opts: PeerEvidenceOptions = {}
): Promise<PeerEvidenceArtifact> {
  const notes: string[] = [];
  const maxPeers = opts.maxPeers ?? 6;
  const targets = peers.slice(0, maxPeers);
  if (peers.length > targets.length) {
    notes.push(`researched ${targets.length} of ${peers.length} peer(s) — one Perplexity call each`);
  }

  const allDropped: DroppedStatement[] = [];

  /* Concurrent across peers. The ledger's headroom check is inherently racy
     under concurrency: several calls can pass it before any of them records a
     cost. At roughly half a cent per peer lookup against a dollar-scale
     ceiling that overshoot is immaterial, and the alternative — serialising to
     keep the check exact — is the three-minute run this replaced. */
  const out = await mapWithConcurrency(targets, opts.concurrency ?? PEER_CONCURRENCY, async (peer) => {
    const peerRef = { name: peer.name, domain: peer.domain };
    let items: PeerEvidenceItem[] = [];
    let dropped: DroppedStatement[] = [];

    try {
      const answer = await ask(cache, ledger, peerPrompt(peerRef), now, {
        label: `peer ${peer.domain}`,
      });
      const { cited, dropped: uncited } = citedSentences(answer);
      for (const u of uncited) {
        allDropped.push({
          peer: peer.name,
          text: u.text,
          reason: u.reason.startsWith('no citation') ? 'no_citation_marker' : 'unresolvable_marker',
          detail: u.reason,
        });
      }
      const result = evidenceFromAnswer(cited, peerRef);
      items = result.items;
      dropped = result.dropped;
      allDropped.push(...dropped);
    } catch (error) {
      notes.push(`Perplexity failed for ${peer.domain}: ${(error as Error).message.slice(0, 160)}`);
    }

    let ownSurface: PeerOwnSurface | undefined;
    if (opts.crawlPeerSites) {
      const surfaceNotes: string[] = [];
      const aiQuotes: { url: string; quote: string }[] = [];
      let pagesScraped = 0;
      try {
        const mapped = await map(cache, ledger, peer.domain, 40, now);
        const pages = selectAnnouncementPages(mapped.links ?? [], opts.pagesPerPeer ?? 2);
        if (pages.length === 0) {
          surfaceNotes.push('no news, press or blog path found in the site map');
        }
        for (const url of pages) {
          const page = await scrape(cache, ledger, url, now);
          if (!page.ok) {
            surfaceNotes.push(`${url}: ${page.skipped ?? 'no markdown'}`);
            continue;
          }
          pagesScraped += 1;
          aiQuotes.push(...aiQuotesFrom(page.markdown, url));
        }
      } catch (error) {
        surfaceNotes.push(`crawl failed: ${(error as Error).message.slice(0, 160)}`);
      }
      ownSurface = { peerDomain: peer.domain, pagesScraped, aiQuotes, notes: surfaceNotes };
    }

    return {
      peerName: peer.name,
      peerDomain: peer.domain,
      confidence: peer.confidence,
      items,
      ownSurface,
      hasDatedAiEvidence: items.length > 0,
    };
  });

  const dropSummary: Record<string, number> = {};
  for (const d of allDropped) dropSummary[d.reason] = (dropSummary[d.reason] ?? 0) + 1;

  const withEvidence = out.filter((p) => p.hasDatedAiEvidence).length;
  if (withEvidence === 0 && targets.length > 0) {
    notes.push(
      'no peer produced a dated, sourced AI move — either the peer set is wrong or ' +
        'this category genuinely has no public AI activity, and those need different responses'
    );
  }

  return {
    subjectDomain,
    gatheredAt: now,
    peers: out,
    dropped: allDropped,
    dropSummary,
    peersWithDatedAiEvidence: withEvidence,
    notes,
  };
}
