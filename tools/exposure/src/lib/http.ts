/* ---------------------------------------------------------------------------
   Polite HTTP: robots.txt, per-host rate limiting, bounded retries.

   This runs unattended, once per form submission, against companies we want to
   sell to. Getting our crawler blocked — or worse, noticed as rude — is a
   sales problem, not just an engineering one. So the rules are in the transport
   layer from the start rather than retrofitted per stage.

   Firecrawl performs the actual page fetch, but the decision to request a page
   is ours, so robots.txt is checked here before we ask Firecrawl for anything.
   Delegating the fetch does not delegate the obligation.
--------------------------------------------------------------------------- */

export const USER_AGENT = 'SeeSawExposureBot/0.1 (+https://seesawlabs.com; contact calvin@seesawlabs.com)';

/** Our robots.txt token, lowercase, for User-agent group matching. */
const UA_TOKEN = 'seesawexposurebot';

const DEFAULT_MIN_INTERVAL_MS = 1500;

/* -- rate limiting ------------------------------------------------------ */

const lastRequestAt = new Map<string, number>();
const hostDelayMs = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function setHostDelay(host: string, ms: number): void {
  hostDelayMs.set(host, Math.max(hostDelayMs.get(host) ?? 0, ms));
}

/** Serialises requests per host at >= the host's delay. */
export async function throttle(host: string): Promise<void> {
  const min = hostDelayMs.get(host) ?? DEFAULT_MIN_INTERVAL_MS;
  const last = lastRequestAt.get(host);
  const now = Date.now();
  if (last !== undefined) {
    const wait = last + min - now;
    if (wait > 0) await sleep(wait);
  }
  lastRequestAt.set(host, Date.now());
}

/* -- robots.txt --------------------------------------------------------- */

interface RobotsRule {
  allow: boolean;
  path: string;
}

export interface Robots {
  host: string;
  /** No robots.txt, or a 4xx, means unrestricted — that is the standard's default. */
  fetched: boolean;
  rules: RobotsRule[];
  crawlDelayMs?: number;
}

/**
 * Parses the groups that apply to us: our own token if present, else `*`.
 * A specific token wins outright over `*`, which is what the standard says and
 * what a site owner means when they name a bot.
 */
export function parseRobots(host: string, body: string): Robots {
  const lines = body.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());

  // Collect agent groups: each is a set of user-agent tokens plus directives.
  const groups: { agents: string[]; rules: RobotsRule[]; crawlDelay?: number }[] = [];
  let current: (typeof groups)[number] | null = null;
  let inAgentBlock = false;

  for (const line of lines) {
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!inAgentBlock || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
        inAgentBlock = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    inAgentBlock = false;
    if (!current) continue;
    if (field === 'disallow') current.rules.push({ allow: false, path: value });
    else if (field === 'allow') current.rules.push({ allow: true, path: value });
    else if (field === 'crawl-delay') {
      const secs = Number(value);
      if (Number.isFinite(secs) && secs > 0) current.crawlDelay = secs;
    }
  }

  const named = groups.filter((g) => g.agents.some((a) => UA_TOKEN.includes(a) || a === UA_TOKEN));
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  const applicable = named.length > 0 ? named : wildcard;

  const rules = applicable.flatMap((g) => g.rules);
  const delays = applicable.map((g) => g.crawlDelay).filter((d): d is number => typeof d === 'number');

  return {
    host,
    fetched: true,
    rules,
    crawlDelayMs: delays.length > 0 ? Math.max(...delays) * 1000 : undefined,
  };
}

/** robots.txt pattern match: `*` is any run, `$` anchors the end. */
function matches(pattern: string, path: string): boolean {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(path);
}

/**
 * Longest-match-wins, allow beating disallow on a tie. That tie-breaking is
 * what keeps a broad `Disallow: /` plus a narrow `Allow: /help/` working the
 * way the site owner intended.
 */
export function isAllowed(robots: Robots, url: string): boolean {
  if (!robots.fetched || robots.rules.length === 0) return true;
  let path: string;
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch {
    return false;
  }
  let best: { len: number; allow: boolean } | null = null;
  for (const rule of robots.rules) {
    if (!matches(rule.path, path)) continue;
    const len = rule.path.length;
    if (!best || len > best.len || (len === best.len && rule.allow)) best = { len, allow: rule.allow };
  }
  return best ? best.allow : true;
}

const robotsCache = new Map<string, Robots>();

export async function robotsFor(url: string): Promise<Robots> {
  let host: string;
  let origin: string;
  try {
    const u = new URL(url);
    host = u.host;
    origin = u.origin;
  } catch {
    return { host: '', fetched: false, rules: [] };
  }
  const cached = robotsCache.get(host);
  if (cached) return cached;

  let robots: Robots = { host, fetched: false, rules: [] };
  try {
    await throttle(host);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      robots = parseRobots(host, await res.text());
    } else {
      // 404 or 403 on robots.txt means no restrictions were published.
      await res.body?.cancel();
    }
  } catch {
    // Unreachable robots.txt is not permission to ignore it, but it is also
    // not a reason to abandon the run; treat as unrestricted and stay slow.
  }
  if (robots.crawlDelayMs) setHostDelay(host, robots.crawlDelayMs);
  robotsCache.set(host, robots);
  return robots;
}

/** Convenience: may we fetch this URL at all? */
export async function mayFetch(url: string): Promise<{ allowed: boolean; reason?: string }> {
  const robots = await robotsFor(url);
  if (!isAllowed(robots, url)) return { allowed: false, reason: `robots.txt on ${robots.host} disallows it` };
  return { allowed: true };
}

/* -- retrying JSON transport -------------------------------------------- */

export interface HttpError extends Error {
  status?: number;
  body?: string;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);

export interface PostJsonOptions {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: unknown;
  attempts?: number;
  timeoutMs?: number;
  /** Rate-limit key. Defaults to the request host. */
  throttleHost?: string;
}

/**
 * One JSON call with bounded exponential backoff. Honours `Retry-After` when
 * the server sends one — a server telling us how long to wait is better
 * information than our backoff schedule.
 */
export async function jsonRequest<T>(url: string, opts: PostJsonOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const host = opts.throttleHost ?? new URL(url).host;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const backoff = 2000 * 2 ** (attempt - 1);
      await sleep(backoff);
    }
    await throttle(host);
    try {
      const res = await fetch(url, {
        method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
        headers: {
          'user-agent': USER_AGENT,
          ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
      });

      const text = await res.text();
      if (!res.ok) {
        const err: HttpError = new Error(`${res.status} ${res.statusText} from ${url}: ${text.slice(0, 400)}`);
        err.status = res.status;
        err.body = text;
        if (RETRYABLE.has(res.status) && attempt < attempts - 1) {
          const retryAfter = Number(res.headers.get('retry-after'));
          if (Number.isFinite(retryAfter) && retryAfter > 0) await sleep(Math.min(retryAfter, 60) * 1000);
          lastError = err;
          continue;
        }
        throw err;
      }
      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      const status = (error as HttpError).status;
      // Don't retry a definitive rejection — a bad key stays bad.
      if (status !== undefined && !RETRYABLE.has(status)) throw error;
      if (attempt === attempts - 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
