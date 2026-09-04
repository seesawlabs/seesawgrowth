/* ---------------------------------------------------------------------------
   Run artifacts.

   Each stage writes its output as JSON into a run directory. Later stages read
   those files rather than calling earlier stages, so any stage can be re-run
   alone — which is the whole point of doing this as scripts first.

   runs/<domain>/<runId>/
     00-meta.json         subject, runId, timestamps
     01-subject.json       their own public surface
     02-peers.json         candidate competitive set
     03-peer-evidence.json dated AI moves per peer
     04-demand.json        category demand signals
     claims.json           everything, graded
     coverage.json         whether this is worth sending
     report.md             the deliverable
--------------------------------------------------------------------------- */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface RunMeta {
  runId: string;
  domain: string;
  startedAt: string;
  /**
   * What we call them in the document. Recorded here so a re-render produces
   * the same masthead as the original run — scripts/rerender.mjs had to be
   * given it by hand, which meant a re-rendered brief could quietly be
   * addressed to a bare domain.
   */
  companyName?: string;
  /** Free-text from intake: "what's driving this right now". */
  trigger?: string;
  /** Optional intake hint: where they'd most want AI to help. */
  focus?: string;
  /** 'cold' when the recipient did not ask for anything; the email is written differently. */
  audience?: 'lead' | 'cold';
}

export function runDir(root: string, domain: string, runId: string): string {
  return join(root, 'runs', domain.replace(/[^a-z0-9.-]/gi, '_'), runId);
}

export async function initRun(root: string, meta: RunMeta): Promise<string> {
  const dir = runDir(root, meta.domain, meta.runId);
  await mkdir(dir, { recursive: true });
  await writeArtifact(dir, '00-meta', meta);
  return dir;
}

export async function writeArtifact(dir: string, name: string, data: unknown): Promise<string> {
  const file = join(dir, `${name}.json`);
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
  return file;
}

export async function readArtifact<T>(dir: string, name: string): Promise<T> {
  const raw = await readFile(join(dir, `${name}.json`), 'utf8');
  return JSON.parse(raw) as T;
}

export async function tryReadArtifact<T>(dir: string, name: string): Promise<T | null> {
  try {
    return await readArtifact<T>(dir, name);
  } catch {
    return null;
  }
}

/** Most recent run for a domain, by lexical runId (ISO timestamps sort). */
export async function latestRun(root: string, domain: string): Promise<string | null> {
  const base = join(root, 'runs', domain.replace(/[^a-z0-9.-]/gi, '_'));
  try {
    const entries = await readdir(base);
    const sorted = entries.filter((e) => !e.startsWith('.')).sort();
    const last = sorted.at(-1);
    return last ? join(base, last) : null;
  } catch {
    return null;
  }
}
