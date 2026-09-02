/* ---------------------------------------------------------------------------
   The research report — the long document, built to be printed.

   This is the second of the two outputs the offer now produces. The email says
   "build this" in three hundred words; this is everything behind it, arranged
   so a reviewer on our side can check every sentence before the email goes
   out, and so the lead, if we hand it over after the call, can see the work.

   THE SPINE IS THE CLAIM REGISTER. Every claim the pipeline validated appears
   in a table with its id, its statement, its source URL, the date we read it,
   and a status that says how we know it (read on the page; returned by a data
   API; found through a citation-backed search; our own inference). Every
   citation in the prose is the id, superscripted, so a finger can go from a
   sentence to a row to a URL. That is what "verifiable" means here and it is
   the whole reason this document exists next to the email.

   It adds no facts. The recommendation is stage 07's, the analysis is stage
   06's, the claims are stages 01-05's. Where stage 07 redacted a figure the
   marker is printed as-is, and the banner at the top says so: a reviewer must
   never be able to miss that the model reached for a number it could not
   source.

   PRINT FIRST. Letter, system serif, no web fonts, no colour that a laser
   printer would lose. The stylesheet is the one two hand-made specimens were
   printed with; the PDF is the artefact that goes to Slack.
--------------------------------------------------------------------------- */

import type { Claim, Coverage } from '../lib/claim.ts';
import type { RunMeta } from '../lib/run.ts';
import type { Synthesis } from '../stages/06-synthesis.ts';
import type { OneThingArtifact } from '../stages/07-one-thing.ts';
import { REDACTED } from '../stages/07-one-thing.ts';
import { esc } from './report-html.ts';
import type { EmailDraft } from './email-draft.ts';

export interface ResearchReportInput {
  meta: RunMeta;
  company: string;
  oneLiner?: string;
  claims: Claim[];
  coverage: Coverage;
  synthesis: Synthesis | null;
  oneThing: OneThingArtifact | null;
  emailDraft: EmailDraft | null;
  /** Skips and failures from the run, for the method section. */
  stageNotes?: string[];
  models?: { research?: string; synthesis?: string; oneThing?: string };
  cost?: { spent: number; ceiling: number };
  /** Named on the cover when known. */
  recipientName?: string;
}

/* -- helpers -------------------------------------------------------------- */

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** A derived one-liner arrives lower-case and unpunctuated; on a cover it is a sentence. */
function sentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

/** Quoted spans become real quotation marks. */
function curl(html: string): string {
  return html.replace(/&quot;((?:(?!&quot;).)*?)&quot;/g, '&ldquo;$1&rdquo;');
}

const ID_GROUP = /\(\s*([a-z0-9._-]+(?:\s*,\s*[a-z0-9._-]+)*)\s*\)/gi;

/**
 * Claim ids in prose become superscript references to register rows. The id
 * itself is shown rather than a number: the register is keyed by id, and a
 * reviewer reading "cmp-1" learns the tier from the prefix.
 */
export function refClaimIds(escaped: string, knownIds: readonly string[]): string {
  const ids = new Set(knownIds);
  const ref = (id: string) => `<a class="ref" href="#claim-${esc(id)}">${esc(id)}</a>`;
  let out = escaped.replace(ID_GROUP, (whole, inner) => {
    const parts = String(inner)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0 || !parts.every((x) => ids.has(x))) return whole;
    return parts.map(ref).join(' ');
  });
  for (const id of [...ids].sort((a, b) => b.length - a.length)) {
    if (!out.includes(id)) continue;
    /* Avoid re-linking inside a reference just made. */
    out = out.replace(new RegExp(`(?<![-"#>\\w])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![-\\w<])`, 'g'), ref(id));
  }
  return out.replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

