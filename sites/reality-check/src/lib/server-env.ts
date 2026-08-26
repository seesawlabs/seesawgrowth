/* ---------------------------------------------------------------------------
   Read configuration at runtime, not at build time.

   THE BUG THIS EXISTS TO PREVENT, because it cost a debugging session and it
   fails silently. Vite statically replaces `import.meta.env.ANYTHING` while
   bundling. In the built server chunk, `import.meta.env.SLACK_WEBHOOK` became
   the literal `undefined`, so `if (!hook) { log("skipped"); return; }` was
   evaluated at build time and the `fetch` below it was eliminated from the
   bundle entirely. The deployed function could not post to Slack no matter what
   the dashboard said, and its own log line claimed the variable was unset.

   Two consequences, both bad. A secret added or rotated in the dashboard does
   nothing until the next build, which nobody expects of a server environment
   variable. And the values that *are* present at build time get baked into the
   deployed JavaScript, which is not where secrets belong.

   So: `process.env` first, which on Vercel and Node is the live environment.
   `import.meta.env` second, because `astro dev` loads `.env` into that and not
   into `process.env`. The dynamic key lookup is deliberate — Vite cannot
   statically replace an index expression, so this file cannot be inlined into
   the same trap it exists to avoid.

   PUBLIC_-prefixed values used in client code are a separate matter: those are
   meant to be inlined, and changing one does need a rebuild.
--------------------------------------------------------------------------- */

const clean = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

export function serverEnv(name: string): string | undefined {
  const live = typeof process !== 'undefined' ? clean(process.env?.[name]) : undefined;
  if (live) return live;
  const baked = (import.meta.env as unknown as Record<string, unknown>)?.[name];
  return clean(baked);
}

/**
 * Which integrations are actually configured, as booleans. Never values.
 *
 * The reason this exists: "I set the webhook and submitted the form and nothing
 * arrived" took a build-output inspection to diagnose, when it should have
 * taken one request. See /api/health.
 */
export function configuredIntegrations(): Record<string, boolean> {
  return {
    slack: Boolean(serverEnv('SLACK_WEBHOOK')),
    resend: Boolean(serverEnv('RESEND_TOKEN')),
    calendar: Boolean(serverEnv('PUBLIC_CAL_LINK')),
    linkSecret: Boolean(serverEnv('EXPOSURE_LINK_SECRET')),
    reportStore: Boolean(serverEnv('EXPOSURE_REPORT_BASE_URL') || serverEnv('EXPOSURE_REPORT_DIR')),
    crm: Boolean(serverEnv('HUBSPOT_TOKEN')),
  };
}
