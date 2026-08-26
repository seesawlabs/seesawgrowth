#!/usr/bin/env node
/**
 * Asserts the intake boundary cannot 500.
 *
 * The form is not the only thing that posts to /api/intake. A string
 * where the spec says list crashed `validate` on `.filter is not a function`,
 * which is a 500 on a public lead form — the one failure mode that loses a
 * lead without leaving a trace. These are the shapes that actually arrive:
 * hand-written JSON, a scanner, a stale client, an empty body.
 *
 *   npm run check:intake
 */
import {
  coerceIntake,
  validate,
  normalise,
  scoreIntake,
  operatorAction,
  fulfilCommands,
} from '../src/lib/intake.ts';

/* A submission that should pass cleanly. The qualifying answers are required
   now: they decide whether the session is offered at all, and a form that lets
   someone skip them puts the operator back to guessing from a domain name. */
const good = {
  name: 'Dana Whitfield',
  email: 'dana@cultivateadvisors.com',
  company: 'Cultivate Advisors',
  website: 'cultivateadvisors.com',
  oneLiner: 'Monthly one-to-one business advising for owner-operated companies.',
  role: 'ceo',
  revenue: '50-250',
  stage: 'stalled',
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
  const ok = expectedErrors === 0 ? n === 0 : n >= expectedErrors;
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '} ${label} (${n} error${n === 1 ? '' : 's'})`);
  if (!ok) failed += 1;
}

/* -- routing: what the operator is told ------------------------------------
   Every lead is shown the calendar now, so the score no longer gates anything
   the visitor sees. It still has to be right, because it decides what the team
   is told to do — including that a poor-fit lead has a meeting to cancel. */

const routed = [
  ['a stalled mid-market CTO', { ...good, role: 'cto', revenue: '250-1b', stage: 'stalled', budgetAck: true }, 'auto_book'],
  ['ICP override: stalled beats a low score', { ...good, role: 'other', revenue: '50-250', stage: 'stalled', budgetAck: false }, 'auto_book'],
  ['secondary ICP is capped at review', { ...good, role: 'ceo', revenue: '10-50', stage: 'stalled', budgetAck: true }, 'manual_review'],
  ['under $10M is not a fit', { ...good, role: 'ceo', revenue: 'lt10', stage: 'stalled', budgetAck: true }, 'not_yet'],
  ['just exploring, no budget nod', { ...good, role: 'other', revenue: '50-250', stage: 'exploring', budgetAck: false }, 'not_yet'],
];

for (const [label, body, expected] of routed) {
  const coerced = coerceIntake(body);
  const errors = validate(coerced);
  if (errors.length) {
    check(label, false, `fixture does not validate: ${errors.map((e) => e.field).join(', ')}`);
    continue;
  }
  const verdict = scoreIntake(normalise(coerced));
  check(`${label} → ${expected}`, verdict.route === expected, `got ${verdict.route}`);
}

/* The one instruction that has to be there: a poor-fit lead can book, so
   somebody has to be told to cancel it. */
check(
  'a not_yet lead is flagged for cancellation',
  /cancel the meeting/i.test(operatorAction('not_yet')),
  operatorAction('not_yet')
);
check(
  'a good-fit lead is not',
  !/cancel/i.test(operatorAction('auto_book')),
  operatorAction('auto_book')
);

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

/* The alert's two commands are the whole operator interface. If the recipient
   stops riding along in the first one, releasing goes back to retyping an email
   address by hand, which is how a client's analysis reaches a stranger. */
{
  const intake = normalise(
    coerceIntake({ ...good, email: 'dana@cultivateadvisors.com', competitors: ['eosworldwide.com'] })
  );
  const { generate, release } = fulfilCommands(intake);
  check('the run command carries the recipient', generate.includes('dana@cultivateadvisors.com'), generate);
  check('the run command carries the one-liner', generate.includes('--category'), generate);
  check('a named competitor is seeded', generate.includes('--peer eosworldwide.com'), generate);
  check('the release command needs only the domain', /--domain \S+ --release/.test(release), release);
  check(
    'the release command carries no address to mistype',
    !release.includes('@'),
    release
  );
}

if (failed > 0) {
  console.log(`\n${failed} case(s) failed.\n`);
  process.exit(1);
}
console.log('\nIntake boundary and routing hold.\n');
