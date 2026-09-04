#!/usr/bin/env node
/**
 * The review gate, as a script.
 *
 *   node review.mjs <dir>     dir = a downloaded artifact folder, or a run folder
 *
 * Finds 07-one-thing.json, sources.json and email-draft.md under <dir> and prints
 * the checklist a reviewer works through before anything is sent, ending with a
 * SEND-READY verdict and its reasons. Deterministic and dependency-free, so the
 * same run always gets the same checklist.
 *
 * It does not edit anything. Removing a † sentence is the reviewer's decision;
 * replacing a redacted figure is forbidden.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('Usage: node review.mjs <downloaded artifact dir>');
  process.exit(2);
}

function find(dir, name, depth = 6) {
  if (depth < 0) return null;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isFile() && e === name) return p;
    if (st.isDirectory()) {
      const hit = find(p, name, depth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

const oneThingPath = find(root, '07-one-thing.json');
const sourcesPath = find(root, 'sources.json');
const draftPath = find(root, 'email-draft.md');
const pdfPath = find(root, 'research-report.pdf');
const metaPath = find(root, '00-meta.json');
const coveragePath = find(root, 'coverage.json');

const read = (p) => (p ? JSON.parse(readFileSync(p, 'utf8')) : null);
const art = read(oneThingPath);
const sources = read(sourcesPath) ?? [];
const meta = read(metaPath);
const coverage = read(coveragePath);
const draft = draftPath ? readFileSync(draftPath, 'utf8') : '';

const blockers = [];
const cautions = [];
const line = (s = '') => console.log(s);
const head = (s) => line(`\n== ${s}`);

line(`ONE THING REVIEW`);
if (meta) line(`${meta.domain}  run ${meta.runId}  started ${meta.startedAt}`);
line(`PDF: ${pdfPath ?? 'NOT PRINTED (no Chrome on the runner; the HTML is in the folder)'}`);
if (!pdfPath) cautions.push('no PDF was printed');

if (!art) {
  line('\nNo 07-one-thing.json found. Stage 07 did not run; there is research but no recommendation.');
  line('\nSEND-READY: no');
  line('  - no recommendation was written');
  process.exit(0);
}

const x = art.oneThing;
const nul = x.verdict === 'nothing_worth_a_call';
const pick = nul ? null : x.ideas[Math.min(Math.max(0, x.pick.index | 0), x.ideas.length - 1)];

/* 1. banner */
head('1. Banner: what the report itself flags');
const flags = [];
if (nul) flags.push('VERDICT IS NULL: nothing worth a call. Check it is the honest read of the register, not a give-up on thin evidence.');
if (art.redacted > 0) {
  flags.push(`${art.redacted} figure(s) redacted as unsourced. Find "[figure removed: unsourced]" and decide each sentence.`);
  blockers.push(`${art.redacted} redacted figure(s) in the text`);
}
if ((art.callMaterialInEmail ?? []).length) {
  flags.push(`Email cites non-Verified claims: ${art.callMaterialInEmail.join(', ')}. Marked † in the draft.`);
  blockers.push(`email cites ${art.callMaterialInEmail.length} non-Verified claim(s): ${art.callMaterialInEmail.join(', ')}`);
}
if (!nul && !x.fork.found) {
  flags.push('No fork found. The report says so on page one; read whyNone and decide whether you believe it.');
  cautions.push('no fork found');
}
const otherProblems = (art.problems ?? []).filter((p) => p.code !== 'unsourced_numeral' && p.code !== 'non_verified_in_email');
if (otherProblems.length) {
  flags.push(`Validation problems left after retry: ${otherProblems.map((p) => `${p.field} ${p.code}`).join('; ')}`);
  cautions.push(`${otherProblems.length} validation problem(s) remain`);
}
if (coverage && !coverage.sufficient) {
  flags.push(`Coverage below minimums: ${coverage.shortfalls.join('; ')}. The evidence is thin.`);
  cautions.push('coverage below minimums');
}
const deadPages = sources.filter((s) => s.kind === 'page' && !s.ok);
const challenged = sources.filter((s) => s.kind === 'page' && s.status === 202);
if (deadPages.length) {
  flags.push(`${deadPages.length} cited page(s) not reachable at print time: ${deadPages.map((d) => `${d.status ?? 'error'} ${d.url}`).join('; ')}`);
  cautions.push(`${deadPages.length} dead source URL(s)`);
}
if (challenged.length) {
  flags.push(`${challenged.length} page(s) answered 202 (usually a bot challenge); the thumbnail shows what a visitor sees. Re-check by hand: ${challenged.map((d) => d.url).join('; ')}`);
  cautions.push(`${challenged.length} source(s) returned 202`);
}
if (flags.length === 0) line('  none. Clean run.');
for (const f of flags) line(`  - ${f}`);

