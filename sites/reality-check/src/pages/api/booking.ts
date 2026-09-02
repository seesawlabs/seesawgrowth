/* ---------------------------------------------------------------------------
   GET /api/booking — where the calendar lives, for the book-first path.

   The form used to learn the booking URL only from the intake response, which
   was fine when booking always came after the questions. Now a visitor can
   book first, so the form needs the URL before it has anything to submit.
   Read at request time, never inlined: see lib/server-env.ts for why.
--------------------------------------------------------------------------- */
import type { APIRoute } from 'astro';
import { bookingUrl } from '../../lib/booking';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ bookingUrl: bookingUrl() ?? null }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
