#!/usr/bin/env node
/**
 * Asserts the intake boundary cannot 500, and that it asks for what it says.
 *
 * The form is not the only thing that posts to /api/intake. A string where the
 * spec says list once crashed `validate` on a public lead form — the one
 * failure mode that loses a lead without leaving a trace. These are the shapes
 * that actually arrive: hand-written JSON, a scanner, a stale client, an empty
 * body.
 *
 * What is asserted (re-cut 2026-09-02): a lead with only name, email, website
 * and role is accepted; the three open answers are optional and unlimited
 * short of the abuse cap; the research brief carries each answer under its
 * label, and omits the ones left blank; the hand-run command carries the
 * recipient and no company or category, because those are inferred.
 *
 *   npm run check:intake
 */
import { coerceIntake, validate, normalise, fulfilCommands, researchBrief } from '../src/lib/intake.ts';

const good = {
  name: 'Dana Whitfield',
  email: 'dana@cultivateadvisors.com',
  website: 'cultivateadvisors.com',
  role: 'ceo',
};

const cases = [
  ['the minimum: name, email, website, role', { ...good }, 0],
  ['all three answers', { ...good, changed: 'Board asked.', burn: 'Prep.', tried: 'A bot; killed it.' }, 0],
  ['website pasted as a URL', { ...good, website: 'https://www.cultivateadvisors.com/about' }, 0],
  ['numbers where strings go', { ...good, name: 42 }, 0],
  ['a long answer is not a problem', { ...good, burn: 'We retype things. '.repeat(500) }, 0],
  ['a pasted novel is refused', { ...good, tried: 'x'.repeat(25_000) }, 1],
  ['no role', { ...good, role: undefined }, 1],
  ['a non-website', { ...good, website: 'not a site' }, 1],
  ['empty object', {}, 4],
  ['a bare string', 'nope', 4],
  ['null', null, 4],
  ['an array', [1, 2, 3], 4],
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
  const ok = expectedErrors === 0 ? n === 0 : expectedErrors === 1 ? n === 1 : n >= expectedErrors;
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '} ${label} (${n} error${n === 1 ? '' : 's'})`);
  if (!ok) failed += 1;
}

/* -- what reaches the team and the pipeline -------------------------------- */

{
  const intake = normalise(coerceIntake({ ...good, changed: '  New CEO.  ', tried: 'Chatbot pilot, killed it.' }));
  check('the domain is derived from the website', intake.domain === 'cultivateadvisors.com', intake.domain);
  const brief = researchBrief(intake);
  check('the brief labels what changed', brief.includes('WHAT CHANGED RECENTLY: New CEO.'), brief);
  check('the brief labels what was ruled out', brief.includes('ALREADY TRIED, EVALUATED OR RULED OUT: Chatbot pilot, killed it.'), brief);
  check('a blank answer is omitted, not labelled empty', !brief.includes('WHERE THE TEAM BURNS TIME'), brief);
  check('the brief separates answers with a blank line', brief.split('\n\n').length === 2, JSON.stringify(brief));
}

{
  const intake = normalise(coerceIntake({ ...good }));
  check('no answers means an empty brief', researchBrief(intake) === '', researchBrief(intake));
}

{
  const long = 'A pilot stalled at integration. '.repeat(200);
  const intake = normalise(coerceIntake({ ...good, burn: long }));
  check('long free text reaches the team intact', intake.burn === long.trim(), `${intake.burn?.length} chars`);
}

{
  const mismatch = normalise(coerceIntake({ ...good, email: 'dana@othercompany.com' }));
  check('a work address on another domain is flagged', mismatch.domainMismatch === true);
  const free = normalise(coerceIntake({ ...good, email: 'dana@gmail.com' }));
  check('a consumer address is flagged as free mail, not as a mismatch', free.freeMail === true && free.domainMismatch === false);
}

/* The hand-run commands are the fallback operator interface. */
{
  const intake = normalise(coerceIntake({ ...good, changed: 'Board asked for a plan.' }));
  const { generate, release } = fulfilCommands(intake);
  check('the run command carries the recipient', generate.includes('dana@cultivateadvisors.com'), generate);
  check('the run command carries the brief', generate.includes('WHAT CHANGED RECENTLY: Board asked'), generate);
  check('the run command passes no company or category; both are inferred', !generate.includes('--company') && !generate.includes('--category'), generate);
  check('the release command needs only the domain', /--domain \S+ --release/.test(release), release);
  check('the release command carries no address to mistype', !release.includes('@'), release);
}

if (failed > 0) {
  console.log(`\n${failed} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nIntake boundary holds.\n');
