/* ---------------------------------------------------------------------------
   The lead-facing deliverable.

   Stage 05 emits markdown, which is right for review and wrong for a lead: the
   document a prospect opens from a magic link is the first thing they see of
   SeeSaw's work, and a design-led studio sending a raw .md file is arguing
   against itself.

   So this is a second renderer over the same validated claims. It adds no
   facts. Both renderers read `claims.json`, and neither can introduce a
   numeral — if a figure is in this document it survived `validateClaim`.

   BRAND. Every colour, typeface and step comes from
   sites/reality-check/src/styles/tokens.css, which takes them verbatim from
   production seesawlabs.com. CLAUDE.md forbids inventing colour values, so the
   token block below is copied rather than approximated. The two dark-theme
   ramps are the one addition: the parent site is light-only, and a report
   opened at night on a phone in a dark-mode browser has to hold together.

   COPY lives in ./copy.ts, not here — see the note at the top of that file.
--------------------------------------------------------------------------- */

import type { Claim, Coverage, MissingVariable } from '../lib/claim.ts';
import type { RunMeta } from '../lib/run.ts';
import type { SubjectArtifact } from '../stages/01-subject.ts';
import type { PeersArtifact } from '../stages/02-peers.ts';
import { COPY, UNIVERSAL_UNKNOWNS, type ReportCopy, type Sec } from './copy.ts';
import type { Synthesis } from '../stages/06-synthesis.ts';
import { partitionClaims } from '../lib/claim.ts';

export interface RenderInput {
  meta: RunMeta;
  claims: Claim[];
  coverage: Coverage;
  subject: SubjectArtifact;
  peers?: PeersArtifact | null;
  /** Display name for the company. Falls back to the domain. */
  companyName?: string;
  /** Where the CTA points. */
  bookingUrl?: string;
  /** Shown in a banner above the document. Omit for a real send. */
  internalNotice?: string;
  copy?: ReportCopy;
  /**
   * Stage 06's analysis. Without it the document is a list of sourced facts —
   * true, checkable, and not worth a reader's time. See ./copy.ts.
   */
  synthesis?: Synthesis | null;
  /** Named in the colophon, so the reader knows what wrote the analysis. */
  synthesisModel?: string;
}

/* -- escaping ----------------------------------------------------------- */

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Declared blanks render as visible blanks — the whole persuasive move. A
 * `[key]` token becomes a styled span, and because `validateClaim` has already
 * proved every token is declared, there is nothing to guard against here.
 */
function withBlanks(text: string): string {
  return esc(text).replace(/\[([a-zA-Z][a-zA-Z0-9_]*)\]/g, '<span class="blank">$1</span>');
}

/**
 * Quoted spans become real quotation marks, so their words look like theirs.
 *
 * The minimum length used to be 8 characters, which broke any sentence
 * containing a short quoted term: `"pharma" is down 11.7% and "carepath" down
 * 11.1%` rendered with an orphaned opening quote and then paired the wrong
 * marks together, splitting one sentence across four lines. Match any length,
 * and refuse to span another entity so a pair can never cross a quote it
 * should have closed at.
 */
function withQuotes(html: string): string {
  return html.replace(/&quot;((?:(?!&quot;).)*?)&quot;/g, '<q>$1</q>');
}

