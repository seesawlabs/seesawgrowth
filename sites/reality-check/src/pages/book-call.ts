/* ---------------------------------------------------------------------------
   /book-call — a stable redirect to whatever calendar we are using today.

   WHY THIS EXISTS. A brief is a document. Its "book the hour" link is written
   into the HTML at render time and then sits in a client's inbox for a month,
   so a raw calendar URL baked into it is a link that dies the day we change
   scheduling tools — silently, in every brief we ever sent. Pointing the
   document at our own origin instead means the calendar is one environment
   variable and every brief already in the wild follows it.

   NOT /book, which is the Reality Check qualifier — six questions before a
   time slot. Someone arriving from a brief has already told us who they are.
--------------------------------------------------------------------------- */
import type { APIRoute } from 'astro';
import { serverEnv } from '../lib/server-env';

export const prerender = false;

export const GET: APIRoute = ({ redirect }) => {
  const link = serverEnv('PUBLIC_CAL_LINK');

  /* No calendar configured. The qualifier is the honest destination here — it
     ends in a scheduler when one exists, and asks for a time by hand when it
     does not — but it is a fallback, not the design. */
  if (!link) {
    console.warn('[book-call] PUBLIC_CAL_LINK unset — falling back to /book');
    return redirect('/book', 302);
  }

  const url = new URL(link);
  url.searchParams.set('hide_event_type_details', '1');
  /* 302, not 301: a permanent redirect would be cached by the client's browser
     and outlive the next calendar change, which is the whole problem. */
  return redirect(url.toString(), 302);
};
