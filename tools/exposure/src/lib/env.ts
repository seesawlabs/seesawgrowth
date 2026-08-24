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

/**
 * Alternative environment-variable names, tried in order after the canonical
 * one.
 *
 * `ANTHROPIC_API_KEY` does not survive to this process on the Claude Code
 * environment. It has been set there and confirmed absent on four consecutive
 * fresh sessions, while a second variable carrying the identical value under a
 * different name arrives intact — so something between the environment and the
 * process is filtering on the name itself, not on the value. `.env` files, the
 * dotenv loader above and every other credential are unaffected.
 *
 * Probed 2026-08-24: ANTHROPIC_API_KEY absent, EXPOSURE_ANTHROPIC_KEY present
 * at 108 chars.
 *
 * This is a workaround for someone else's bug, so it stays visible rather than
 * tidy: `credentialStatus()` reports which name actually carried the value, so
 * the day the canonical name starts working again is the day the report says so
 * and this entry can be deleted.
 */
export const CREDENTIAL_ALIASES: Record<string, readonly string[]> = {
  ANTHROPIC_API_KEY: ['EXPOSURE_ANTHROPIC_KEY'],
};

/** Every name that can supply a credential, canonical first. */
export function credentialNames(name: string): string[] {
  return [name, ...(CREDENTIAL_ALIASES[name] ?? [])];
}

/**
 * First non-empty value across the canonical name and its aliases, together
 * with the name that supplied it. Returns null rather than an empty string so
 * callers cannot accidentally send a blank Authorization header.
 */
export function resolveCredential(name: string): { source: string; value: string } | null {
  for (const candidate of credentialNames(name)) {
    const value = (process.env[candidate] ?? '').trim();
    if (value) return { source: candidate, value };
  }
  return null;
}

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
  /**
   * The environment variable the value actually came from. Differs from `name`
   * when an alias supplied it; null when nothing did.
   */
  source: string | null;
}

export function credentialStatus(names: readonly string[] = CREDENTIALS): CredentialStatus[] {
  return names.map((name) => {
    const found = resolveCredential(name);
    return {
      name,
      present: found !== null,
      length: found?.value.length ?? 0,
      source: found?.source ?? null,
    };
  });
}

export function missingCredentials(names: readonly string[]): string[] {
  return credentialStatus(names)
    .filter((s) => !s.present)
    .map((s) => s.name);
}

/** Reads a credential, throwing rather than sending an empty Authorization header. */
export function requireCredential(name: CredentialName | string): string {
  const found = resolveCredential(name);
  if (!found) {
    const tried = credentialNames(name);
    const where = tried.length > 1 ? `${tried.join(' or ')} are` : `${name} is`;
    throw new Error(`${where} not set — see tools/exposure/.env.example`);
  }
  return found.value;
}

/**
 * Human-readable presence table. Values never appear, by construction.
 * The budget ceiling is reported here too because a run that silently uses a
 * default ceiling is a run that can surprise you on the invoice.
 */
export function formatCredentialReport(names: readonly string[] = CREDENTIALS): string {
  const rows = credentialStatus(names).map((s) => {
    if (!s.present) return `  MISSING  ${s.name}`;
    const via = s.source && s.source !== s.name ? ` via ${s.source}` : '';
    return `  set      ${s.name} (${s.length} chars${via})`;
  });
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
