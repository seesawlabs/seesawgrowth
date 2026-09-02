/* ---------------------------------------------------------------------------
   Fire the analysis workflow on GitHub Actions.

   Two callers: the intake endpoint, which dispatches the moment a lead lands
   when EXPOSURE_AUTORUN is on, and /api/run, which dispatches when a person
   clicks a signed link in Slack. Same request either way, so it lives once.

   The inputs mirror .github/workflows/analysis.yml exactly. GitHub caps a
   workflow_dispatch at ten inputs, and this is all ten — adding one here
   without adding it there is a 422 on every dispatch.
--------------------------------------------------------------------------- */

export const REPO = 'seesawlabs/seesawgrowth';
export const WORKFLOW = 'analysis.yml';
export const DEFAULT_REF = 'claude/seesaw-labs-growth-u5ou0b';

export type DispatchMode = 'run' | 'revise' | 'send';

export interface DispatchInputs {
  mode: DispatchMode;
  domain: string;
  email: string;
  name: string;
  company: string;
  category?: string;
  peers?: string[];
  trigger?: string;
  runId?: string;
  notes?: string;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  body: string;
}

/**
 * The prompt that reads `trigger` is the one place a very long paste costs
 * money, so it is bounded here rather than at the form. The full text still
 * reaches the team in Slack.
 */
export const TRIGGER_MAX_FOR_PIPELINE = 2_000;

export async function dispatchAnalysis(
  inputs: DispatchInputs,
  env: { token: string; ref?: string }
): Promise<DispatchResult> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ref: env.ref ?? DEFAULT_REF,
        inputs: {
          mode: inputs.mode,
          domain: inputs.domain,
          email: inputs.email,
          name: inputs.name,
          company: inputs.company,
          category: inputs.category ?? '',
          peers: (inputs.peers ?? []).join(','),
          trigger: (inputs.trigger ?? '').slice(0, TRIGGER_MAX_FOR_PIPELINE),
          runId: inputs.runId ?? '',
          notes: inputs.notes ?? '',
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  const body = res.status === 204 ? '' : await res.text().catch(() => '');
  return { ok: res.status === 204, status: res.status, body };
}
