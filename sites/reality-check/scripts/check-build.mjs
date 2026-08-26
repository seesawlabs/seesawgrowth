#!/usr/bin/env node
/**
 * Runs the build and fails on anything that did not finish.
 *
 * `astro build` reports some failures without the `[ERROR]` tag — a prerender
 * that throws prints a bare stack trace and exits 0 in some paths. Grepping for
 * `[ERROR]` therefore passed a build whose homepage never rendered
 * (`ONE_LINER_MAX is not defined`). The reliable signal is the absence of
 * "Complete!" plus an empty static output, so both are checked here rather than
 * remembered by eye.
 *
 *   npm run check:build
 */
import { spawnSync } from 'node:child_process';
import { glob } from 'node:fs/promises';

const run = spawnSync('npm', ['run', 'build'], { encoding: 'utf8', shell: false });
const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;

const problems = [];
if (run.status !== 0) problems.push(`build exited ${run.status}`);
if (!out.includes('Complete!')) problems.push('build never reported "Complete!"');
for (const line of out.split('\n')) {
  if (/\bis not defined\b|\bCannot read properties\b|\[ERROR\]|UNRESOLVED_IMPORT/.test(line)) {
    problems.push(line.trim().slice(0, 160));
  }
}

const pages = [];
for await (const f of glob('**/*.html', { cwd: new URL('../.vercel/output/static/', import.meta.url) })) {
  pages.push(f);
}
if (pages.length === 0) problems.push('no prerendered HTML — every page failed or went server-side');

if (problems.length > 0) {
  console.error('\nBuild is not clean:\n');
  for (const p of [...new Set(problems)]) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`  ok      build clean, ${pages.length} page(s) prerendered\n`);
