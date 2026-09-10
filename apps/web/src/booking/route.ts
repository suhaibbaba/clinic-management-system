// No router library: two routes, no nested layout. `/booking/manage/…` is deliberately narrow — the
// dashboard owns the rest of `/booking/`, and a wider rule swallowed `/booking/pending`.
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

// The token names the appointment, not the clinic: a `?clinic=` or what this browser remembered,
// and the clinic's number where both are empty.
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

export function rememberClinic(token: string, slug: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + token, slug);
  } catch {
    // A refused write costs rescheduling from this device, nothing more.
  }
}
