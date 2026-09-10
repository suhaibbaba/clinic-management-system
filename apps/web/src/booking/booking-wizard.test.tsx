import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { BookingWizard } from '@web/booking/booking-wizard';
import { resetClinicOffset } from '@web/booking/format';
import ar from '@web/booking/locales/ar.json';
import { mockApi, type MockResponse, type RouteHandler } from '@test/helpers/render';

const SLUG = 'al-nour';
const DOCTOR_ID = '11111111-1111-4111-8111-111111111111';

const pad = (value: number): string => String(value).padStart(2, '0');
const isoDate = (at: Date): string =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

function slotAt(hour: number) {
  const at = new Date();
  at.setHours(hour, 0, 0, 0);

  return {
    start: `${pad(hour)}:00`,
    end: `${pad(hour)}:30`,
    startsAt: at.toISOString(),
  };
}

const TODAY = isoDate(new Date());
const MORNING = slotAt(10);
const NOON = slotAt(12);

const clinic = {
  name: { ar: 'عيادة النور', en: 'Al Nour Clinic' },
  slug: SLUG,
  phone: '+963110000000',
  address: null,
  bookingEnabled: true,
  confirmationMode: 'otp',
  maxDaysAhead: 30,
};

const doctors = [
  {
    id: DOCTOR_ID,
    name: { ar: 'د. ليلى حداد', en: 'Dr. Layla Haddad' },
    specialty: 'طب الأسنان',
  },
];

const confirmed = {
  status: 'confirmed',
  startsAt: MORNING.startsAt,
  durationMinutes: 30,
  doctorName: { ar: 'د. ليلى حداد', en: 'Dr. Layla Haddad' },
  clinicName: { ar: 'عيادة النور', en: 'Al Nour Clinic' },
  clinicPhone: '+963110000000',
  canModify: true,
};

const slotsHandler: RouteHandler = ({ url }) => {
  const date = new URL(url, 'http://test').searchParams.get('date');

  return { body: { date, slots: date === TODAY ? [MORNING, NOON] : [] } };
};

function routes(overrides: Record<string, RouteHandler | MockResponse> = {}) {
  return {
    [`GET /public/booking/${SLUG}`]: { body: clinic },
    [`GET /public/booking/${SLUG}/doctors`]: { body: doctors },
    [`GET /public/booking/${SLUG}/slots`]: slotsHandler,
    [`POST /public/booking/${SLUG}`]: {
      body: {
        token: 'v1.token.signature',
        status: 'pending_otp',
        otpExpiresInSeconds: 300,
        holdExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      },
    },
    [`POST /public/booking/${SLUG}/verify-otp`]: { body: confirmed },
    ...overrides,
  };
}

// One digit per box with focus moving itself: `user.type(firstBox, '123456')` would put every
// keystroke in the box it was handed.
async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string): Promise<void> {
  const boxes = await screen.findAllByRole('textbox', { name: /الرقم/ });

  for (const [index, digit] of [...code].entries()) {
    await user.type(boxes[index] as HTMLElement, digit);
  }
}

async function reachDetails(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /د\. ليلى حداد/ }));
  await user.click(await screen.findByRole('button', { name: /10:00/ }));
  await user.type(screen.getByLabelText(ar.details.name), 'ريم العلي');
  await user.type(screen.getByLabelText(ar.details.phone), '0931234567');
}

describe('Public booking wizard', () => {
  beforeEach(() => {
    resetClinicOffset();
  });

  it('walks a patient from a doctor to a confirmed appointment', async () => {
    mockApi(routes());
    const user = userEvent.setup();

    render(<BookingWizard slug={SLUG} />);

    expect(await screen.findByText(ar.doctor.heading)).toBeInTheDocument();
    expect(screen.getByText('طب الأسنان')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /د\. ليلى حداد/ }));

    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /12:00/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /10:00/ }));

    expect(await screen.findByText(ar.details.heading)).toBeInTheDocument();
    await user.type(screen.getByLabelText(ar.details.name), 'ريم العلي');
    await user.type(screen.getByLabelText(ar.details.phone), '0931234567');
    await user.click(screen.getByRole('button', { name: ar.details.submit }));

    expect(await screen.findAllByRole('textbox', { name: /الرقم/ })).toHaveLength(6);

    await enterCode(user, '123456');

    expect(await screen.findByText(ar.success.heading)).toBeInTheDocument();
    expect(screen.getByText('د. ليلى حداد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ar.success.addToCalendar })).toBeInTheDocument();
  });

  it('refuses to submit a half-filled form, in Arabic, without calling the API', async () => {
    const api = mockApi(routes());
    const user = userEvent.setup();

    render(<BookingWizard slug={SLUG} />);

    await user.click(await screen.findByRole('button', { name: /د\. ليلى حداد/ }));
    await user.click(await screen.findByRole('button', { name: /10:00/ }));
    await user.type(screen.getByLabelText(ar.details.name), 'ر');
    await user.click(screen.getByRole('button', { name: ar.details.submit }));

    expect(await screen.findByText(ar.details.nameError)).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('sends the patient back to fresh times when the slot is taken', async () => {
    const api = mockApi(
      routes({
        // The slot went between choosing it and pressing confirm — which is
        // exactly what the exclusion constraint answers with.
        [`POST /public/booking/${SLUG}`]: { status: 400, body: { message: 'taken' } },
      }),
    );
    const user = userEvent.setup();

    render(<BookingWizard slug={SLUG} />);
    await reachDetails(user);

    const before = api.calls.filter((call) => call.url.includes('/slots')).length;
    await user.click(screen.getByRole('button', { name: ar.details.submit }));

    expect(await screen.findByText(ar.errors.slotTaken)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(api.calls.filter((call) => call.url.includes('/slots')).length).toBeGreaterThan(
        before,
      );
    });
  });

  it('says so plainly when the clinic is not taking online bookings', async () => {
    mockApi(
      routes({ [`GET /public/booking/${SLUG}`]: { body: { ...clinic, bookingEnabled: false } } }),
    );

    render(<BookingWizard slug={SLUG} />);

    expect(await screen.findByText(ar.errors.closed)).toBeInTheDocument();
  });

  it('counts down the wrong codes and stops at three', async () => {
    mockApi(
      routes({
        [`POST /public/booking/${SLUG}/verify-otp`]: { status: 401, body: { message: 'no' } },
      }),
    );
    const user = userEvent.setup();

    render(<BookingWizard slug={SLUG} />);
    await reachDetails(user);
    await user.click(screen.getByRole('button', { name: ar.details.submit }));

    await enterCode(user, '111111');

    // The API's three-guess rule, reported: two left after the first miss.
    const alert = await screen.findByRole('status');
    expect(alert).toHaveTextContent('الرمز غير صحيح');
    expect(alert).toHaveTextContent('2');
  });
});
