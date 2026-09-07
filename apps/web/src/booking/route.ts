/**
 * Which page the URL means.
 *
 * No router library: there are two routes, neither has a nested layout, and
 * `react-router` is 12 KB of history stack, transitions and data loaders that
 * this page would use none of.
 *
 * Two shapes reach it. `/book/…` is the short link a clinic hands out;
 * `/booking/manage/…` is what the API already writes into the confirmation
 * SMS. The second is deliberately narrow — the dashboard owns everything else
 * under `/booking/`, and a wider rule swallowed `/booking/pending`.
 */
export type BookingRoute =
  | { readonly kind: 'book'; readonly slug: string }
  | { readonly kind: 'manage'; readonly token: string; readonly slug: string | undefined }
  | { readonly kind: 'unknown' };

export function parseRoute(pathname: string, search = ''): BookingRoute {
  const prefix = pathname.startsWith('/booking/manage/')
    ? '/booking/'
    : pathname.startsWith('/book/')
      ? '/book/'
      : undefined;

  if (!prefix) {
    return { kind: 'unknown' };
  }

  const parts = pathname
    .slice(prefix.length)
    .split('/')
    .filter((part) => part !== '');

  if (parts[0] === 'manage' && parts[1]) {
    return {
      kind: 'manage',
      token: decodeURIComponent(parts[1]),
      slug: clinicSlugFor(decodeURIComponent(parts[1]), search),
    };
  }

  return parts[0] ? { kind: 'book', slug: decodeURIComponent(parts[0]) } : { kind: 'unknown' };
}

const STORAGE_PREFIX = 'clinic.booking.';

/**
 * Which clinic a manage link belongs to.
 *
 * The token names the appointment, not the clinic, and the SMS link carries no
 * slug — so rescheduling, which needs the clinic's slot endpoint, has nothing
 * to ask with. Two ways round it, in order: a `?clinic=` on the link, and what
 * this browser remembered when it made the booking. Neither is guaranteed
 * (a link opened on a different phone has neither), and where both come up
 * empty the manage page offers the clinic's number instead of an empty grid.
 * Cancelling never needs this — the token alone is enough.
 */
function clinicSlugFor(token: string, search: string): string | undefined {
  const fromQuery = new URLSearchParams(search).get('clinic');

  if (fromQuery) {
    return fromQuery;
  }

  try {
    return window.localStorage.getItem(STORAGE_PREFIX + token) ?? undefined;
  } catch {
    // Site data blocked. The page still cancels; it just cannot reschedule.
    return undefined;
  }
}

/** Called once a booking exists, so this browser can manage it later. */
export function rememberClinic(token: string, slug: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + token, slug);
  } catch {
    // A refused write costs rescheduling from this device, nothing more.
  }
}
