/* ---------------------------------------------------------------------------
   The one booking URL, built in one place.

   Two routes need it: the intake endpoint hands it to the confirmation screen,
   and /api/booking hands it to the form when a visitor chooses to book before
   answering anything. Both read PUBLIC_CAL_LINK at request time through
   serverEnv, so repointing the calendar is a dashboard change and not a deploy.
--------------------------------------------------------------------------- */
import { serverEnv } from './server-env';

export function bookingUrl(): string | undefined {
  const link = serverEnv('PUBLIC_CAL_LINK');
  if (!link) return undefined;
  try {
    const url = new URL(link);
    url.searchParams.set('hide_event_type_details', '1');
    return url.toString();
  } catch {
    return undefined;
  }
}
