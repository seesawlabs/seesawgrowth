/* ---------------------------------------------------------------------------
   Accumulated peer evidence, so a brief stops flapping between runs.

   THE PROBLEM. Stage 03 asks a live search index a question once per peer. The
   same peer set returned two dated AI moves on one run and none an hour later.
   Coverage moved 100% → 80%, which is the difference between a brief we send
   and one we route to a call — decided by nothing that happened in the world.

   THE FIX, and why it is not cheating. Every item this ledger holds is a DATED
   PAST EVENT with a citation: "in March 2025 they announced X, here is the
   article". A dated event does not stop having happened because a search index
   ranked it lower today. So evidence accumulates rather than being re-won each
   run: what was accepted once, with its source and its date, stays accepted.
   Recall becomes monotonic, and a re-run can add findings but never silently
   lose them.

   What this does NOT do is lower any bar. Items enter only by passing every
   gate in stage 03 — attribution, an action verb, a citation, a source date,
   no year mismatch. The ledger stores what survived; it does not vouch for
   anything.

   WHY IT IS COMMITTED. It is research we paid for, it is about public
   companies from public sources, and a run on a different machine should not
   start from nothing. The alternative — a cache keyed by prompt hash — expires
   and is per-machine, which is exactly how the flapping got introduced.
--------------------------------------------------------------------------- */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface LedgerItem {
  statement: string;
  observedAt: string;
  citations: { url: string; title?: string; date?: string }[];
  /** Run that first accepted it. Provenance, and it dates the finding. */
  firstSeenRun: string;
  /** Most recent run that saw it again. Not an expiry, just a signal. */
  lastSeenRun: string;
  timesSeen: number;
}

export interface PeerLedger {
  domain: string;
  updatedAt: string;
  items: LedgerItem[];
}

/** One file per peer domain, so two subjects sharing a peer share the finding. */
function fileFor(root: string, domain: string): string {
  const safe = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
  return join(resolve(root), `${safe}.json`);
}

/**
 * The identity of a finding is its source, not its wording.
 *
 * Two runs describe the same announcement differently — "launched an
 * AI-assisted intake tool" and "deployed automation for patient intake" — while
 * citing the same article. Keying on the URL means the second run recognises
 * the first run's finding instead of storing a near-duplicate, and the brief
 * keeps the wording it already had.
 */
function keyFor(item: { citations: { url: string }[]; statement: string }): string {
  const url = item.citations[0]?.url;
  if (url) {
    try {
      const u = new URL(url);
      return `${u.host}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  // No citation should reach here, but never merge two unrelated statements.
  return `stmt:${item.statement.slice(0, 120).toLowerCase()}`;
}

export async function loadPeerLedger(root: string, domain: string): Promise<PeerLedger | null> {
  try {
    const raw = await readFile(fileFor(root, domain), 'utf8');
    const parsed = JSON.parse(raw) as PeerLedger;
    return Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

export interface MergeResult {
  ledger: PeerLedger;
  /** Items the ledger contributed that this run did not find. */
  recovered: LedgerItem[];
  /** Items this run found that the ledger had not seen. */
  added: LedgerItem[];
}

/**
 * Merge a run's findings into a peer's ledger. Pure — the caller decides
 * whether to write, so a dry run cannot mutate the corpus.
 */
export function mergePeerEvidence(
  existing: PeerLedger | null,
  domain: string,
  fresh: { statement: string; observedAt: string; citations: { url: string; title?: string; date?: string }[] }[],
  runId: string,
  now: string
): MergeResult {
  const byKey = new Map<string, LedgerItem>();
  for (const item of existing?.items ?? []) byKey.set(keyFor(item), item);

  const added: LedgerItem[] = [];
  const seenThisRun = new Set<string>();

  for (const f of fresh) {
    const key = keyFor(f);
    seenThisRun.add(key);
    const prior = byKey.get(key);
    if (prior) {
      /* Keep the wording the brief already used. Stability is the point: a
         re-run should not reword a sentence the reader may have seen. */
      byKey.set(key, { ...prior, lastSeenRun: runId, timesSeen: prior.timesSeen + 1 });
      continue;
    }
    const item: LedgerItem = {
      statement: f.statement,
      observedAt: f.observedAt,
      citations: f.citations,
      firstSeenRun: runId,
      lastSeenRun: runId,
      timesSeen: 1,
    };
    byKey.set(key, item);
    added.push(item);
  }

  const recovered = [...byKey.entries()]
    .filter(([key]) => !seenThisRun.has(key))
    .map(([, item]) => item);

  return {
    ledger: {
      domain,
      updatedAt: now,
      items: [...byKey.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
    },
    recovered,
    added,
  };
}

export async function savePeerLedger(root: string, ledger: PeerLedger): Promise<void> {
  await mkdir(resolve(root), { recursive: true });
  await writeFile(fileFor(root, ledger.domain), `${JSON.stringify(ledger, null, 2)}\n`);
}

/** Peer domains the ledger knows about. For the CLI's status output. */
export async function ledgerDomains(root: string): Promise<string[]> {
  try {
    const names = await readdir(resolve(root));
    return names.filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
