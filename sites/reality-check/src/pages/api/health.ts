/* ---------------------------------------------------------------------------
   GET /api/health — which integrations are actually live, as booleans.

   Exists because "I set the Slack webhook, submitted the form, and nothing
   arrived" took inspecting the built server bundle to diagnose. It should take
   one request. Now it does.

   BOOLEANS ONLY, NEVER VALUES, and no lengths or prefixes either — those leak.
   The point is to answer "is this configured in the environment this request is
   being served by", which is the question that was actually hard.

   Public on purpose. It reveals which third parties we use, which is not a
   secret and is worth less than the minutes it saves. If that stops being true,
   gate it behind a header rather than deleting it.
--------------------------------------------------------------------------- */
import type { APIRoute } from 'astro';
import { configuredIntegrations, serverEnv } from '../../lib/server-env';

export const prerender = false;

export const GET: APIRoute = () => {
  const integrations = configuredIntegrations();
  const missing = Object.entries(integrations)
    .filter(([, on]) => !on)
    .map(([name]) => name);

  return new Response(
    JSON.stringify(
      {
        ok: true,
        /* The two that break the flow rather than degrade it: without Slack a
           request reaches nobody, and without the secret every link fails. */
        blocking: [
          !integrations.slack && 'slack',
          !integrations.linkSecret && 'linkSecret',
        ].filter(Boolean),
        integrations,
        missing,
        deployment: serverEnv('VERCEL_ENV') ?? 'local',
        commit: serverEnv('VERCEL_GIT_COMMIT_SHA')?.slice(0, 7) ?? null,
      },
      null,
      2
    ),
    { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
  );
};