function paras(text: string, prose: (t: string) => string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${prose(p)}</p>`)
    .join('');
}

/** How we know a claim, for the register. */
export function claimStatus(claim: Claim): { label: string; cls: string } {
  if (claim.tier === 'hypothesis') return { label: 'Ours', cls: 'ours' };
  if (claim.id.startsWith('dem-')) return { label: 'Tool data', cls: 'tool' };
  if (claim.tier === 'observed') return { label: 'Verified', cls: 'verified' };
  /* A comparative claim whose source sits on the peer's own domain was read
     there; one from a third party came through a citation-backed search. */
  const own =
    claim.sources.length > 0 &&
    claim.sources.every((s) => {
      try {
        const host = new URL(s.url).hostname.replace(/^www\./, '');
        const peer = (claim.peerName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return peer.length > 3 && host.replace(/[^a-z0-9]/g, '').includes(peer.slice(0, Math.min(peer.length, 8)));
      } catch {
        return false;
      }
    });
  return own ? { label: 'Verified', cls: 'verified' } : { label: 'Cited', cls: 'cited' };
}

function sourceCell(claim: Claim): string {
  if (claim.sources.length === 0) return '<span class="src">no source recorded</span>';
  return claim.sources
    .map((s) => {
      const label = s.title || s.publisher;
      return `<span class="src">${label ? `${esc(label)}<br>` : ''}<a href="${esc(s.url)}">${esc(s.url)}</a></span>`;
    })
    .join('<br>');
}

/* -- the document ------------------------------------------------------- */

export function renderResearchReport(input: ResearchReportInput): string {
  const { company, claims, synthesis } = input;
  const one = input.oneThing?.oneThing ?? null;
  const date = longDate(input.meta.startedAt);
  const ids = claims.map((c) => c.id);
  const prose = (t: string) => curl(refClaimIds(esc(t), ids));
  const byId = new Map(claims.map((c) => [c.id, c]));

  /* -- banner: anything a reviewer must not miss -- */
  const warnings: string[] = [];
  if (!one) warnings.push('Stage 07 did not run: there is no recommendation in this document, only the research.');
  if (input.oneThing && input.oneThing.redacted > 0) {
    warnings.push(
      `${input.oneThing.redacted} figure(s) were redacted as unsourced and appear as ${REDACTED}. Read those sentences before anything is sent.`
    );
  }
  if (input.oneThing && input.oneThing.problems.some((p) => p.code !== 'unsourced_numeral')) {
    warnings.push(
      `Validation left ${input.oneThing.problems.filter((p) => p.code !== 'unsourced_numeral').length} non-numeral problem(s): ` +
        input.oneThing.problems
          .filter((p) => p.code !== 'unsourced_numeral')
          .map((p) => `${p.field} ${p.code}`)
          .join('; ')
    );
  }
  if (input.emailDraft && input.emailDraft.unresolved.length > 0) {
    warnings.push(`The email cited ids with no claim behind them, removed: ${input.emailDraft.unresolved.join(', ')}.`);
  }
  if (!input.coverage.sufficient) {
    warnings.push(`Coverage is below the minimums (${input.coverage.shortfalls.join('; ')}). The evidence is thin; weigh the recommendation accordingly.`);
  }
  const banner = warnings.length
    ? `<div class="internal noprint-never"><strong>For the reviewer.</strong> ${warnings.map(esc).join(' ')}</div>`
    : '';

  /* -- the recommendation -- */
  const recommendation = one
    ? `<h2>The recommendation</h2>
  <div class="lead keep-together">
    <h3>${prose(one.headline)}</h3>
    ${paras(one.build, prose)}
  </div>
  <h2>Why this and not something else</h2>
  ${paras(one.whyNow, prose)}
  <h4>Why a design studio rather than a model</h4>
  ${paras(one.whyUs, prose)}
  <h4>The first two weeks</h4>
  ${paras(one.firstStep, prose)}
  <h2>What we would refuse to build</h2>
  <div class="stop keep-together">
    <h4>Do not build &nbsp;${prose(one.refuse.what)}</h4>
    ${paras(one.refuse.why, prose)}
  </div>
  <h2>The one thing we could not determine</h2>
  <div class="keep-together">
    ${paras(one.couldNotSee, prose)}
    <p class="rule-note">Nothing public distinguishes the branches above. It is the first question the call should settle, and it changes the sequencing rather than the destination.</p>
  </div>`
    : `<h2>The recommendation</h2><p class="rule-note">Not written. See the note for the reviewer above.</p>`;

  /* -- the field it was chosen from -- */
  const considered = synthesis?.opportunities.length
    ? `<h2>Considered, and not chosen</h2>
  <p class="rule-note">The ideas the analysis produced before one was picked. Shown so what we set aside is visible, with the evidence each rested on.</p>
  ${synthesis.opportunities
    .map(
      (o) => `<div class="keep-together considered">
      <h4>${esc(o.heading)}</h4>
      <p>${prose(o.body)}</p>
      <p class="rule-note">${prose(o.basis)}</p>
    </div>`
    )
    .join('')}`
    : '';

  const standing = synthesis?.standing
    ? `<h2>Where they stand, as we read it</h2>${paras(synthesis.standing, prose)}`
    : '';

  /* -- peers -- */
  const comparative = claims.filter((c) => c.tier === 'comparative' && !c.internalOnly);
  const peerRows = comparative
    .map(
      (c) => `<tr>
      <td>${esc(c.peerName ?? '')}</td>
      <td class="q">${curl(esc(c.statement))}</td>
      <td style="white-space:nowrap">${c.observedAt ? esc(c.observedAt.slice(0, 10)) : '<span class="src">undated</span>'}</td>
      <td class="id"><a href="#claim-${esc(c.id)}">${esc(c.id)}</a></td>
    </tr>`
    )
    .join('');
  const peers = `<h2>What comparable companies have done</h2>
  ${synthesis?.competitorSignal.point ? paras(synthesis.competitorSignal.point, prose) : ''}
  ${
    comparative.length
      ? `<table><thead><tr><th>Company</th><th>What we found</th><th>Dated</th><th>Claim</th></tr></thead><tbody>${peerRows}</tbody>
    <caption>${input.coverage.peersIdentified} comparable companies identified; ${input.coverage.peersWithDatedAiEvidence} produced dated, sourced evidence of an AI move. Absence of public evidence means we could not see it from outside, and is recorded as exactly that.</caption></table>`
      : `<p class="rule-note">No dated, sourced AI move was found at any comparable company. That is a finding about public evidence, not about the companies.</p>`
  }`;

  /* -- questions -- */
  const questions = synthesis?.questions.length
    ? `<h2>Questions for the call</h2>
  <ol>${synthesis.questions
    .map((q) => `<li class="keep-together"><strong>${prose(q.question)}</strong><br><span class="rule-note">${prose(q.why)}</span></li>`)
    .join('')}</ol>`
    : '';

  /* -- could not see -- */
  const blind = synthesis?.blindSpots.length
    ? `<h2>Where this is most likely to be wrong</h2><ul>${synthesis.blindSpots.map((b) => `<li>${prose(b)}</li>`).join('')}</ul>`
    : '';

  /* -- the register -- */
  const shown = claims.filter((c) => !c.internalOnly);
  const signals = claims.filter((c) => c.internalOnly);
  const row = (c: Claim) => {
    const st = claimStatus(c);
    return `<tr id="claim-${esc(c.id)}">
      <td class="id">${esc(c.id)}</td>
      <td class="q">${c.peerName ? `<strong>${esc(c.peerName)}</strong> ` : ''}${curl(esc(c.statement))}</td>
      <td>${sourceCell(c)}</td>
      <td class="src">${esc((c.sources[0]?.retrievedAt ?? c.observedAt ?? '').slice(0, 10))}</td>
      <td><span class="pill pill--${st.cls}">${st.label}</span></td>
    </tr>`;
  };
  const register = `<h2>Claim register</h2>
  <p class="rule-note"><strong>Verified</strong> means read on the page that publishes it. <strong>Cited</strong> means found through a citation-backed search and attributed to the page the citation named. <strong>Tool data</strong> means returned by a paid data API, with the pull date. <strong>Ours</strong> means our own inference, carrying declared blanks rather than figures.</p>
  <table class="reg"><thead><tr><th>ID</th><th>Claim</th><th>Source</th><th>Read</th><th>Status</th></tr></thead>
  <tbody>${shown.map(row).join('')}</tbody></table>
  ${
    signals.length
      ? `<h4>Research signals, not for the client</h4>
  <p class="rule-note">Careers pages and the like. They tell us which workflow is under strain and informed the analysis; quoting them back at a company reads as filler, so they are not in the email and should not be in anything handed over.</p>
  <table class="reg"><thead><tr><th>ID</th><th>Claim</th><th>Source</th><th>Read</th><th>Status</th></tr></thead>
  <tbody>${signals.map(row).join('')}</tbody></table>`
      : ''
  }`;

  /* -- method -- */
  const ran = (input.stageNotes ?? []).filter(Boolean);
  const cov = input.coverage;
  const method = `<h2>Method</h2>
  <p>Public sources only. No contact with the company, no non-public information, no inferred figures. Research carried out ${esc(date)} with four data tools and one model, each doing a distinct job.</p>
  <table><thead><tr><th>Tool</th><th>Job</th><th>What it did on this run</th></tr></thead><tbody>
    <tr><td>Firecrawl</td><td>Read pages in full</td><td>${cov.pagesCrawled} page(s) of ${esc(input.meta.domain)} read with content. Every quotation from their own site comes from here.</td></tr>
    <tr><td>Exa</td><td>Find comparable companies</td><td>${cov.peersIdentified} comparable company(ies) kept after the category and geography filters.</td></tr>
    <tr><td>Perplexity</td><td>Find dated facts with citations</td><td>${cov.peersWithDatedAiEvidence} peer(s) with a dated, cited AI move that survived the attribution, date and citation gates. Summaries are never quoted; only the cited page is.</td></tr>
    <tr><td>DataForSEO</td><td>Demand-side data</td><td>${claims.filter((c) => c.id.startsWith('dem-')).length} demand claim(s), each stamped with the pull date.</td></tr>
    <tr><td>Claude</td><td>Analysis and the recommendation</td><td>${esc(input.models?.synthesis ?? 'model')} wrote the analysis${input.models?.oneThing ? ` and ${esc(input.models.oneThing)} chose the one thing` : ''}, seeing only the validated claims${input.models?.research ? '. A separate web-search pass informed judgement and is not citable' : ''}.</td></tr>
  </tbody></table>
  ${ran.length ? `<h4>Notes from the run</h4><ul>${ran.map((n) => `<li class="rule-note">${esc(n)}</li>`).join('')}</ul>` : ''}
  <h4>Rules this report follows</h4>
  <ul>
    <li><strong>No invented numbers.</strong> Every numeral in the recommendation and the email is checked against the claims it cites. A figure that fails is redacted, never repaired, and the redaction is printed.</li>
    <li><strong>Claims stay attributed.</strong> A company's own figures are described as its own. Competitor facts are as the cited page states them.</li>
    <li><strong>Absences are marked.</strong> Something we searched for and did not find is written as "we could not see", never as "they do not have".</li>
    <li><strong>What we set aside is shown.</strong> The ideas not chosen are in this report and out of the email.</li>
  </ul>
  <h4>What a reviewer should check first</h4>
  <ol>
    ${
      one
        ? `<li>The claims the recommendation rests on: ${one.claimIds
            .filter((id) => byId.has(id))
            .map((id) => `<a class="ref" href="#claim-${esc(id)}">${esc(id)}</a>`)
            .join(' ')}. Open the sources. The whole argument rests on them being real and current.</li>
    <li>The fork. Nothing public can settle it and the sequencing depends on it; it is the first question on the call.</li>
    <li>The refusal. A lot of people will tell them the opposite this year. Make sure we can defend it out loud.</li>`
        : ''
    }
    ${cov.peersWithDatedAiEvidence === 0 ? '<li>No comparable company produced dated AI evidence. Treat "none found" as exactly that.</li>' : ''}
  </ol>`;

  /* -- the email, as drafted -- */
  const email = input.emailDraft
    ? `<h2 class="page--break">The email, as drafted</h2>
  <p class="rule-note">Footnote numbers map to the sources listed beneath the draft. A person edits this before it is sent; nothing goes to the recipient automatically.</p>
  <pre class="mail">${esc(input.emailDraft.text)}</pre>`
    : '';

  const sourceCount = new Set(claims.flatMap((c) => c.sources.map((s) => s.url))).size;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(company)} — Research report</title>
<style>${STYLES}</style>
</head>
<body>
${banner}
<div class="page">
  <div class="banner">
    <p class="eyebrow">SeeSaw Labs &middot; Research report &middot; ${esc(date)}</p>
    <h1>${esc(company)}: the one thing we would build</h1>
    <p class="sub">${input.oneLiner ? `${esc(sentence(input.oneLiner))} ` : ''}Prepared from public evidence only${input.recipientName ? `, for ${esc(input.recipientName)}` : ''}. Every claim carries an identifier; the accompanying email is footnoted to those identifiers so each sentence can be checked against its source.</p>
  </div>
  ${recommendation}
  ${standing}
  ${peers}
  ${considered}
  ${questions}
  ${blind}
  ${register}
  ${method}
  ${email}
  <p class="foot">
    Prepared by SeeSaw Labs, ${esc(date)}, from public evidence. ${claims.length} claims, ${sourceCount} distinct sources${
      input.cost ? `, research spend $${input.cost.spent.toFixed(2)} of a $${input.cost.ceiling.toFixed(2)} ceiling` : ''
    }. Run ${esc(input.meta.runId)} on ${esc(input.meta.domain)}. Research assisted by AI tooling; the recommendation, the exclusions and the register are read by a person before anything is sent. Questions to calvin@seesawlabs.com.
  </p>
</div>
</body>
</html>
`;
}

