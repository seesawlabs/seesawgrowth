#!/usr/bin/env node
/**
 * Flags the constructions that make writing read as machine-generated.
 *
 *   npm run check:voice                       # the static report copy
 *   npm run check:voice -- runs/x/y/report.html
 *
 * The patterns live in src/lib/voice.ts, shared with stage 06 so a rule added
 * for one caller is enforced by both. This script covers the copy we write by
 * hand; the stage covers the prose the model writes on each run, and repairs it
 * there rather than only reporting it.
 *
 * The prompt in src/stages/06-synthesis.ts is excluded from the default set on
 * purpose: it quotes every construction it forbids, so a checker reading it
 * finds the ban list and reports the crime.
 */

import { readFile } from 'node:fs/promises';
import { checkVoice, textFromHtml } from '../src/lib/voice.ts';

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
  if (file.endsWith('.html')) text = textFromHtml(text);

  const flags = checkVoice(text);
  if (flags.length === 0) {
    console.log(`  ok      ${file}`);
    continue;
  }
  console.log(`\n  ${file}`);
  for (const f of flags) {
    total += f.count - f.budget;
    console.log(`    ${f.id} ×${f.count} (budget ${f.budget}) — ${f.note}`);
    for (const e of f.examples) console.log(`        …${e.slice(0, 96)}`);
  }
}

console.log(
  total === 0
    ? '\nVoice check clean.\n'
    : `\n${total} construction(s) over budget. These are habits, not errors — cut the ones doing rhythm rather than work.\n`
);
process.exitCode = total === 0 ? 0 : 1;