/* 2. verdict */
head('2. Verdict');
if (nul) {
  line('  nothing_worth_a_call');
  line(`  What we looked at: ${x.nullResult?.whatWeLookedAt ?? '(missing)'}`);
  for (const t of x.nullResult?.whatWeSetAside ?? []) line(`  Set aside: ${t}`);
  line(`  One question: ${x.nullResult?.oneQuestion ?? '(missing)'}`);
} else {
  line(`  recommend: ${pick.headline}`);
  line(`  Ideas weighed: ${x.ideas.length}`);
  for (const [i, idea] of x.ideas.entries()) line(`    ${i + 1}. ${idea.headline}${idea === pick ? '   <- pick' : ''}`);
}

/* 3. fork */
if (!nul) {
  head('3. The fork: do the branches name different builds?');
  if (x.fork.found) {
    line(`  Q: ${x.fork.question}`);
    line(`  If yes: ${x.fork.ifYes}`);
    line(`  If no:  ${x.fork.ifNo}`);
    line(`  Differs: ${x.fork.whatChanges}`);
    line('  Ask yourself: is that a different build, or the same build later? Timing-only means the fork failed.');
  } else {
    line(`  None found. Why: ${x.fork.whyNone}`);
    line('  Ask yourself: would the owner name an unknown that changes the build? If so, the run was under-researched.');
  }
}

/* 4. buyer fit */
head('4. Buyer overlap (yes = real threat; no/partial must not be written up as a threat)');
if (!x.peerFit?.length) line('  no peers assessed');
for (const f of x.peerFit ?? []) line(`  ${f.overlap.padEnd(8)} ${f.peer}: sells to ${f.sellsTo}`);

/* 5. the draft */
head('5. The email draft');
const daggers = (draft.match(/\[\d+†\]/g) ?? []).length;
const redactions = (draft.match(/\[figure removed: unsourced\]/g) ?? []).length;
line(`  Words: ${x.email.body.trim().split(/\s+/).length}   † footnotes: ${daggers}   redaction markers in draft: ${redactions}`);
if (daggers) line('  Every † sentence is call material: cut it or say it on the call. Do not send as written.');
if (redactions) line('  Every redaction marker is a number the model could not source. Never type one in.');
line('  Refusal: ' + x.refuse.what);

/* 6. sources */
head('6. Sources');
const pages = sources.filter((s) => s.kind === 'page');
line(`  ${pages.length} page(s) re-fetched, ${pages.filter((s) => s.ok).length} reachable; ${sources.length - pages.length} API source(s) recorded, not fetched`);

/* verdict */
head('SEND-READY');
if (blockers.length === 0) {
  line('SEND-READY: yes (after a human read; add your own sign-off)');
} else {
  line('SEND-READY: no');
  for (const b of blockers) line(`  - ${b}`);
}
if (cautions.length) {
  line('Cautions:');
  for (const c of cautions) line(`  - ${c}`);
}
if (meta) line(`\nRevise: scripts/revise.sh --domain ${meta.domain} --run ${meta.runId} --notes "…"`);
if (draftPath) line(`Draft: ${draftPath}`);
