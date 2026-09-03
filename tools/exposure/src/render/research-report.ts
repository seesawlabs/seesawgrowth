/* ---------------------------------------------------------------------------
   The research report — the long document, built to be printed.

   This is the second of the two outputs the offer produces. The email says
   "build this" in three hundred words; this is everything behind it, arranged
   so a reviewer on our side can check every sentence before the email goes
   out, and so the lead, if we hand it over after the call, can see the work.

   THE SPINE IS THE CLAIM REGISTER. Every claim the pipeline validated appears
   in a table with its id, its statement, its source URL, the date we read it,
   whether the URL was still live when this report was printed, and a status
   that says how we know it. Every citation in the prose is the id,
   superscripted, so a finger can go from a sentence to a row to a URL.

   FIVE THINGS THIS DOCUMENT NOW MAKES UNMISSABLE (review of 2026-09-02):
     1. Which claims are call material rather than email material, and whether
        the email draft leaked any (banner, plus a section of its own).
     2. Who each comparable company sells to, and whether that buyer overlaps
        the target's, on every competitor row.
     3. Whether each cited page was reachable at print time, with a thumbnail.
     4. The fork, on the first page, with a stated difference between branches,
        or an admission that none was found.
     5. The null verdict, rendered with the same rigour as a recommendation.

   It adds no facts. Where stage 07 redacted a figure the marker is printed
   as-is, and the banner says so.

   PRINT FIRST. Letter, system serif, no web fonts. The PDF is the artefact
   that goes to Slack.
--------------------------------------------------------------------------- */

import type { Claim, Coverage } from '../lib/claim.ts';
import type { RunMeta } from '../lib/run.ts';
import { claimStatus, isOutboundSafe, callMaterialReason } from '../lib/claim-status.ts';
import type { SourceCheck } from '../lib/liveness.ts';
import type { Synthesis } from '../stages/06-synthesis.ts';
import type { OneThingArtifact, PeerFit } from '../stages/07-one-thing.ts';
import { REDACTED, chosen, citedIn, isNull } from '../stages/07-one-thing.ts';
import { esc } from './report-html.ts';
import type { EmailDraft } from './email-draft.ts';

export { claimStatus } from '../lib/claim-status.ts';

