/* ---------------------------------------------------------------------------
   Credentials and configuration.

   Two rules here. Values are never logged — only presence and length, because
   a transcript is a bad place for a live key. And a missing credential fails
   the stage that needs it, loudly, rather than letting the pipeline produce a
   thin report that looks like a real one.

   `.env` is read as a fallback because environment variables on the Claude
   Code environment are fixed when a container starts: a key added mid-session
   only reaches the process through the file.
--------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Credential =
  | 'FIRECRAWL_API_KEY'
  | 'EXA_API_KEY'
  | 'PERPLEXITY_API_KEY'
  | 'DATAFORSEO_LOGIN'
  | 'DATAFORSEO_PASSWORD'
  | 'ANTHROPIC_API_KEY';

export const ALL_CREDENTIALS: Credential[] = [
  'FIRECRAWL_API_KEY',
  'EXA_API_KEY',
  'PERPLEXITY_API_KEY',
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD',
  'ANTHROPIC_API_KEY',
];

/** Which credentials each stage cannot run without. */
export const STAGE_CREDENTIALS: Record<string, Credential[]> = {
  '01-subject': ['FIRECRAWL_API_KEY', 'ANTHROPIC_API_KEY'],
  '02-peers': ['EXA_API_KEY'],
  '03-peer-evidence': ['PERPLEXITY_API_KEY'],
  '04-demand': ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'],
};

/**
 * Parses `KEY=value` lines. Deliberately minimal: no interpolation, no
 * multi-line values, no `export` prefix handling beyond stripping it. A
 * credential file that needs a real parser is a credential file that should
 * be environment variables instead.
 */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Real environment wins; `.env` only fills gaps. */
export function loadDotEnv(root: string): void {
  let text: string;
  try {
    text = readFileSync(join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(parseDotEnv(text))) {
    if (!process.env[key] && value) process.env[key] = value;
  }
}

export function credential(name: Credential): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. See tools/exposure/README.md "Credentials" — ` +
        'set it on the environment, or in tools/exposure/.env for this session.'
    );
  }
  return value;
}

export function isPresent(name: Credential): boolean {
  return Boolean(process.env[name]?.trim());
}

export interface CredentialReport {
  name: Credential;
  present: boolean;
  /** Length only. The value itself is never surfaced. */
  length: number;
}

export function credentialReport(): CredentialReport[] {
  return ALL_CREDENTIALS.map((name) => {
    const value = process.env[name]?.trim() ?? '';
    return { name, present: value.length > 0, length: value.length };
  });
}

/** Names of credentials a stage needs but does not have. */
export function missingFor(stage: string): Credential[] {
  return (STAGE_CREDENTIALS[stage] ?? []).filter((c) => !isPresent(c));
}

export function runBudgetUsd(): number {
  const raw = process.env.EXPOSURE_RUN_BUDGET_USD?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
