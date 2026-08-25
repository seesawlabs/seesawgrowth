#!/usr/bin/env node
/**
 * Invariants for magic links and stored brief names.
 *
 * Both are security boundaries: the token is the only thing standing between a
 * stranger and a client's brief, and the stored object name is the only thing
 * standing between a guessed URL and the same document on a public bucket.
 *
 *   npm run check:links
 */
import {
  mintToken,
  verifyToken,
  reportIdFor,
  storageNameFor,
  isSafeReportId,
} from '../src/lib/magic-link.ts';

const SECRET = 'a-test-secret-not-used-anywhere';
const OTHER = 'a-different-secret';
let failed = 0;

const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok     ' : 'FAIL   '} ${label}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failed += 1;
};

const id = reportIdFor('acmehealth.com', '2026-08-25T09-14-02-113Z');
check('a report id is safe to build a path from', isSafeReportId(id), id);

/* -- the token -- */
const token = mintToken({ reportId: id, email: 'dana@acmehealth.com', ttlDays: 30 }, SECRET);
check('a fresh token verifies', verifyToken(token, SECRET).ok);
check('the wrong secret does not verify', !verifyToken(token, OTHER).ok);
check('a tampered payload does not verify', !verifyToken(`x${token}`, SECRET).ok);
check('an empty secret never verifies', !verifyToken(token, '').ok);

const expired = mintToken({ reportId: id, email: 'd@x.com', ttlDays: -1 }, SECRET);
check('an expired token does not verify', !verifyToken(expired, SECRET).ok);

/* -- the stored name -- */
const name = storageNameFor(id, SECRET);
check('the stored name leaks no part of the id', !name.includes('acmehealth') && !name.includes('2026'), name);
check('the stored name is stable for the same secret', name === storageNameFor(id, SECRET));
check('a different secret gives a different name', name !== storageNameFor(id, OTHER));
check('a different id gives a different name', name !== storageNameFor(`${id}x`, SECRET));
check('the stored name is URL-safe', /^[A-Za-z0-9_-]+$/.test(name), name);

let threw = false;
try {
  storageNameFor(id, '');
} catch {
  threw = true;
}
check('deriving a name without a secret throws', threw);

if (failed > 0) {
  console.log(`\n${failed} invariant(s) broken.\n`);
  process.exit(1);
}
console.log('\nLink and storage invariants hold.\n');
