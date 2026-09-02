#!/usr/bin/env node
/**
 * Asserts the intake boundary cannot 500, and that it asks for what it says.
 *
 * The form is not the only thing that posts to /api/intake. A string where the
 * spec says list crashed `validate` on `.filter is not a function`, which is a
 * 500 on a public lead form — the one failure mode that loses a lead without
 * leaving a trace. These are the shapes that actually arrive: hand-written
 * JSON, a scanner, a stale client, an empty body.
 *
 * Scoring is retired from this flow (docs/00-status.md, 2026-08-31), so there
 * are no routing assertions here any more. What is asserted instead: that a
 * lead without a revenue band or a stage answer is accepted, that long free
 * text is accepted, and that `bookedFirst` survives the boundary — because the
 * alert tells the team which order the lead did things in.
 *
 *   npm run check:intake
 */
import { coerceIntake, validate, normalise, fulfilCommands } from '../src/lib/intake.ts';

/* A submission that should pass cleanly. No revenue, no stage: neither is
   asked any more. Role stays, because it is one tap and the team reads it. */
const good = {
  name: 'Dana Whitfield',
  email: 'dana@cultivateadvisors.com',
  company: 'Cultivate Advisors',
  website: 'cultivateadvisors.com',
  oneLiner: 'Monthly one-to-one business advising for owner-operated companies.',
  role: 'ceo',
};

const cases = [
  ["the form's own shape", { ...good, competitors: ['eosworldwide.com', 'vistage.com'] }, 0],
  ['no revenue, no stage — accepted', { ...good }, 0],
  ['competitors as a comma string', { ...good, competitors: 'eosworldwide.com, vistage.com' }, 0],
  ['competitors as newlines', { ...good, competitors: 'a.com\nb.com\n' }, 0],
  ['competitors as an object', { ...good, competitors: { a: 1 } }, 0],
  ['competitors as mixed junk', { ...good, competitors: [1, null, 'ok.com'] }, 0],
  ['four competitors', { ...good, competitors: ['a.com', 'b.com', 'c.com', 'd.com'] }, 1],
  ['numbers where strings go', { ...good, name: 42, company: 7 }, 0],
  ['a long answer is not a problem', { ...good, tried: 'We tried things. '.repeat(400) }, 0],
  ['a one-liner well over the old 300 cap', { ...good, oneLiner: 'x'.repeat(1_200) }, 0],
  ['a pasted novel is refused', { ...good, tried: 'x'.repeat(25_000) }, 1],
  ['empty object', {}, 5],
  ['a bare string', 'nope', 5],
  ['null', null, 5],
  ['an array', [1, 2, 3], 5],
];

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '} ${label}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failed += 1;
};

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
  const ok = expectedErrors === 0 ? n === 0 : expectedErrors === 1 ? n === 1 : n >= expectedErrors;
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '} ${label} (${n} error${n === 1 ? '' : 's'})`);
  if (!ok) failed += 1;
}

/* -- what reaches the team ------------------------------------------------ */

{
  const yes = normalise(coerceIntake({ ...good, bookedFirst: true }));
  const str = normalise(coerceIntake({ ...good, bookedFirst: 'true' }));
  const no = normalise(coerceIntake({ ...good }));
  check('bookedFirst true survives the boundary', yes.bookedFirst === true);
  check('bookedFirst as the string "true" is true', str.bookedFirst === true);
  check('bookedFirst absent is false', no.bookedFirst === false);
}

{
  const long = 'A pilot stalled at integration. '.repeat(200);
  const intake = normalise(coerceIntake({ ...good, tried: long }));
  check('long free text reaches the team intact', intake.tried === long.trim(), `${intake.tried?.length} chars`);
}

/* The competitor domains are what seed peer discovery, so a name that is not a
   host must not silently become one. */
{
  const intake = normalise(coerceIntake({ ...good, competitors: ['Vistage', 'eosworldwide.com'] }));
  check(
    'a competitor typed as a name is kept but not treated as a domain',
    intake.competitors.length === 2 && intake.competitorDomains.length === 1,
    JSON.stringify({ competitors: intake.competitors, domains: intake.competitorDomains })
  );
}

/* The hand-run commands are the fallback operator interface. If the recipient
   stops riding along in the first one, releasing goes back to retyping an
   email address by hand, which is how a client's document reaches a stranger. */
{
  const intake = normalise(
    coerceIntake({ ...good, email: 'dana@cultivateadvisors.com', competitors: ['eosworldwide.com'] })
  );
  const { generate, release } = fulfilCommands(intake);
  check('the run command carries the recipient', generate.includes('dana@cultivateadvisors.com'), generate);
  check('the run command carries the one-liner', generate.includes('--category'), generate);
  check('a named competitor is seeded', generate.includes('--peer eosworldwide.com'), generate);
  check('the release command needs only the domain', /--domain \S+ --release/.test(release), release);
  check('the release command carries no address to mistype', !release.includes('@'), release);
}

if (failed > 0) {
  console.log(`\n${failed} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nIntake boundary holds.\n');
