/* ---------------------------------------------------------------------------
   /api/run — the "just run it" link from the Slack alert.

   GET renders a confirmation page. POST fires the GitHub Actions workflow that
   does the work. That split is not ceremony: Slack fetches links to build
   previews, and so do mail clients and phone prefetchers, so a GET that
   started a $1.90 job would be spent by a bot before a human read the message.

   The token is the authorisation and the payload — see lib/run-link.ts. This
   route holds no state and needs no database; what the pipeline receives is
   provably what the form collected.
--------------------------------------------------------------------------- */
import type { APIRoute } from 'astro';
import { verifyActionToken, type RunPayload } from '../../lib/run-link';
import { serverEnv } from '../../lib/server-env';

export const prerender = false;

const REPO = 'seesawlabs/seesawgrowth';
const WORKFLOW = 'analysis.yml';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    background:#f7f6f3; color:#1a1a1a; }
  .card { max-width:32rem; background:#fff; border-radius:14px; padding:32px 28px;
    box-shadow:0 1px 3px rgba(0,0,0,.08); }
  h1 { font-size:1.35rem; margin:0 0 12px; letter-spacing:-.01em; }
  p { margin:0 0 14px; line-height:1.6; }
  dl { margin:20px 0; display:grid; grid-template-columns:auto 1fr; gap:6px 14px; font-size:.92rem; }
  dt { color:#6b6b6b; } dd { margin:0; }
  button { font:inherit; font-weight:600; background:#1a1a1a; color:#fff; border:0;
    border-radius:9px; padding:13px 22px; cursor:pointer; }
  .muted { color:#6b6b6b; font-size:.88rem; }
  code { background:#f2f1ee; padding:2px 5px; border-radius:4px; font-size:.88em; }
  a { color:#1a1a1a; }
</style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

function badToken(reason: string): Response {
  const why =
    reason === 'expired'
      ? 'This link has expired. Submit a fresh one from the Slack alert, or run it from the command line.'
      : reason === 'no_secret'
        ? 'EXPOSURE_LINK_SECRET is not set on this deployment, so no link can be verified.'
        : 'This link is not valid. It may have been truncated by a chat client.';
  return page('Link not valid', `<h1>Can&rsquo;t use that link</h1><p>${esc(why)}</p>`, 400);
}

const detail = (p: RunPayload) => `<dl>
  <dt>Company</dt><dd>${esc(p.company)}</dd>
  <dt>Domain</dt><dd>${esc(p.domain)}</dd>
  <dt>For</dt><dd>${esc(p.name)} &lt;${esc(p.email)}&gt;</dd>
  <dt>Category</dt><dd>${esc(p.category)}</dd>
  ${p.peers.length ? `<dt>Named peers</dt><dd>${esc(p.peers.join(', '))}</dd>` : ''}
</dl>`;

const TITLES: Record<RunPayload['a'], string> = {
  run: 'Run the analysis?',
  send: 'Send the analysis?',
  revise: 'Revise the analysis?',
};

export const GET: APIRoute = ({ url }) => {
  const token = url.searchParams.get('t') ?? '';
  const verdict = verifyActionToken(token, serverEnv('EXPOSURE_LINK_SECRET') ?? '');
  if (!verdict.ok) return badToken(verdict.reason);

  const p = verdict.payload;

  const explain =
    p.a === 'run'
      ? 'This spends about <strong>$1.90</strong> of research budget and takes about nine minutes. It posts back to Slack with a link to read before anything is sent.'
      : p.a === 'send'
        ? 'This emails the private link to the recipient below. Only do this if you have read the analysis.'
        : 'This rewrites the draft to fit your notes, reusing the research already done. It costs a few cents rather than the full run, and takes under a minute.';

  /* Notes are not part of the token. They are decided after reading the
     document, which is after the link was minted, so they can only travel in
     the form submission. See lib/run-link.ts for what a signature here does
     and does not authorise. */
  const notesField =
    p.a === 'revise'
      ? `<label style="display:block;margin:4px 0 18px">
           <span class="muted" style="display:block;margin-bottom:6px">What should change</span>
           <textarea name="notes" required rows="4" placeholder="e.g. Reframe the second idea around onboarding paperwork instead of scheduling. Leave the rest alone."
             style="width:100%;font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #d8d6d0;resize:vertical"></textarea>
         </label>`
      : '';

  return page(
    TITLES[p.a],
    `<h1>${TITLES[p.a]}</h1>
     <p>${explain}</p>
     ${detail(p)}
     <form method="POST">
       <input type="hidden" name="t" value="${esc(token)}">
       ${notesField}
       <button type="submit">${p.a === 'run' ? 'Run it' : p.a === 'send' ? 'Send it' : 'Revise it'}</button>
     </form>
     <p class="muted" style="margin-top:18px">Nothing has happened yet. Closing this page does nothing.</p>`
  );
};

export const POST: APIRoute = async ({ request }) => {
  /* The token comes from the form, not the query string: a POST is what acts,
     and it should carry its own authorisation rather than inherit a URL. */
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('t') ?? '');
  const verdict = verifyActionToken(token, serverEnv('EXPOSURE_LINK_SECRET') ?? '');
  if (!verdict.ok) return badToken(verdict.reason);

  const notes = String(form?.get('notes') ?? '').trim();
  if (verdict.payload.a === 'revise' && !notes) {
    return page(
      'Nothing to revise with',
      `<h1>Say what should change</h1>
       <p>A revise needs notes. Go back and describe what to fix.</p>`,
      400
    );
  }

  const ghToken = serverEnv('GITHUB_DISPATCH_TOKEN');
  if (!ghToken) {
    return page(
      'Runner not configured',
      `<h1>No runner configured</h1>
       <p>GITHUB_DISPATCH_TOKEN is not set, so there is nothing to fire. The
       command-line path still works:</p>
       <p><code>npm run fulfil -- --domain ${esc(verdict.payload.domain)} …</code></p>`,
      503
    );
  }

  const p = verdict.payload;
  const ref = serverEnv('GITHUB_DISPATCH_REF') ?? 'claude/seesaw-labs-growth-u5ou0b';

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ghToken}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ref,
        inputs: {
          mode: p.a,
          domain: p.domain,
          email: p.email,
          name: p.name,
          company: p.company,
          category: p.category,
          peers: p.peers.join(','),
          trigger: p.trigger ?? '',
          runId: p.run ?? '',
          notes,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (res.status !== 204) {
    const body = await res.text().catch(() => '');
    console.error(`[run] dispatch failed ${res.status}: ${body.slice(0, 300)}`);
    return page(
      'Could not start it',
      `<h1>GitHub refused that</h1>
       <p>Status ${res.status}. Common causes: the token lacks <code>Actions:
       write</code>, the workflow file is not on <code>${esc(ref)}</code> yet, or
       the branch name is wrong.</p>
       <p class="muted">${esc(body.slice(0, 300))}</p>`,
      502
    );
  }

  console.log(`[run] dispatched mode=${p.a} domain=${p.domain}`);
  const startedHead = p.a === 'run' ? 'Running now' : p.a === 'send' ? 'Sending now' : 'Revising now';
  const startedBody =
    p.a === 'run'
      ? 'About nine minutes. It posts back to Slack with the coverage figure and a link to read.'
      : p.a === 'send'
        ? 'The email is on its way, and Slack will confirm.'
        : 'Under a minute — it only rewrites, it does not re-research. Slack gets a fresh read/send/revise set when it lands.';
  return page(
    'Started',
    `<h1>${startedHead}</h1>
     <p>${startedBody}</p>
     ${detail(p)}
     <p><a href="https://github.com/${REPO}/actions/workflows/${WORKFLOW}">Watch the run &rarr;</a></p>`
  );
};