/** `**bold**` in copy strings only. Claims are never marked up. */
function bold(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

/* -- the document ------------------------------------------------------- */

/**
 * Stage 06 writes claim ids inline — "(obs-manual-1)", "(dem-2, dem-trend-1)"
 * — as well as in its `claimIds` fields. Those are real citations, so rather
 * than stripping them we turn them into the same superscript references the
 * evidence appendix uses. The reader gets a footnote; we get an analysis whose
 * every assertion is one click from its source.
 */
export function linkClaimIds(
  escaped: string,
  footnotesFor: (id: string) => number[],
  knownIds: readonly string[]
): string {
  /* Match the run's actual claim ids, never a prefix pattern.
     A `/(obs|cmp|dem|hyp)[a-z0-9._-]*­/` pattern looked equivalent and ate the
     word "demand": stage 06 wrote "Demand for the broad terms your brand sits
     near is shrinking", the renderer deleted "Demand", and the client's report
     opened that finding mid-sentence. Any English word starting with one of
     those three letters was a candidate. */
  const ids = new Set(knownIds);

  const refs = (list: string[]) => {
    const ns = [...new Set(list.flatMap(footnotesFor))].sort((a, b) => a - b);
    return ns.map((n) => `<a class="ref" href="#src-${n}" aria-label="Source ${n}">${n}</a>`).join('');
  };

  // Parenthetical groups that contain nothing but ids, commas and whitespace.
  let out = escaped.replace(/\(\s*([a-z0-9._-]+(?:\s*,\s*[a-z0-9._-]+)*)\s*\)/gi, (whole, inner) => {
    const parts = String(inner)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0 || !parts.every((x) => ids.has(x))) return whole;
    const r = refs(parts);
    return r || '';
  });

  // Any id left loose in the prose.
  for (const id of [...ids].sort((a, b) => b.length - a.length)) {
    if (!out.includes(id)) continue;
    out = out.split(id).join(refs([id]));
  }

  return out.replace(/\s+([.,;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function renderReportHtml(input: RenderInput): string {
  const copy = input.copy ?? COPY;
  const { renderable } = partitionClaims(input.claims);
  const company = input.companyName?.trim() || input.subject.domain;
  const pulled = input.meta.startedAt.slice(0, 10);
  const synthesis = input.synthesis ?? null;

  /* Research signals are inputs to the analysis, not findings for the client.
     See `internalOnly` in lib/claim.ts — careers pages are the reason it
     exists. Stage 06 still sees them; this document does not. */
  const shown = renderable.filter((c) => !c.internalOnly);

  // Footnote index in first-use order, over the claims that appear anywhere.
  const index = new Map<string, number>();
  const ordered: Claim['sources'] = [];
  for (const claim of shown) {
    for (const source of claim.sources) {
      if (!index.has(source.url)) {
        index.set(source.url, index.size + 1);
        ordered.push(source);
      }
    }
  }
  const byId = new Map(shown.map((c) => [c.id, c]));
  const footnotesFor = (id: string): number[] => {
    const claim = byId.get(id);
    if (!claim) return [];
    return claim.sources
      .map((s) => index.get(s.url))
      .filter((n): n is number => typeof n === 'number');
  };

  const refsFor = (claim: Claim) =>
    [...new Set(claim.sources.map((s) => index.get(s.url)))]
      .filter((n): n is number => typeof n === 'number')
      .sort((a, b) => a - b)
      .map((n) => `<a class="ref" href="#src-${n}" aria-label="Source ${n}">${n}</a>`)
      .join('');

  /** Analysis prose: escape, turn blanks visible, link ids, curl the quotes. */
  const prose = (text: string) =>
    withQuotes(linkClaimIds(withBlanks(text), footnotesFor, [...byId.keys()]));

  const sec = (s: Sec, body: string, extraClass = '') => {
    if (!body.trim()) return '';
    const intro = s.intro ? `<p class="intro">${esc(s.intro)}</p>` : '';
    return `<section class="sec ${extraClass}">
      <div class="sechead">
        <p class="secnum">${esc(s.num)} &mdash; ${esc(s.eyebrow)}</p>
        <h2>${esc(s.heading)}</h2>
        ${intro}
      </div>
      ${body}
    </section>`;
  };

  /* -- analysis blocks -- */

  const standing = synthesis?.standing ? `<p class="standing">${prose(synthesis.standing)}</p>` : '';

  /* Questions are the spine of the document. Each renders as the question
     itself, then the research that makes it worth asking, then what the answer
     would change — in that order, because the question has to land before the
     justification or we are back to lecturing. */
  const questions = (synthesis?.questions ?? []).length
    ? `<ol class="qs">${synthesis!.questions
        .map(
          (q) => `<li class="q">
            <p class="q__ask">${prose(q.question)}</p>
            <div class="q__meta">
              <p class="q__lab">${esc(copy.whyLabel)}</p>
              <p class="q__why">${prose(q.why)}</p>
            </div>
            <div class="q__meta">
              <p class="q__lab">${esc(copy.changesLabel)}</p>
              <p class="q__why">${prose(q.whatItChanges)}</p>
            </div>
          </li>`
        )
        .join('')}</ol>`
    : '';

  /**
   * A sizing block. Assumptions are printed as ours, with their basis, before
   * the arithmetic that uses them — so the reader meets the caveat before the
   * number rather than after it, and the closing question hands the sum back.
   */
  const sizing = (z: NonNullable<Synthesis['opportunities'][number]['sizing']>) => `
    <div class="size">
      <p class="size__lab">${esc(copy.assumptionsLabel)}</p>
      <ul class="size__as">
        ${z.assumptions
          .map(
            (a) => `<li>
              <span class="size__v">${esc(a.value)}${a.unit ? ` <span class="size__u">${esc(a.unit)}</span>` : ''}</span>
              <span class="size__l">${esc(a.label)}</span>
              <span class="size__b">${esc(a.basis)}</span>
            </li>`
          )
          .join('')}
      </ul>
      <p class="size__sum">${prose(z.arithmetic)}</p>
      <p class="size__q">${prose(z.question)}</p>
    </div>`;

  const opportunities = (synthesis?.opportunities ?? []).length
    ? `<ol class="ops">${synthesis!.opportunities
        .map(
          (o) => `<li class="op">
            <h3 class="op__h">${esc(o.heading)}</h3>
            <p class="op__b">${prose(o.body)}</p>
            <p class="op__basis"><span class="op__lab">Why we think this applies to you</span> ${prose(o.basis)}</p>
            ${o.sizing ? sizing(o.sizing) : ''}
          </li>`
        )
        .join('')}</ol>`
    : '';

  const peerSignal = synthesis?.competitorSignal.point
    ? `<p class="finding">${prose(synthesis.competitorSignal.point)}</p>`
    : '';

  const blindSpots = (synthesis?.blindSpots ?? []).length
    ? `<ul class="unknowns">${[...new Set([...synthesis!.blindSpots, ...UNIVERSAL_UNKNOWNS])]
        .map((b) => `<li><span class="ublank"></span><span>${prose(b)}</span></li>`)
        .join('')}</ul>`
    : `<ul class="unknowns">${UNIVERSAL_UNKNOWNS.map(
        (b) => `<li><span class="ublank"></span><span>${esc(b)}</span></li>`
      ).join('')}</ul>`;

  /* -- supporting evidence, grouped -- */

  const isDemand = (c: Claim) => c.id.startsWith('dem-');
  const groups: { label: string; items: Claim[] }[] = [
    {
      label: 'Your own public surface — your words, quoted',
      items: shown.filter((c) => c.tier === 'observed' && !isDemand(c)),
    },
    {
      label: 'Comparable companies — dated, published moves',
      items: shown.filter((c) => c.tier === 'comparative'),
    },
    {
      label: 'Category demand — named provider, both dates stamped',
      items: shown.filter((c) => isDemand(c) && c.tier === 'observed'),
    },
  ];

  const evidenceLi = (claim: Claim) => {
    const peer = claim.peerName ? `<span class="peer">${esc(claim.peerName)}</span> ` : '';
    const when = claim.observedAt ? `<span class="when">${esc(claim.observedAt)}</span>` : '';
    return `<li class="ev"><span class="evid">${esc(claim.id)}</span>
      <span class="evbody"><p>${peer}${withQuotes(withBlanks(claim.statement))}${refsFor(claim)}</p>${when}</span></li>`;
  };

  const evidenceBody = groups
    .filter((g) => g.items.length > 0)
    .map(
      (g) =>
        `<div class="evgroup"><h3>${esc(g.label)}</h3><ul class="evlist">${g.items
          .map(evidenceLi)
          .join('')}</ul></div>`
    )
    .join('');

  /* -- sources -- */

  const sources = ordered
    .map((s, i) => {
      const n = i + 1;
      const label = s.title || s.publisher || s.url;
      return `<li id="src-${n}">
        <span class="srcnum">${n}</span>
        <span class="srcbody">
          <span class="srclabel">${esc(label)}</span>
          <a class="srcurl" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a>
          <span class="srcret">retrieved ${esc(s.retrievedAt.slice(0, 10))}${s.publisher ? ` · ${esc(s.publisher)}` : ''}</span>
        </span>
      </li>`;
    })
    .join('');

  const redirected = input.subject.effectiveDomain !== input.subject.domain;

  const banner = input.internalNotice
    ? `<div class="internal"><div class="shell"><span class="itag">Internal — not sent</span><span class="itext">${esc(input.internalNotice)}</span></div></div>`
    : '';

  const noAnalysis = !synthesis
    ? `<div class="sec"><p class="empty">${esc(copy.emptySection)}</p></div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(copy.kicker)} — ${esc(company)}</title>
<meta name="description" content="${esc(copy.kicker)} for ${esc(company)}, compiled from public evidence by SeeSaw Labs.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Pixelify+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${STYLES}</style>
</head>
<body>
${banner}
<header class="mast">
  <div class="shell">
    <p class="brand"><span class="dotmark"></span>SeeSaw Labs</p>
    <p class="kicker">${esc(copy.kicker)}</p>
    <h1>${esc(copy.headline)}</h1>
    <div class="subject">
      <span>${esc(company)}</span><span class="sep">/</span>
      <span>${esc(input.subject.domain)}${redirected ? ` &rarr; ${esc(input.subject.effectiveDomain)}` : ''}</span><span class="sep">/</span>
      <span>${esc(pulled)}</span>
    </div>
    <p class="promise">${withQuotes(bold(copy.promise).replace('{blank}', '<span class="blank">blank</span>'))}</p>
  </div>
</header>

<main class="shell">
  ${noAnalysis}
  ${sec(copy.sections.standing, standing)}
  ${sec(copy.sections.opportunities, opportunities)}
  ${sec(copy.sections.questions, questions)}
  ${sec(copy.sections.peers, peerSignal)}
  ${sec(copy.sections.blindSpots, blindSpots, 'boundary')}

  <section class="closing">
    <h2>${esc(copy.closing.heading)}</h2>
    ${copy.closing.body.map((p) => `<p>${bold(p)}</p>`).join('')}
    ${input.bookingUrl ? `<a class="cta" href="${esc(input.bookingUrl)}">${esc(copy.closing.ctaLabel)}</a>` : ''}
  </section>

  ${sec(copy.sections.evidence, evidenceBody, 'evidencesec')}

  <section class="srcsec">
    <h2>${esc(copy.sourcesHeading)}</h2>
    <ol class="sources">${sources}</ol>
    <p class="colophon">
      ${shown.length} claims, ${index.size} distinct sources${synthesis ? `, analysis by ${esc(input.synthesisModel ?? 'Claude')}` : ''}.<br>
      A numeral anywhere in this document either carries a source above or appears as a declared blank.
      That rule is enforced in code, on the analysis as well as the evidence.<br>
      ${redirected ? `${esc(input.subject.domain)} redirects to ${esc(input.subject.effectiveDomain)} — we followed the new host, and the rebrand is worth a conversation of its own.<br>` : ''}
      Compiled from public sources by SeeSaw Labs · questions to calvin@seesawlabs.com
    </p>
  </section>
</main>
</body>
</html>
`;
}

const STYLES = `
:root{
--primary-50:#e9f6ff;--primary-100:#d1ecff;--primary-200:#9ad4fd;--primary-300:#7eadf7;
--primary-400:#337df0;--primary-500:#1061df;--primary-600:#0950bd;--primary-700:#033787;
--primary-800:#002056;--primary-900:#00032e;
--neutral-50:#f5f5f5;--neutral-100:#ededed;--neutral-200:#d4d4d4;--neutral-500:#787878;
--neutral-700:#454545;--neutral-900:#171717;
--amber-100:#fff3d2;--amber-500:#e0ac10;--amber-700:#876603;
--dot:var(--neutral-200);
--dot-grid:radial-gradient(1.5px at center,var(--dot) 0%,var(--dot) 99%,transparent 100%);
--dot-step:40px 40px;
--bg:#ffffff;--bg-sunk:var(--neutral-100);--bg-deep:var(--primary-900);--surface:#ffffff;
--ink:var(--neutral-900);--ink-2:var(--neutral-700);--muted:var(--neutral-500);
--rule:var(--neutral-200);--rule-soft:var(--neutral-100);
--accent:var(--primary-500);--accent-deep:var(--primary-700);--accent-soft:var(--primary-50);
--accent-ink:#ffffff;--on-deep:#ffffff;--on-deep-2:var(--primary-200);--on-deep-muted:var(--primary-300);
--font-body:'Outfit',ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
--font-accent:'Pixelify Sans',ui-monospace,monospace;
--font-mono:'IBM Plex Mono',ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;
--gutter:min(6vw,32px);
--radius-sm:.25rem;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;
--ls-tight:-.025em;--ls-wide:.025em;--ls-widest:.1em;
--dur-normal:.2s;--ease-out:cubic-bezier(0,0,.2,1);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
--dot:#0b2a52;--bg:#00030f;--bg-sunk:#000821;--bg-deep:#00030f;--surface:#04102b;
--ink:#eef4ff;--ink-2:#c3d6f2;--muted:#8fa7c9;--rule:#0e2a55;--rule-soft:#0a1e3d;
--accent:#7eadf7;--accent-deep:#9ad4fd;--accent-soft:#04193f;--accent-ink:#00032e;
--on-deep-muted:#7eadf7;
}}
:root[data-theme="dark"]{
--dot:#0b2a52;--bg:#00030f;--bg-sunk:#000821;--bg-deep:#00030f;--surface:#04102b;
--ink:#eef4ff;--ink-2:#c3d6f2;--muted:#8fa7c9;--rule:#0e2a55;--rule-soft:#0a1e3d;
--accent:#7eadf7;--accent-deep:#9ad4fd;--accent-soft:#04193f;--accent-ink:#00032e;
--on-deep-muted:#7eadf7;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:1rem;line-height:1.5;-webkit-font-smoothing:antialiased}
.shell{max-width:53rem;margin:0 auto;padding:0 var(--gutter)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
.internal{background:var(--amber-100);color:var(--amber-700);border-bottom:1px solid var(--amber-500)}
.internal .shell{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;align-items:baseline;padding:.7rem var(--gutter)}
.itag{font-family:var(--font-accent);font-size:.8rem;letter-spacing:var(--ls-wide);text-transform:uppercase;font-weight:600}
.itext{font-size:.82rem;line-height:1.45}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .internal{background:#221a04;color:var(--amber-500);border-bottom-color:var(--amber-700)}}
:root[data-theme="dark"] .internal{background:#221a04;color:var(--amber-500);border-bottom-color:var(--amber-700)}
.mast{background:var(--bg-deep);color:var(--on-deep);background-image:var(--dot-grid);background-size:var(--dot-step);border-bottom:1px solid var(--rule)}
.mast .shell{padding:4.5rem var(--gutter) 3.5rem}
.brand{display:flex;align-items:center;gap:.55rem;margin:0 0 3rem;font-family:var(--font-accent);font-size:1rem;letter-spacing:var(--ls-wide);color:var(--on-deep)}
.dotmark{width:9px;height:9px;border-radius:50%;background:var(--primary-400);flex:none}
.kicker{font-family:var(--font-accent);font-size:.85rem;letter-spacing:var(--ls-wide);text-transform:uppercase;color:var(--on-deep-muted);margin:0 0 1rem}
.mast h1{font-weight:600;letter-spacing:var(--ls-tight);font-size:clamp(2.1rem,6vw,3.4rem);line-height:1.08;margin:0 0 1.25rem;text-wrap:balance;max-width:38ch}
.subject{display:flex;flex-wrap:wrap;gap:.4rem 1rem;align-items:baseline;font-family:var(--font-mono);font-size:.8rem;color:var(--on-deep-2);margin:0 0 2rem}
.subject .sep{color:var(--primary-700)}
.promise{font-size:1.06rem;line-height:1.6;color:var(--on-deep-2);max-width:56ch;margin:0;padding-top:1.75rem;border-top:1px solid var(--primary-800)}
.promise strong{color:var(--on-deep);font-weight:500}
main{padding:0 0 5rem}
.sec{padding:3.25rem 0 0}
.sechead{display:flex;flex-direction:column;gap:.5rem;margin:0 0 1.75rem}
.secnum{font-family:var(--font-accent);font-size:.85rem;letter-spacing:var(--ls-wide);color:var(--accent);text-transform:uppercase}
.sec h2{font-weight:600;font-size:clamp(1.4rem,3.4vw,1.9rem);letter-spacing:var(--ls-tight);line-height:1.18;margin:0;text-wrap:balance;max-width:32ch}
.intro{font-size:1rem;line-height:1.62;color:var(--ink-2);max-width:60ch;margin:.75rem 0 0}
.empty{font-size:1rem;line-height:1.62;color:var(--muted);max-width:58ch;font-style:italic}
ul.claims{list-style:none;margin:0;padding:0;display:grid;gap:1.15rem}
.claim{background:var(--surface);border:1px solid var(--rule);border-radius:var(--radius-lg);padding:1.15rem 1.3rem}
.claim>p{margin:0;font-size:1rem;line-height:1.62;color:var(--ink)}
.claim q{quotes:none;font-style:italic;color:var(--ink-2)}
.claim q::before{content:'\\201C'}
.claim q::after{content:'\\201D'}
.peer{display:inline-block;font-family:var(--font-mono);font-size:.72rem;font-weight:500;letter-spacing:var(--ls-wide);text-transform:uppercase;background:var(--accent-soft);color:var(--accent-deep);padding:.2rem .45rem;border-radius:var(--radius-sm);margin-right:.5rem;vertical-align:.08em}
.when{display:inline-block;margin-top:.7rem;font-family:var(--font-mono);font-size:.7rem;letter-spacing:var(--ls-wide);color:var(--muted)}
.when::before{content:"first reported "}
a.ref{font-family:var(--font-mono);font-size:.62rem;font-weight:500;text-decoration:none;color:var(--accent-deep);background:var(--accent-soft);padding:.08rem .26rem;border-radius:2px;margin-left:.18rem;vertical-align:super;line-height:1}
a.ref:hover{background:var(--accent);color:var(--accent-ink)}
.blank{font-family:var(--font-mono);font-size:.86em;color:var(--accent-deep);background:var(--accent-soft);border-bottom:2px solid var(--accent);padding:.05rem .3rem;border-radius:2px 2px 0 0;white-space:nowrap}
.claim-hyp{border-style:dashed}
.needbox{margin-top:1rem;padding-top:.9rem;border-top:1px dashed var(--rule)}
.needhead{font-family:var(--font-accent);font-size:.8rem;letter-spacing:var(--ls-wide);text-transform:uppercase;color:var(--accent);margin:0 0 .6rem}
ul.need{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}
ul.need li{display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline}
.needlabel{font-size:.9rem;color:var(--ink-2)}
.unit{font-family:var(--font-mono);font-size:.72rem;color:var(--muted)}


/* -- questions: the spine of the document ------------------------------ */
ol.qs{list-style:none;counter-reset:q;margin:0;padding:0;display:grid;gap:1.6rem}
li.q{counter-increment:q;background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--accent);border-radius:var(--radius-lg);padding:1.4rem 1.5rem;position:relative}
.q__ask{margin:0 0 1rem;font-size:clamp(1.06rem,2.3vw,1.2rem);line-height:1.45;font-weight:500;color:var(--ink);max-width:56ch}
.q__ask::before{content:counter(q,decimal-leading-zero);display:block;font-family:var(--font-accent);font-size:.8rem;font-weight:400;letter-spacing:var(--ls-wide);color:var(--accent);margin-bottom:.5rem}
.q__meta{margin-top:.85rem}
.q__lab{font-family:var(--font-mono);font-size:.62rem;letter-spacing:var(--ls-widest);text-transform:uppercase;color:var(--muted);margin:0 0 .3rem}
.q__why{margin:0;font-size:.94rem;line-height:1.6;color:var(--ink-2);max-width:62ch}

/* -- opportunities: things to build ------------------------------------ */
ol.ops{list-style:none;counter-reset:o;margin:0;padding:0;display:grid;gap:1.6rem}
li.op{counter-increment:o;background:var(--surface);border:1px solid var(--rule);border-radius:var(--radius-lg);padding:1.5rem;position:relative}
.op__h{font-size:clamp(1.1rem,2.4vw,1.28rem);font-weight:600;letter-spacing:var(--ls-tight);line-height:1.3;margin:0 0 .7rem;padding-right:2.5rem;color:var(--ink)}
li.op::after{content:counter(o,decimal-leading-zero);position:absolute;top:1.5rem;right:1.5rem;font-family:var(--font-accent);font-size:1.1rem;color:var(--rule);line-height:1}
.op__b{margin:0 0 .9rem;font-size:1rem;line-height:1.62;color:var(--ink);max-width:62ch}
.op__basis{margin:0;font-size:.92rem;line-height:1.6;color:var(--ink-2);max-width:62ch}
.op__lab{font-family:var(--font-mono);font-size:.62rem;letter-spacing:var(--ls-widest);text-transform:uppercase;color:var(--muted);display:block;margin-bottom:.25rem}

/* -- sizing: our numbers, labelled as ours ---------------------------- */
.size{margin-top:1.2rem;padding:1.1rem 1.2rem;background:var(--bg-sunk);border-radius:var(--radius-md);border:1px dashed var(--rule)}
.size__lab{font-family:var(--font-accent);font-size:.78rem;letter-spacing:var(--ls-wide);text-transform:uppercase;color:var(--accent);margin:0 0 .8rem}
ul.size__as{list-style:none;margin:0 0 1rem;padding:0;display:grid;gap:.65rem}
ul.size__as li{display:grid;grid-template-columns:auto 1fr;gap:.15rem .8rem;align-items:baseline}
.size__v{font-family:var(--font-mono);font-size:1rem;font-weight:500;color:var(--accent-deep);background:var(--accent-soft);padding:.1rem .4rem;border-radius:var(--radius-sm);white-space:nowrap}
.size__u{font-size:.72rem;color:var(--muted)}
.size__l{font-size:.94rem;color:var(--ink)}
.size__b{grid-column:2;font-size:.8rem;line-height:1.5;color:var(--muted);font-style:italic}
.size__sum{margin:0 0 .8rem;padding-top:.8rem;border-top:1px solid var(--rule);font-size:.98rem;line-height:1.6;color:var(--ink);max-width:60ch}
.size__q{margin:0;font-size:.98rem;line-height:1.55;font-weight:500;color:var(--accent-deep);max-width:56ch}
@media (max-width:520px){ul.size__as li{grid-template-columns:1fr}.size__b{grid-column:1}}
/* -- analysis: the part the reader came for ---------------------------- */
.standing{font-size:clamp(1.15rem,2.6vw,1.4rem);line-height:1.55;color:var(--ink);max-width:60ch;margin:0;font-weight:400}
.finding{font-size:1.06rem;line-height:1.62;color:var(--ink);max-width:64ch;margin:0}
ul.points{list-style:none;margin:0;padding:0;display:grid;gap:1.1rem}
ul.points>li{position:relative;padding-left:1.6rem;max-width:64ch}
ul.points>li::before{content:"";position:absolute;left:0;top:.6em;width:.7rem;height:2px;background:var(--accent)}
ul.points>li>p{margin:0;font-size:1.02rem;line-height:1.62;color:var(--ink)}
ol.considers{list-style:none;counter-reset:c;margin:0;padding:0;display:grid;gap:1.4rem}
ol.considers>li{counter-increment:c;background:var(--surface);border:1px solid var(--rule);border-radius:var(--radius-lg);padding:1.3rem 1.4rem;position:relative}
ol.considers>li::before{content:counter(c);position:absolute;top:1.3rem;right:1.4rem;font-family:var(--font-accent);font-size:1.5rem;color:var(--rule);line-height:1}
ol.considers h3{font-size:1.05rem;font-weight:600;letter-spacing:var(--ls-tight);margin:0 0 .5rem;padding-right:2rem;color:var(--ink)}
ol.considers p{margin:0;font-size:.98rem;line-height:1.62;color:var(--ink-2);max-width:60ch}

/* -- evidence appendix: dense, secondary, checkable -------------------- */
.evidencesec{border-top:1px solid var(--rule);margin-top:3.25rem;padding-top:2.5rem}
.evgroup{margin-bottom:2rem}
.evgroup h3{font-family:var(--font-mono);font-size:.72rem;letter-spacing:var(--ls-wide);text-transform:uppercase;color:var(--muted);font-weight:500;margin:0 0 .9rem;padding-bottom:.5rem;border-bottom:1px solid var(--rule-soft)}
ul.evlist{list-style:none;margin:0;padding:0;display:grid;gap:.85rem}
li.ev{display:flex;gap:.75rem;align-items:flex-start}
.evid{font-family:var(--font-mono);font-size:.6rem;color:var(--muted);background:var(--bg-sunk);padding:.2rem .35rem;border-radius:2px;flex:none;margin-top:.15rem}
.evbody{min-width:0}
.evbody p{margin:0;font-size:.92rem;line-height:1.58;color:var(--ink-2)}
.evbody .when{margin-top:.35rem;font-size:.66rem}
.boundary{margin-top:3.25rem;background:var(--bg-deep);color:var(--on-deep);background-image:var(--dot-grid);background-size:var(--dot-step);border-radius:var(--radius-xl);padding:2.5rem 2rem}
.boundary .secnum{color:var(--on-deep-muted)}
.boundary h2{color:var(--on-deep)}
.boundary .intro{color:var(--on-deep-2)}
ul.unknowns{list-style:none;margin:1.75rem 0 0;padding:0;display:grid;gap:.1rem}
ul.unknowns li{display:flex;gap:.8rem;align-items:baseline;padding:.8rem 0;border-top:1px solid var(--primary-800);font-size:1rem;color:var(--on-deep)}
ul.unknowns li:last-child{border-bottom:1px solid var(--primary-800)}
.ublank{font-family:var(--font-mono);font-size:.9rem;color:var(--primary-200);border-bottom:2px solid var(--primary-400);min-width:3.5rem;flex:none}
.closing{margin-top:3.25rem;padding:2rem;border:1px solid var(--rule);border-radius:var(--radius-xl);background:var(--bg-sunk)}
.closing h2{font-size:1.25rem;font-weight:600;letter-spacing:var(--ls-tight);margin:0 0 .75rem}
.closing p{margin:0 0 1rem;font-size:1rem;line-height:1.62;color:var(--ink-2);max-width:58ch}
.cta{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:500;font-size:.95rem;text-decoration:none;padding:.7rem 1.3rem;border-radius:var(--radius-md);transition:background var(--dur-normal) var(--ease-out)}
.cta:hover{background:var(--accent-deep)}
.srcsec{margin-top:3.25rem;padding-top:2rem;border-top:1px solid var(--rule)}
.srcsec h2{font-family:var(--font-mono);font-size:.75rem;letter-spacing:var(--ls-widest);text-transform:uppercase;color:var(--muted);font-weight:500;margin:0 0 1.25rem}
ol.sources{list-style:none;margin:0;padding:0;display:grid;gap:.85rem}
ol.sources li{display:flex;gap:.75rem;align-items:flex-start;scroll-margin-top:1.5rem}
ol.sources li:target .srclabel{background:var(--accent-soft)}
.srcnum{font-family:var(--font-mono);font-size:.68rem;color:var(--accent-deep);background:var(--accent-soft);padding:.15rem .35rem;border-radius:2px;flex:none;min-width:1.6rem;text-align:center}
.srcbody{display:grid;gap:.2rem;min-width:0}
.srclabel{font-size:.88rem;color:var(--ink)}
.srcurl{font-family:var(--font-mono);font-size:.7rem;word-break:break-all;color:var(--accent)}
.srcret{font-family:var(--font-mono);font-size:.66rem;color:var(--muted)}
.colophon{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--rule-soft);font-family:var(--font-mono);font-size:.7rem;line-height:1.7;color:var(--muted)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media (max-width:640px){.boundary{padding:2rem 1.25rem;border-radius:var(--radius-lg)}.closing{padding:1.5rem}}
`;