/* The print stylesheet the two hand-made specimens were printed with. */
const STYLES = `
  @page { size: Letter; margin: 20mm 18mm 18mm; }
  :root {
    --ink: #14181a; --ink-2: #454f52; --ink-3: #6d787a;
    --rule: #cfd6d4; --rule-2: #e6eae8;
    --hi: #f3ece0; --hi-ru: #c9a55f; --stop: #8f3418; --ship: #1d6b4f;
    --serif: Georgia, "Times New Roman", Times, serif;
    --sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
    --mono: "SF Mono", Menlo, Consolas, "Courier New", monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: var(--ink); font-family: var(--serif); font-size: 10.5pt; line-height: 1.5; }
  .page { max-width: 176mm; margin-inline: auto; padding: 0 0 14mm; }
  @media screen { body { padding: 12mm 6mm; } }
  @media print { .page--break { break-before: page; } }
  table, .lead, .stop, .considered { break-inside: avoid; }
  .reg { break-inside: auto; }
  .reg thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .keep-together { break-inside: avoid; }
  h2, h3, h4 { break-after: avoid; }
  p, li { orphans: 2; widows: 2; }

  .internal { max-width: 176mm; margin: 0 auto 8mm; padding: 3mm 4mm; border: 1px solid var(--stop); border-left-width: 4px; font-family: var(--sans); font-size: 9pt; color: var(--stop); break-inside: avoid; }

  .banner { border-top: 3px solid var(--ink); padding-top: 5mm; margin-bottom: 8mm; }
  .eyebrow { font-family: var(--sans); font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 3mm; }
  h1 { font-family: var(--serif); font-size: 24pt; line-height: 1.12; margin: 0 0 4mm; font-weight: normal; letter-spacing: -.01em; }
  .sub { font-size: 11.5pt; color: var(--ink-2); margin: 0; }
  h2 { font-family: var(--sans); font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); margin: 9mm 0 3mm; padding-bottom: 2mm; border-bottom: 1px solid var(--rule); }
  h3 { font-size: 13pt; font-weight: normal; margin: 0 0 2.5mm; line-height: 1.25; }
  h4 { font-family: var(--sans); font-size: 9.5pt; margin: 5mm 0 2mm; }
  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1.5mm; }
  a { color: inherit; }
  .ref { font-family: var(--mono); font-size: 6.5pt; vertical-align: super; color: var(--stop); text-decoration: none; letter-spacing: .02em; margin-left: .2mm; white-space: nowrap; }
  .lead { background: var(--hi); border-left: 3px solid var(--hi-ru); padding: 4mm 5mm; margin: 0 0 5mm; }
  .lead p:last-child { margin-bottom: 0; }
  .stop { border: 1px solid var(--stop); border-left-width: 3px; padding: 4mm 5mm; margin: 0 0 4mm; }
  .stop h4 { margin-top: 0; color: var(--stop); }
  .stop p:last-child { margin-bottom: 0; }
  .considered { margin-bottom: 3mm; }
  .considered h4 { margin-top: 3mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 0 0 4mm; }
  caption { caption-side: bottom; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); text-align: left; padding-top: 2mm; line-height: 1.4; }
  th, td { text-align: left; padding: 1.6mm 2mm; border-bottom: 1px solid var(--rule-2); vertical-align: top; }
  th { font-family: var(--sans); font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); border-bottom: 1px solid var(--rule); }
  .pill { font-family: var(--sans); font-size: 6.5pt; letter-spacing: .08em; text-transform: uppercase; padding: .6mm 1.4mm; border: 1px solid var(--rule); white-space: nowrap; }
  .pill--verified { color: var(--ship); border-color: var(--ship); }
  .pill--cited { color: var(--hi-ru); border-color: var(--hi-ru); }
  .pill--tool { color: var(--ink-2); }
  .pill--ours { color: var(--stop); border-color: var(--stop); }
  .reg { font-size: 8.5pt; table-layout: fixed; }
  .reg td, .reg th { padding: 1.4mm 2mm; }
  .reg th:nth-child(1) { width: 15%; }
  .reg th:nth-child(2) { width: 41%; }
  .reg th:nth-child(3) { width: 26%; }
  .reg th:nth-child(4) { width: 9%; }
  .reg th:nth-child(5) { width: 9%; }
  .reg td:nth-child(4) { white-space: nowrap; }
  .q { font-style: normal; }
  .src { font-family: var(--mono); font-size: 7pt; color: var(--ink-2); overflow-wrap: anywhere; word-break: break-word; }
  .id { overflow-wrap: anywhere; }
  .src a { text-decoration: none; }
  .id { font-family: var(--mono); font-size: 7.5pt; white-space: nowrap; }
  .id a { text-decoration: none; }
  .rule-note { font-size: 9pt; color: var(--ink-2); }
  .mail { white-space: pre-wrap; font-family: var(--serif); font-size: 10pt; line-height: 1.5; background: #fafaf8; border: 1px solid var(--rule-2); padding: 4mm 5mm; margin: 0 0 4mm; }
  .foot { font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); line-height: 1.5; border-top: 1px solid var(--rule); padding-top: 3mm; margin-top: 6mm; }
`;
