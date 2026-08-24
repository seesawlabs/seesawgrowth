/* ---------------------------------------------------------------------------
   Credentials.

   Two jobs, both about failing early and failing loudly:

     1. Load `.env` if it exists, without ever overriding a real environment
        variable. On the Claude Code environment the keys are set on the
        environment; locally they're in a gitignored `.env`. Same code path.

     2. Check presence, and *never* print a value. A missing key must produce
        a message you can act on without a key ending up in a transcript, a
        log file, or a CI artifact.

   Presence is not validity — a key can be set and still rejected. Stages that
   can verify cheaply (DataForSEO has a free auth endpoint) do so before
   spending anything; see `src/lib/clients/dataforseo.ts`.
--------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CREDENTIALS = [
  'FIRECRAWL_API_KEY',
  'EXA_API_KEY',
  'PERPLEXITY_API_KEY',
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD',
  'ANTHROPIC_API_KEY',
] as const;

export type CredentialName = (typeof CREDENTIALS)[number];

/** Which credentials each stage cannot run without. */
export const STAGE_CREDENTIALS: Record<string, CredentialName[]> = {
  '01-subject': ['FIRECRAWL_API_KEY'],
  '02-peers': ['EXA_API_KEY'],
  '03-peer-evidence': ['PERPLEXITY_API_KEY', 'FIRECRAWL_API_KEY'],
  '04-demand': ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'],
};

/**
 * Minimal `.env` parser: `KEY=value`, `#` comments, optional surrounding
 * quotes. Existing environment variables always win, so the environment is
 * authoritative and the file is only a local convenience.
 */
export function loadDotEnv(dir: string): string[] {
  let raw: string;
  try {
    raw = readFileSync(join(dir, '.env'), 'utf8');
  } catch {
    return [];
  }
  const loaded: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && /^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    if (!value) continue;
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
      loaded.push(key);
    }
  }
  return loaded;
}

export interface CredentialStatus {
  name: string;
  present: boolean;
  /** Length only. Enough to spot a truncated paste; reveals nothing usable. */
  length: number;
}

export function credentialStatus(names: readonly string[] = CREDENTIALS): CredentialStatus[] {
  return names.map((name) => {
    const value = process.env[name] ?? '';
    return { name, present: value.trim().length > 0, length: value.trim().length };
  });
}

export function missingCredentials(names: readonly string[]): string[] {
  return credentialStatus(names)
    .filter((s) => !s.present)
    .map((s) => s.name);
}

/** Reads a credential, throwing rather than sending an empty Authorization header. */
export function requireCredential(name: CredentialName | string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is not set — see tools/exposure/.env.example`);
  return value;
}

/**
 * Human-readable presence table. Values never appear, by construction.
 * The budget ceiling is reported here too because a run that silently uses a
 * default ceiling is a run that can surprise you on the invoice.
 */
export function formatCredentialReport(names: readonly string[] = CREDENTIALS): string {
  const rows = credentialStatus(names).map(
    (s) => `  ${s.present ? 'set    ' : 'MISSING'}  ${s.name}${s.present ? ` (${s.length} chars)` : ''}`
  );
  const budget = process.env.EXPOSURE_RUN_BUDGET_USD;
  rows.push(`  ${budget ? 'set    ' : 'default'}  EXPOSURE_RUN_BUDGET_USD${budget ? ` (${budget})` : ' (5)'}`);
  return rows.join('\n');
}

/**
 * Gate for a single stage. Returns the missing names rather than throwing so
 * the caller can decide between skipping the stage and aborting the run —
 * a run that produces four good stages and one honest gap is worth more than
 * a run that produces nothing.
 */
export function checkStage(stage: string): { ok: boolean; missing: string[] } {
  const needed = STAGE_CREDENTIALS[stage] ?? [];
  const missing = missingCredentials(needed);
  return { ok: missing.length === 0, missing };
}
