/* ---------------------------------------------------------------------------
   Where a rendered Opportunity Brief lives between generation and reading.

   ONE INTERFACE, THREE BACKENDS, because the storage decision is not made yet
   and blocking the magic link on it would be the wrong order. Resolution is by
   environment, most explicit first:

     EXPOSURE_REPORT_BASE_URL   fetch `<base>/<id>.html` — any bucket, CDN or
                                Vercel Blob store with a public prefix. The
                                prod path.
     EXPOSURE_REPORT_DIR        read from disk. Local dev, and the operator
                                machine that runs the pipeline.
     (neither)                  a bundled sample, so /r/<token> is reviewable
                                with no infrastructure at all.

   The ids that reach here are already constrained by `isSafeReportId`, but this
   module re-checks rather than trusting its caller: a store that builds paths
   from ids is exactly where a traversal bug would land, and the check is free.
--------------------------------------------------------------------------- */

import { isSafeReportId, storageNameFor } from './magic-link';

export type StoreKind = 'remote' | 'disk' | 'sample' | 'none';

export interface StoredReport {
  html: string;
  kind: StoreKind;
}

export interface StoreConfig {
  baseUrl?: string;
  dir?: string;
  /**
   * The link secret, used to derive the stored object name. Without it a
   * remote store cannot be read at all, which is the intended failure: an
   * unsigned guess at a filename must not resolve to a client's brief.
   */
  secret?: string;
}

/** Reads config from the environment. Astro exposes these on import.meta.env. */
export function storeConfig(env: Record<string, unknown> = {}): StoreConfig {
  const pick = (k: string) => {
    const v = env[k] ?? (typeof process !== 'undefined' ? process.env?.[k] : undefined);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  return {
    baseUrl: pick('EXPOSURE_REPORT_BASE_URL'),
    dir: pick('EXPOSURE_REPORT_DIR'),
    secret: pick('EXPOSURE_LINK_SECRET'),
  };
}

export function describeStore(cfg: StoreConfig): StoreKind {
  if (cfg.baseUrl) return 'remote';
  if (cfg.dir) return 'disk';
  return 'sample';
}

/**
 * Fetch a report by id. Returns null when it genuinely is not there — the
 * caller renders "not found" rather than an error, because a valid token
 * pointing at a missing report means an operator released a link before
 * uploading, and the reader should see something calm.
 */
export async function loadReport(
  id: string,
  cfg: StoreConfig = storeConfig()
): Promise<StoredReport | null> {
  if (!isSafeReportId(id)) return null;

  if (cfg.baseUrl) {
    /* Never the readable id — see `storageNameFor`. No secret, no read. */
    if (!cfg.secret) {
      console.error('[report-store] EXPOSURE_LINK_SECRET unset — cannot derive the stored name');
      return null;
    }
    const name = storageNameFor(id, cfg.secret);
    const url = `${cfg.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(name)}.html`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      return { html: await res.text(), kind: 'remote' };
    } catch {
      return null;
    }
  }

  if (cfg.dir) {
    try {
      const { readFile } = await import('node:fs/promises');
      const { join, resolve, sep } = await import('node:path');
      const root = resolve(cfg.dir);
      /* Same name as the remote store when a secret is available, so switching
         backends does not orphan what is already released. */
      const name = cfg.secret ? storageNameFor(id, cfg.secret) : id;
      const file = resolve(join(root, `${name}.html`));
      // Belt and braces: the id is already validated, but a path that escapes
      // the configured root is never served regardless of how it got here.
      if (file !== root && !file.startsWith(root + sep)) return null;
      return { html: await readFile(file, 'utf8'), kind: 'disk' };
    } catch {
      return null;
    }
  }

  return null;
}
