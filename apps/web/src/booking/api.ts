import type {
  BookingReceipt,
  ManagedBooking,
  PublicClinic,
  PublicDoctor,
  PublicSlots,
} from '@clinic/shared';

// Not `@web/lib/api-client`: every endpoint here is anonymous, and reusing it would drag the auth
// module into a bundle that must stay small.
const BASE = '/api/public/booking';

export type BookingFailure =
  | 'network'
  | 'slotTaken'
  | 'throttled'
  | 'closed'
  | 'notFound'
  | 'invalidLink'
  | 'invalidCode'
  | 'server'
  | 'generic';

export class BookingError extends Error {
  constructor(
    readonly failure: BookingFailure,
    readonly status?: number,
  ) {
    super(`Booking request failed: ${failure}`);
    this.name = 'BookingError';
  }
}

/** The call being made, because the same status means different things. */
type Intent = 'read' | 'book' | 'verify' | 'manage';

// Arabic copy is chosen here by code, never from the backend's message. A booking 400 reads as
// "that time is gone" — the page only submits a slot the API just offered.
function failureFor(status: number, intent: Intent): BookingFailure {
  if (status === 429) {
    return 'throttled';
  }

  if (status >= 500) {
    return 'server';
  }

  switch (intent) {
    case 'book':
      if (status === 400) return 'slotTaken';
      if (status === 403 || status === 404) return 'closed';
      break;

    case 'verify':
      if (status === 401) return 'invalidCode';
      break;

    case 'manage':
      if (status === 401 || status === 404) return 'invalidLink';
      if (status === 400) return 'slotTaken';
      break;

    case 'read':
      if (status === 404) return 'notFound';
      break;
  }

  return 'generic';
}

async function request<TResult>(
  path: string,
  intent: Intent,
  init?: { method: 'POST'; body: unknown },
): Promise<TResult> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: init
        ? { 'content-type': 'application/json', accept: 'application/json' }
        : { accept: 'application/json' },
      ...(init && { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new BookingError('network');
  }

  if (!response.ok) {
    throw new BookingError(failureFor(response.status, intent), response.status);
  }

  return (await response.json()) as TResult;
}

const encode = encodeURIComponent;

export const bookingApi = {
  clinic: (slug: string): Promise<PublicClinic> => request(`/${encode(slug)}`, 'read'),

  doctors: (slug: string): Promise<PublicDoctor[]> => request(`/${encode(slug)}/doctors`, 'read'),

  slots: (slug: string, doctorId: string, date: string): Promise<PublicSlots> =>
    request(`/${encode(slug)}/slots?doctorId=${encode(doctorId)}&date=${encode(date)}`, 'read'),

  book: (
    slug: string,
    body: { fullName: string; phone: string; doctorId: string; startsAt: string; reason?: string },
  ): Promise<BookingReceipt> => request(`/${encode(slug)}`, 'book', { method: 'POST', body }),

  verifyOtp: (slug: string, token: string, code: string): Promise<ManagedBooking> =>
    request(`/${encode(slug)}/verify-otp`, 'verify', { method: 'POST', body: { token, code } }),

  managed: (token: string): Promise<ManagedBooking> =>
    request(`/manage/${encode(token)}`, 'manage'),

  cancel: (token: string, reason?: string): Promise<ManagedBooking> =>
    request(`/manage/${encode(token)}/cancel`, 'manage', {
      method: 'POST',
      body: reason ? { reason } : {},
    }),

  reschedule: (token: string, startsAt: string): Promise<ManagedBooking> =>
    request(`/manage/${encode(token)}/reschedule`, 'manage', {
      method: 'POST',
      body: { startsAt },
    }),
};

export function failureKey(error: unknown): string {
  return `errors.${error instanceof BookingError ? error.failure : 'generic'}`;
}
