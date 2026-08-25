#!/usr/bin/env node
/**
 * Flags the constructions that make writing read as machine-generated.
 *
 *   npm run check:voice                 # the report copy and the prompt
 *   npm run check:voice -- runs/x/y/report.html
 *
 * WHY THIS IS A SCRIPT AND NOT A STYLE NOTE. The first review of the finished
 * report was "feels very AI generated". A later pass counted the tells across
 * every surface: fourteen em-dash asides that land a small conclusion, five
 * "Not X. Y." pairs, eight rhetorical uses of "worth", and four of six section
 * headings appending a second clause after a comma for balance. None of that
 * was deliberate, which is exactly why it needs a checker — these are habits,
 * and habits come back.
 *
 * The patterns are high-precision on purpose. A checker that cries wolf gets
 * ignored, and some of these constructions are fine once. The count is the
 * signal: one em-dash aside in a document is a writer, nine is a tic.
 */

import { readFile } from 'node:fs/promises';

const PATTERNS = [
  {
    id: 'em-dash-aside',
    // An em dash followed by a short clause that ends the sentence.
    re: /—[^.!?—\n]{10,90}[.!?]/g,
    note: 'em-dash aside landing a conclusion. Use a full stop, or cut it.',
    budget: 2,
  },
  {
    id: 'not-x-but-y',
    re: /\b(?:It|That|This)(?:'s| is| does)? not (?:an?|the) [^.,;]{2,40}[.,] (?:It|That|This)(?:'s| is)? (?:an?|the)\b|\bnot (?:an?|the) [^.,;]{2,40}, (?:it'?s|but) \b/gi,
    note: '"Not X. Y." rhetorical pair. Just say what it is.',
    budget: 0,
  },
  {
    id: 'rhetorical-worth',
    re: /\bworth (?:a conversation|your time|talking about|having|doing|the effort)\b|\bearns? its place\b/gi,
    note: '"worth …" doing rhetorical work. Say what it gets them.',
    budget: 1,
  },
  {
    id: 'comma-appendix-heading',
    re: /^[A-Z][^.\n]{8,60}, and (?:whether|where|what|how|why)\b[^.\n]{0,40}$/gm,
    note: 'heading with a balancing clause after a comma.',
    budget: 0,
  },
  {
    id: 'jargon',
    re: /\bpublic surface\b|\bleverage\b|\bunlock\b|\bnorth star\b|\bdouble down\b|\brapidly evolving\b|\bin today's\b/gi,
    note: 'consultant register or in-house jargon.',
    budget: 0,
  },
  {
    id: 'inverted-moral',
    re: /\b(?:It|That|This) does(?:n't| not) need to be [^.,]{3,40}, it needs to\b|\bis not (?:about|a matter of) [^.,]{3,40}, (?:it'?s|but)\b/gi,
    note: 'sentence ending on a neat inversion.',
    budget: 0,
  },
  {
    id: 'triad',
    re: /\bno [a-z]{3,12}, no [a-z]{3,12}(?:,| and) no [a-z]{3,12}\b/gi,
    note: 'three-item list used for rhythm.',
    budget: 0,
  },
];

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ');
}

/* The prompt in src/stages/06-synthesis.ts is deliberately excluded from the
   default set: it quotes every one of these constructions in order to forbid
   them, so a checker reading it finds the ban list and reports the crime. Pass
   it explicitly if you want to audit the prose around the rules. */
const targets = process.argv.slice(2);
const files = targets.length ? targets : ['src/render/copy.ts'];

let total = 0;
for (const file of files) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    console.error(`  skipped ${file} (unreadable)`);
    continue;
  }
  if (file.endsWith('.html')) text = strip(text);

  const hits = [];
  for (const p of PATTERNS) {
    const found = [...text.matchAll(p.re)];
    if (found.length > p.budget) {
      hits.push({ p, found });
    }
  }

  if (hits.length === 0) {
    console.log(`  ok      ${file}`);
    continue;
  }
  console.log(`\n  ${file}`);
  for (const { p, found } of hits) {
    total += found.length;
    console.log(`    ${p.id} ×${found.length} (budget ${p.budget}) — ${p.note}`);
    for (const m of found.slice(0, 3)) {
      console.log(`        …${m[0].replace(/\s+/g, ' ').trim().slice(0, 96)}`);
    }
  }
}

console.log(
  total === 0
    ? '\nVoice check clean.\n'
    : `\n${total} flagged construction(s) over budget. These are habits, not errors — cut the ones that are doing rhythm rather than work.\n`
);
