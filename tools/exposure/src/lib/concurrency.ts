/* ---------------------------------------------------------------------------
   Bounded concurrency.

   Two stages dominated a run's wall clock for the same reason: they awaited one
   independent network call before starting the next. Measured on a fresh
   eight-peer run before this existed:

     01 subject          48.0s   one map, then twelve scrapes in series
     02 peers             1.9s
     03 peer evidence   181.0s   eight peer lookups in series, ~20s each
     04 demand            6.5s
     TOTAL              185.4s

   Nothing about either loop needed ordering. That serialisation was also a
   product decision by accident: three minutes is an awkward wait — too long to
   watch a spinner, too short for an email round trip to feel worth it — while
   under two minutes is a wait you can show someone alongside something useful
   to do.

   The per-host rate limiter in ./http.ts still applies underneath, so
   concurrent work is spaced by each host's minimum interval rather than fired
   in a burst. We overlap latency without becoming impolite, which is why the
   caps here stay modest.
--------------------------------------------------------------------------- */

/**
 * Run `fn` over `items` with at most `limit` in flight, preserving input order
 * in the results. A rejection propagates, cancelling nothing already started.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Peers researched at once in stage 03. */
export const PEER_CONCURRENCY = 6;

/** Pages scraped at once in stage 01. */
export const PAGE_CONCURRENCY = 6;