export interface ResearchReportInput {
  meta: RunMeta;
  company: string;
  oneLiner?: string;
  claims: Claim[];
  coverage: Coverage;
  synthesis: Synthesis | null;
  oneThing: OneThingArtifact | null;
  emailDraft: EmailDraft | null;
  /** Liveness of every cited URL at print time. */
  sources?: SourceCheck[];
  /** Screenshot data URIs keyed by source URL. */
  screenshots?: Record<string, string>;
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

function sourceCell(claim: Claim): string {
  if (claim.sources.length === 0) return '<span class="src">no source recorded</span>';
  return claim.sources
    .map((s) => {
      const label = s.title || s.publisher;
      return `<span class="src">${label ? `${esc(label)}<br>` : ''}<a href="${esc(s.url)}">${esc(s.url)}</a></span>`;
    })
    .join('<br>');
}

const normName = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function liveCell(claim: Claim, byUrl: Map<string, SourceCheck>): string {
  const checks = claim.sources.map((s) => byUrl.get(s.url)).filter((x): x is SourceCheck => Boolean(x));
  if (checks.length === 0) return '<span class="src">not checked</span>';
  return checks
    .map((c) => {
      if (c.kind === 'api') return `<span class="pill pill--tool">API</span>`;
      if (c.ok) return `<span class="pill pill--verified">${c.status}${c.finalUrl ? ' &rarr;' : ''}</span>`;
      return `<span class="pill pill--ours">${c.status ?? 'error'}</span>`;
    })
    .join(' ');
}

/* -- the document ------------------------------------------------------- */

export function renderResearchReport(input: ResearchReportInput): string {
  const { company, claims, synthesis } = input;
  const one = input.oneThing?.oneThing ?? null;
  const date = longDate(input.meta.startedAt);
  const ids = claims.map((c) => c.id);
  const prose = (t: string) => curl(refClaimIds(esc(t), ids));
  const byId = new Map(claims.map((c) => [c.id, c]));
  const byUrl = new Map((input.sources ?? []).map((s) => [s.url, s]));
  const nul = one ? isNull(one) : false;
  const pick = one ? chosen(one) : null;

  /* -- banner: anything a reviewer must not miss -- */
  const warnings: string[] = [];
  if (!one) warnings.push('Stage 07 did not run: there is no recommendation in this document, only the research.');
  if (one && nul) warnings.push('VERDICT: nothing worth a call. This report says why, with the same evidence standard. The email is the honest-no version.');
  if (input.oneThing && input.oneThing.redacted > 0) {
    warnings.push(
      `${input.oneThing.redacted} figure(s) were redacted as unsourced and appear as ${REDACTED}. Read those sentences before anything is sent.`
    );
  }
  const leaked = input.emailDraft?.callMaterial ?? input.oneThing?.callMaterialInEmail ?? [];
  if (leaked.length > 0) {
    warnings.push(
      `The email cites ${leaked.length} claim(s) that are not Verified (${leaked.join(', ')}). They are marked † in the draft. Cut the sentence or move it to the call.`
    );
  }
  if (one && !nul && !one.fork.found) warnings.push('No fork was found: the recommendation does not change under any public unknown. The report says so on the first page.');
  const otherProblems = (input.oneThing?.problems ?? []).filter((p) => p.code !== 'unsourced_numeral' && p.code !== 'non_verified_in_email');
  if (otherProblems.length > 0) {
    warnings.push(`Validation left ${otherProblems.length} problem(s): ${otherProblems.map((p) => `${p.field} ${p.code}`).join('; ')}.`);
  }
  if (input.emailDraft && input.emailDraft.unresolved.length > 0) {
    warnings.push(`The email cited ids with no claim behind them, removed: ${input.emailDraft.unresolved.join(', ')}.`);
  }
  const deadSources = (input.sources ?? []).filter((s) => s.kind === 'page' && !s.ok);
  if (deadSources.length > 0) {
    warnings.push(`${deadSources.length} cited page(s) were not reachable at print time; see the Live column and the sources appendix.`);
  }
  if (!input.coverage.sufficient) {
    warnings.push(`Coverage is below the minimums (${input.coverage.shortfalls.join('; ')}). The evidence is thin; weigh the verdict accordingly.`);
  }
  const banner = warnings.length
    ? `<div class="internal"><strong>For the reviewer.</strong> ${warnings.map(esc).join(' ')}</div>`
    : '';

  /* -- the fork, first page -- */
  const forkBlock = (() => {
    if (!one || nul) return '';
    const f = one.fork;
    if (!f.found) {
      return `<h2>The question that would change this</h2>
  <div class="stop keep-together">
    <h4>No fork found</h4>
    ${paras(f.whyNone || 'The recommendation does not change under any unknown we could name.', prose)}
    <p class="rule-note">Read this as a claim to test on the call, not as comfort. If the owner names an unknown that would change the build, the recommendation was under-researched.</p>
  </div>`;
    }
    return `<h2>The question that decides it</h2>
  <div class="lead keep-together fork">
    <h3>${prose(f.question)}</h3>
    <div class="fork__branches">
      <div><p class="fork__lab">If yes</p>${paras(f.ifYes, prose)}</div>
      <div><p class="fork__lab">If no</p>${paras(f.ifNo, prose)}</div>
    </div>
    <p class="fork__changes"><strong>What differs:</strong> ${prose(f.whatChanges)}</p>
  </div>`;
  })();

  /* -- the recommendation, or the null verdict -- */
  const recommendation = (() => {
    if (!one) return `<h2>The recommendation</h2><p class="rule-note">Not written. See the note for the reviewer above.</p>`;
    if (nul) {
      const n = one.nullResult;
      return `<h2>Our verdict</h2>
  <div class="lead keep-together">
    <h3>Nothing here is worth a build this year.</h3>
    ${n ? paras(n.whatWeLookedAt, prose) : '<p class="rule-note">The null result was not filled in.</p>'}
  </div>
  ${
    n && n.whatWeSetAside.length
      ? `<h2>What we set aside, and why</h2><ol>${n.whatWeSetAside.map((t) => `<li>${prose(t)}</li>`).join('')}</ol>`
      : ''
  }
  ${n?.oneQuestion ? `<h2>The one question we would still ask</h2><div class="lead keep-together"><h3>${prose(n.oneQuestion)}</h3><p class="rule-note">Its answer could reopen the verdict. Nothing else we found could.</p></div>` : ''}
  ${
    one.refuse.what
      ? `<h2>What we would refuse to build</h2>
  <div class="stop keep-together">
    <h4>Do not build &nbsp;${prose(one.refuse.what)}</h4>
    ${paras(one.refuse.why, prose)}
  </div>`
      : ''
  }`;
    }
    return `<h2>The recommendation</h2>
  <div class="lead keep-together">
    <h3>${prose(pick!.headline)}</h3>
    ${paras(pick!.build, prose)}
  </div>
  ${forkBlock}
  <h2>Why this one</h2>
  ${paras(one.pick.why, prose)}
  <h4>Why now</h4>
  ${paras(pick!.whyNow, prose)}
  <h4>Why a design studio rather than a model</h4>
  ${paras(one.whyUs, prose)}
  <h4>The first two weeks</h4>
  ${paras(one.firstStep, prose)}
  <h2>What we would refuse to build</h2>
  <div class="stop keep-together">
    <h4>Do not build &nbsp;${prose(one.refuse.what)}</h4>
    ${paras(one.refuse.why, prose)}
  </div>`;
  })();

  /* -- call material: what the recommendation rests on that cannot go in an email -- */
  const callMaterial = (() => {
    if (!one) return '';
    const texts = [pick?.whyNow ?? '', one.pick.why, one.refuse.why, one.fork.ifYes, one.fork.ifNo, one.fork.whatChanges, one.nullResult?.whatWeLookedAt ?? '', ...(one.nullResult?.whatWeSetAside ?? [])];
    const used = new Set<string>([...(pick?.claimIds ?? []), ...one.refuse.claimIds]);
    for (const t of texts) for (const id of citedIn(t, ids)) used.add(id);
    const rows = [...used]
      .map((id) => byId.get(id))
      .filter((c): c is Claim => Boolean(c) && !isOutboundSafe(c!));
    if (rows.length === 0) {
      return `<h2>For the call, not the email</h2><p class="rule-note">Every claim the recommendation rests on is Verified: read on the page that publishes it. Nothing here needs a caveat spoken aloud.</p>`;
    }
    return `<h2>For the call, not the email</h2>
  <p class="rule-note">These claims carry the argument but were not read on the page that publishes them, or are a vendor’s figure, or are ours. They are said aloud on the call with how we know them, and they do not go in writing to the client.</p>
  <table><thead><tr><th>Claim</th><th>Status</th><th>Say it with</th></tr></thead><tbody>
  ${rows
    .map(
      (c) => `<tr><td class="q">${c.peerName ? `<strong>${esc(c.peerName)}</strong> ` : ''}${curl(esc(c.statement))} <a class="ref" href="#claim-${esc(c.id)}">${esc(c.id)}</a></td>
      <td><span class="pill pill--${claimStatus(c).cls}">${claimStatus(c).label}</span></td>
      <td class="rule-note">${esc(callMaterialReason(c))}</td></tr>`
    )
    .join('')}
  </tbody></table>`;
  })();

  /* -- the field it was chosen from -- */
  const considered =
    one && one.ideas.length
      ? `<h2>${nul ? 'The ideas we weighed and set aside' : 'The ideas we weighed'}</h2>
  <p class="rule-note">Every candidate, with its own evidence, what one engagement would ship, and what would make it the wrong build.${nul ? '' : ' The recommended one is marked. A reader who would have picked differently can see which judgement they disagree with.'}</p>
  ${one.ideas
    .map(
      (idea, i) => `<div class="keep-together idea${idea === pick ? ' idea--pick' : ''}">
      <h4>${i + 1}. ${prose(idea.headline)}${idea === pick ? ' <span class="pill pill--verified">Recommended</span>' : ''}</h4>
      ${paras(idea.build, prose)}
      <p><strong>Why now.</strong> ${prose(idea.whyNow)}</p>
      <p><strong>One engagement ships.</strong> ${prose(idea.feasibility)}</p>
      <p class="rule-note"><strong>What would make it wrong.</strong> ${prose(idea.risk)}</p>
    </div>`
    )
    .join('')}`
      : '';

  const standing = synthesis?.standing ? `<h2>Where they stand, as we read it</h2>${paras(synthesis.standing, prose)}` : '';

  /* -- peers, with buyer fit -- */
  const fitByPeer = new Map<string, PeerFit>();
  for (const f of one?.peerFit ?? []) fitByPeer.set(normName(f.peer), f);
  const overlapPill = (f?: PeerFit) => {
    if (!f) return '<span class="pill pill--tool">not assessed</span>';
    const cls = f.overlap === 'yes' ? 'ours' : f.overlap === 'partial' ? 'cited' : f.overlap === 'no' ? 'verified' : 'tool';
    return `<span class="pill pill--${cls}">${esc(f.overlap)}</span>`;
  };
  const comparative = claims.filter((c) => c.tier === 'comparative' && !c.internalOnly);
  const peerRows = comparative
    .map((c) => {
      const fit = fitByPeer.get(normName(c.peerName ?? ''));
      return `<tr>
      <td><strong>${esc(c.peerName ?? '')}</strong></td>
      <td class="q">${curl(esc(c.statement))}<br><span class="src">${c.observedAt ? esc(c.observedAt.slice(0, 10)) : 'undated'} · <a href="#claim-${esc(c.id)}">${esc(c.id)}</a> · ${claimStatus(c).label}</span></td>
      <td>${fit ? prose(fit.sellsTo) : '<span class="src">unknown</span>'}</td>
      <td>${overlapPill(fit)}${fit?.why ? `<br><span class="src">${prose(fit.why)}</span>` : ''}</td>
    </tr>`;
    })
    .join('');
  const unmatchedFit = (one?.peerFit ?? []).filter((f) => !comparative.some((c) => normName(c.peerName ?? '') === normName(f.peer)));
  const peers = `<h2>What comparable companies have done, and who they sell to</h2>
  ${synthesis?.competitorSignal.point ? paras(synthesis.competitorSignal.point, prose) : ''}
  ${
    comparative.length
      ? `<table class="peers"><thead><tr><th>Company</th><th>What we found</th><th>Sells to</th><th>Buyer overlap</th></tr></thead><tbody>${peerRows}</tbody>
    <caption>${input.coverage.peersIdentified} comparable companies identified; ${input.coverage.peersWithDatedAiEvidence} produced dated, sourced evidence of an AI move. <strong>Buyer overlap</strong> is our judgement of whether their customer is this company’s customer; a shipped product at a company that sells to a different buyer is context, not a threat. Absence of public evidence means we could not see it from outside.</caption></table>`
      : `<p class="rule-note">No dated, sourced AI move was found at any comparable company. That is a finding about public evidence, not about the companies.</p>`
  }
  ${
    unmatchedFit.length
      ? `<p class="rule-note">Also assessed, without a dated claim: ${unmatchedFit.map((f) => `<strong>${esc(f.peer)}</strong> sells to ${prose(f.sellsTo)} (overlap ${esc(f.overlap)})`).join('; ')}.</p>`
      : ''
  }`;

  /* -- questions -- */
  const questions = synthesis?.questions.length
    ? `<h2>Questions for the call</h2>
  <ol>${synthesis.questions
    .map((q) => `<li class="keep-together"><strong>${prose(q.question)}</strong><br><span class="rule-note">${prose(q.why)}</span></li>`)
    .join('')}</ol>`
    : '';

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
      <td>${liveCell(c, byUrl)}</td>
      <td><span class="pill pill--${st.cls}">${st.label}</span></td>
    </tr>`;
  };
  const checkedAt = input.sources?.[0]?.checkedAt?.slice(0, 10);
  const register = `<h2>Claim register</h2>
  <p class="rule-note"><strong>Verified</strong> means read on the page that publishes it, and is the only status the email may cite. <strong>Cited</strong> means found through a citation-backed search and attributed to the page the citation named. <strong>Tool data</strong> means returned by a paid data API, with the pull date. <strong>Ours</strong> means our own inference, carrying declared blanks rather than figures. <strong>Live</strong> is the HTTP status of the source URL when this report was printed${checkedAt ? ` (${esc(checkedAt)})` : ''}; a thumbnail of each page is in the appendix.</p>
  <table class="reg"><thead><tr><th>ID</th><th>Claim</th><th>Source</th><th>Read</th><th>Live</th><th>Status</th></tr></thead>
  <tbody>${shown.map(row).join('')}</tbody></table>
  ${
    signals.length
      ? `<h4>Research signals, not for the client</h4>
  <p class="rule-note">Careers pages and the like. They tell us which workflow is under strain and informed the analysis; quoting them back at a company reads as filler, so they are not in the email and should not be in anything handed over.</p>
  <table class="reg"><thead><tr><th>ID</th><th>Claim</th><th>Source</th><th>Read</th><th>Live</th><th>Status</th></tr></thead>
  <tbody>${signals.map(row).join('')}</tbody></table>`
      : ''
  }`;

  /* -- sources appendix: thumbnails -- */
  const shots = (input.sources ?? []).filter((s) => s.kind === 'page');
  const appendix = shots.length
    ? `<h2 class="page--break">Sources as they looked at print time</h2>
  <p class="rule-note">Each cited page, fetched ${checkedAt ? esc(checkedAt) : 'at print time'}. The status is the server’s answer; the picture is what a visitor would have seen. A page that has changed or gone is a claim to re-check before the call.</p>
  <div class="shots">
  ${shots
    .map((s, i) => {
      const uri = input.screenshots?.[s.url];
      const claimIds = shown.filter((c) => c.sources.some((x) => x.url === s.url)).map((c) => c.id);
      return `<figure class="shot">
      ${uri ? `<img src="${uri}" alt="">` : `<div class="shot__none">${s.status === null ? 'not reachable' : 'no screenshot'}</div>`}
      <figcaption><span class="pill pill--${s.ok ? 'verified' : 'ours'}">${s.status ?? 'error'}</span> <a href="${esc(s.url)}">${esc(s.url)}</a>${s.finalUrl ? `<br>&rarr; ${esc(s.finalUrl)}` : ''}${s.error ? `<br>${esc(s.error)}` : ''}<br>${claimIds.map((id) => `<a class="ref" href="#claim-${esc(id)}">${esc(id)}</a>`).join(' ')}</figcaption>
    </figure>`;
    })
    .join('')}
  </div>`
    : '';

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
    <tr><td>Claude</td><td>Analysis and the verdict</td><td>${esc(input.models?.synthesis ?? 'model')} wrote the analysis${input.models?.oneThing ? ` and ${esc(input.models.oneThing)} weighed the ideas and gave the verdict` : ''}, seeing only the validated claims${input.models?.research ? '. A separate web-search pass informed judgement and is not citable' : ''}.</td></tr>
    <tr><td>Liveness</td><td>Re-fetch every cited URL</td><td>${input.sources?.length ? esc(summarise(input.sources)) : 'not run'}.</td></tr>
  </tbody></table>
  ${ran.length ? `<h4>Notes from the run</h4><ul>${ran.map((n) => `<li class="rule-note">${esc(n)}</li>`).join('')}</ul>` : ''}
  <h4>Rules this report follows</h4>
  <ul>
    <li><strong>No invented numbers.</strong> Every numeral in the recommendation and the email is checked against the claims it cites. A figure that fails is redacted, never repaired, and the redaction is printed.</li>
    <li><strong>Outbound draws on Verified claims only.</strong> The email may cite what we read on the publishing page. Cited and Tool-data claims are call material; Ours never leaves unspoken.</li>
    <li><strong>Claims stay attributed.</strong> A company's own figures are described as its own. Competitor facts are as the cited page states them, with who they sell to beside them.</li>
    <li><strong>Absences are marked.</strong> Something we searched for and did not find is written as "we could not see", never as "they do not have".</li>
    <li><strong>The fork must fork.</strong> A question counts only if the build differs by answer. Otherwise the report says no fork was found.</li>
    <li><strong>No is an answer.</strong> When nothing clears the bar, the verdict says so, with what we looked at and what we set aside.</li>
  </ul>
  <h4>What a reviewer should check first</h4>
  <ol>
    ${
      one && !nul
        ? `<li>The claims the recommendation rests on: ${(pick?.claimIds ?? [])
            .filter((id) => byId.has(id))
            .map((id) => `<a class="ref" href="#claim-${esc(id)}">${esc(id)}</a>`)
            .join(' ')}. The Live column says whether the pages are still there; the appendix shows them.</li>
    <li>The fork, on the first page. ${one.fork.found ? 'Do the two branches name different builds? If not, send it back.' : 'None was found. Would the owner name one?'}</li>
    <li>The buyer-overlap column. Any peer marked yes is a real threat; any marked no or partial must not be described as one in the email.</li>
    <li>The refusal. A lot of people will tell them the opposite this year. Make sure we can defend it out loud.</li>`
        : one && nul
          ? `<li>The verdict. Is "nothing worth a build" the honest read of the register, or did the model give up on thin evidence?</li>
    <li>What we set aside. Each item should name why it fails, not just that it does.</li>
    <li>The one question. Could its answer really reopen this?</li>`
          : ''
    }
    ${leaked.length ? `<li>The † footnotes in the email draft. They cite non-Verified claims and cannot be sent as written.</li>` : ''}
    ${cov.peersWithDatedAiEvidence === 0 ? '<li>No comparable company produced dated AI evidence. Treat "none found" as exactly that.</li>' : ''}
  </ol>`;

  /* -- the email, as drafted -- */
  const email = input.emailDraft
    ? `<h2 class="page--break">The email, as drafted</h2>
  <p class="rule-note">Footnote numbers map to the sources listed beneath the draft. A dagger marks a footnote that cites a non-Verified claim: that sentence is call material and must not be sent as written. A person edits this before it is sent; nothing goes to the recipient automatically.</p>
  <pre class="mail">${esc(input.emailDraft.text)}</pre>`
    : '';

  const sourceCount = new Set(claims.flatMap((c) => c.sources.map((s) => s.url))).size;
  const title = nul ? `${company}: nothing worth a build this year` : `${company}: the one thing we would build`;

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
    <h1>${esc(title)}</h1>
    <p class="sub">${input.oneLiner ? `${esc(sentence(input.oneLiner))} ` : ''}Prepared from public evidence only${input.recipientName ? `, for ${esc(input.recipientName)}` : ''}. Every claim carries an identifier and a status; the accompanying email cites Verified claims only, footnoted to those identifiers, so each sentence can be checked against its source.</p>
  </div>
  ${recommendation}
  ${callMaterial}
  ${standing}
  ${peers}
  ${considered}
  ${questions}
  ${blind}
  ${register}
  ${method}
  ${appendix}
  ${email}
  <p class="foot">
    Prepared by SeeSaw Labs, ${esc(date)}, from public evidence. ${claims.length} claims, ${sourceCount} distinct sources${
      input.cost ? `, research spend $${input.cost.spent.toFixed(2)} of a $${input.cost.ceiling.toFixed(2)} ceiling` : ''
    }. Run ${esc(input.meta.runId)} on ${esc(input.meta.domain)}. Research assisted by AI tooling; the verdict, the exclusions and the register are read by a person before anything is sent. Questions to calvin@seesawlabs.com.
  </p>
</div>
</body>
</html>
`;
}

function summarise(sources: SourceCheck[]): string {
  const pages = sources.filter((s) => s.kind === 'page');
  const dead = pages.filter((s) => !s.ok).length;
  const apis = sources.length - pages.length;
  return `${pages.length} page(s) re-fetched, ${pages.length - dead} reachable${dead ? `, ${dead} not` : ''}${apis ? `; ${apis} API source(s) recorded, not fetched` : ''}`;
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
  table, .lead, .stop, .idea, .shot { break-inside: avoid; }
  .reg, .peers { break-inside: auto; }
  .reg thead, .peers thead { display: table-header-group; }
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
  .fork { background: #fff; border: 1px solid var(--hi-ru); border-left-width: 3px; }
  .fork__branches { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6mm; margin: 2mm 0; }
  .fork__lab { font-family: var(--sans); font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 1mm; }
  .fork__changes { margin: 2mm 0 0; padding-top: 2mm; border-top: 1px solid var(--rule-2); }
  .stop { border: 1px solid var(--stop); border-left-width: 3px; padding: 4mm 5mm; margin: 0 0 4mm; }
  .stop h4 { margin-top: 0; color: var(--stop); }
  .stop p:last-child { margin-bottom: 0; }
  .idea { margin-bottom: 4mm; padding-left: 4mm; border-left: 2px solid var(--rule-2); }
  .idea h4 { margin-top: 2mm; }
  .idea--pick { border-left-color: var(--hi-ru); background: var(--hi); padding: 2mm 4mm 1mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 0 0 4mm; }
  caption { caption-side: bottom; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); text-align: left; padding-top: 2mm; line-height: 1.4; }
  th, td { text-align: left; padding: 1.6mm 2mm; border-bottom: 1px solid var(--rule-2); vertical-align: top; }
  th { font-family: var(--sans); font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); border-bottom: 1px solid var(--rule); }
  .pill { font-family: var(--sans); font-size: 6.5pt; letter-spacing: .08em; text-transform: uppercase; padding: .6mm 1.4mm; border: 1px solid var(--rule); white-space: nowrap; }
  .pill--verified { color: var(--ship); border-color: var(--ship); }
  .pill--cited { color: var(--hi-ru); border-color: var(--hi-ru); }
  .pill--tool { color: var(--ink-2); }
  .pill--ours { color: var(--stop); border-color: var(--stop); }
  .peers { table-layout: fixed; }
  .peers th:nth-child(1) { width: 18%; }
  .peers th:nth-child(2) { width: 42%; }
  .peers th:nth-child(3) { width: 22%; }
  .peers th:nth-child(4) { width: 18%; }
  .reg { font-size: 8.5pt; table-layout: fixed; }
  .reg td, .reg th { padding: 1.4mm 2mm; }
  .reg th:nth-child(1) { width: 14%; }
  .reg th:nth-child(2) { width: 37%; }
  .reg th:nth-child(3) { width: 24%; }
  .reg th:nth-child(4) { width: 9%; }
  .reg th:nth-child(5) { width: 8%; }
  .reg th:nth-child(6) { width: 8%; }
  .reg td:nth-child(4) { white-space: nowrap; }
  .q { font-style: normal; }
  .src { font-family: var(--mono); font-size: 7pt; color: var(--ink-2); overflow-wrap: anywhere; word-break: break-word; }
  .src a { text-decoration: none; }
  .id { font-family: var(--mono); font-size: 7.5pt; white-space: nowrap; overflow-wrap: anywhere; }
  .id a { text-decoration: none; }
  .rule-note { font-size: 9pt; color: var(--ink-2); }
  .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .shot { margin: 0; border: 1px solid var(--rule-2); padding: 2mm; }
  .shot img { display: block; width: 100%; height: auto; border: 1px solid var(--rule-2); }
  .shot__none { height: 40mm; display: grid; place-items: center; background: #f4f4f2; color: var(--ink-3); font-family: var(--sans); font-size: 8pt; }
  .shot figcaption { font-family: var(--mono); font-size: 6.5pt; color: var(--ink-2); margin-top: 1.5mm; overflow-wrap: anywhere; line-height: 1.4; }
  .shot figcaption a { text-decoration: none; }
  .mail { white-space: pre-wrap; font-family: var(--serif); font-size: 9.5pt; line-height: 1.45; background: #fafaf8; border: 1px solid var(--rule-2); padding: 4mm 5mm; margin: 0 0 4mm; }
  .foot { break-before: avoid; break-inside: avoid; font-family: var(--sans); font-size: 7.5pt; color: var(--ink-3); line-height: 1.5; border-top: 1px solid var(--rule); padding-top: 3mm; margin-top: 6mm; }
`;
