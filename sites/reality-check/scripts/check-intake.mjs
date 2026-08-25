#!/usr/bin/env node
/**
 * Asserts the intake boundary cannot 500.
 *
 * The form is not the only thing that posts to /api/exposure-request. A string
 * where the spec says list crashed `validate` on `.filter is not a function`,
 * which is a 500 on a public lead form — the one failure mode that loses a
 * lead without leaving a trace. These are the shapes that actually arrive:
 * hand-written JSON, a scanner, a stale client, an empty body.
 *
 *   npm run check:intake
 */
import { coerceIntake, validate } from '../src/lib/exposure-intake.ts';

const good = {
  name: 'Dana Whitfield',
  email: 'dana@cultivateadvisors.com',
  company: 'Cultivate Advisors',
  website: 'cultivateadvisors.com',
  oneLiner: 'Monthly one-to-one business advising for owner-operated companies.',
};

const cases = [
  ['the form\'s own shape', { ...good, competitors: ['eosworldwide.com', 'vistage.com'] }, 0],
  ['competitors as a comma string', { ...good, competitors: 'eosworldwide.com, vistage.com' }, 0],
  ['competitors as newlines', { ...good, competitors: 'a.com\nb.com\n' }, 0],
  ['competitors as an object', { ...good, competitors: { a: 1 } }, 0],
  ['competitors as mixed junk', { ...good, competitors: [1, null, 'ok.com'] }, 0],
  ['four competitors', { ...good, competitors: ['a.com', 'b.com', 'c.com', 'd.com'] }, 1],
  ['numbers where strings go', { ...good, name: 42, company: 7 }, 0],
  ['empty object', {}, 5],
  ['a bare string', 'nope', 5],
  ['null', null, 5],
  ['an array', [1, 2, 3], 5],
];

let failed = 0;
for (const [label, body, expectedErrors] of cases) {
  let errors;
  try {
    errors = validate(coerceIntake(body));
  } catch (error) {
    console.log(`  THREW   ${label} — ${error.message}`);
    failed += 1;
    continue;
  }
  const n = errors.length;
  /* Exact counts on the well-formed cases; a floor on the empty ones, since the
     point there is "rejected with field errors", not which fields. */
  const ok = expectedErrors === 0 ? n === 0 : n >= expectedErrors;
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '} ${label} (${n} error${n === 1 ? '' : 's'})`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.log(`\n${failed} case(s) failed.\n`);
  process.exit(1);
}
console.log('\nIntake boundary holds.\n');
