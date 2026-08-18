/**
 * Guards against a spacing bug that already shipped once.
 *
 * Astro trims the whitespace between an inline tag and a following newline, so
 * source that looks correct:
 *
 *     reach production about <strong>twice as often</strong>
 *     as internal ones.
 *
 * renders as "twice as oftenas internal ones". It is invisible in the source
 * and obvious to a visitor, which is the worst combination.
 *
 * The fix is to keep the closing tag off the end of the line. This script
 * catches the cases where that slipped, by scanning the *built* HTML rather
 * than the templates — the templates are what look fine.
 *
 * Run after `npm run build`. Deliberately not wired into `build` itself, so a
 * false positive can never break a deploy.
 */
import { glob, readFile } from 'node:fs/promises';

const ROOT = new URL('../.vercel/output/static/', import.meta.url);
const INLINE = 'strong|em|a|code|span|b|i';

// A closing inline tag butted against a word character, or a word character
// butted against an opening one. Both mean a space was eaten.
const LOST = new RegExp(`</(?:${INLINE})>[A-Za-z]|[A-Za-z]<(?:${INLINE})[ >]`, 'g');

const files = [];
for await (const f of glob('**/*.html', { cwd: ROOT })) files.push(f);

if (files.length === 0) {
  console.error('No built HTML found. Run `npm run build` first.');
  process.exit(2);
}

let failures = 0;

for (const file of files.sort()) {
  const html = await readFile(new URL(file, ROOT), 'utf8');
  for (const m of html.matchAll(LOST)) {
    const start = Math.max(0, m.index - 60);
    const context = html.slice(start, m.index + m[0].length + 40).replace(/\s+/g, ' ');
    console.error(`${file}: lost space at "${m[0]}"\n  …${context}…\n`);
    failures++;
  }
}

if (failures > 0) {
  console.error(
    `${failures} lost inline space(s). Move the closing tag off the end of the\n` +
      `line in the source template — the space before a newline gets trimmed.`
  );
  process.exit(1);
}

console.log(`Prose spacing OK across ${files.length} page(s).`);
