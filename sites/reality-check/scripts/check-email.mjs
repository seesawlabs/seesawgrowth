#!/usr/bin/env node
/**
 * Voice-checks the emails as the recipient reads them, not as they are written.
 *
 * Running the checker over `src/lib/email.ts` flags the doc comments too, and
 * the comments are not the product. So the templates are rendered with sample
 * arguments and the resulting subject and body are what gets checked — the same
 * approach as voice-checking a rendered report rather than the renderer.
 *
 *   npm run check:email
 */
import { ackEmail, readyEmail } from '../src/lib/email.ts';
import { checkVoice } from '../../../tools/exposure/src/lib/voice.ts';

const samples = [
  [
    'ack',
    ackEmail({ name: 'Dana Whitfield', company: 'Cultivate Advisors', bookingUrl: 'https://example.com/book' }),
  ],
  [
    'ack (no calendar configured)',
    ackEmail({ name: 'Dana Whitfield', company: 'Cultivate Advisors' }),
  ],
  [
    'ack (booked first)',
    ackEmail({
      name: 'Dana Whitfield',
      company: 'Cultivate Advisors',
      bookingUrl: 'https://example.com/book',
      bookedFirst: true,
    }),
  ],
  [
    'ready',
    readyEmail({
      name: 'Dana Whitfield',
      company: 'Cultivate Advisors',
      link: 'https://example.com/r/abc',
      ttlDays: 30,
      bookingUrl: 'https://example.com/book',
    }),
  ],
];

let over = 0;
for (const [label, message] of samples) {
  const text = `${message.subject}\n\n${message.text}`;
  const flags = checkVoice(text);
  if (flags.length === 0) {
    console.log(`  ok      ${label}`);
    continue;
  }
  console.log(`\n  ${label}`);
  for (const f of flags) {
    over += f.count - f.budget;
    console.log(`    ${f.id} ×${f.count} (budget ${f.budget}) — ${f.note}`);
    for (const e of f.examples) console.log(`        …${e.slice(0, 96)}`);
  }
}

if (over > 0) {
  console.log(`\n${over} construction(s) over budget.\n`);
  process.exit(1);
}
console.log('\nEmail voice check clean.\n');
