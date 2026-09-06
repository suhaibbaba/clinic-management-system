import { APPOINTMENT_STATUS, USER_ROLE, type UserRole } from '@clinic/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import { makeClinic, makeDoctor, makeProfile, paginated } from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';
import { resetClinicTimeZone } from '@web/features/appointments/clinic-zone';

const DOCTOR_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_DOCTOR_ID = '22222222-2222-4222-8222-222222222222';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

/** jsdom has no layout, so the breakpoint is answered directly. */
function setViewport(isMobile: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isMobile && query.includes('max-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const today = new Date();
const iso = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

/** An appointment at a wall-clock hour today, in whatever zone the test runs in. */
function appointmentAt(hour: number, overrides: Record<string, unknown> = {}) {
  const startsAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, 0);

  return {
    id: `appt-${hour}`,
    clinicId: 'clinic',
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    startsAt: startsAt.toISOString(),
    durationMinutes: 30,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    type: 'checkup',
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: 'فحص دوري',
    notes: null,
    visitId: null,
    cancelledReason: null,
    createdAt: startsAt.toISOString(),
    updatedAt: startsAt.toISOString(),
    patientName: 'أحمد خالد الحسن',
    patientPhone: '+963931000001',
    patientFileNumber: '00001',
    doctorName: 'Dr. Layla Haddad',
    ...overrides,
  };
}

function handlers(role: UserRole, overrides: Record<string, MockResponse | unknown> = {}) {
  const doctor = makeDoctor();

  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role }) },
    // The calendar draws in the *clinic's* zone, so a test that builds its
    // fixtures with the machine's has to say the two are the same. The zone
    // itself is exercised by the last test in this file.
    'GET /clinic': { status: 200, body: { ...makeClinic(), settings: { timezone: 'UTC' } } },
    'GET /doctors': {
      status: 200,
      body: paginated([
        { ...doctor, id: DOCTOR_ID, user: { ...doctor.user, name: 'Dr. Layla Haddad' } },
        { ...doctor, id: OTHER_DOCTOR_ID, user: { ...doctor.user, name: 'Dr. Samer Nassar' } },
      ]),
    },
    'GET /waiting-list': { status: 200, body: paginated([]) },
    'GET /appointments/calendar': {
      status: 200,
      body: {
        from: iso(today),
        to: iso(today),
        appointments: [appointmentAt(10), appointmentAt(14, { id: 'appt-14', status: 'arrived' })],
      },
    },
    'GET /appointments/availability': {
      status: 200,
      body: {
        doctorId: DOCTOR_ID,
        date: iso(today),
        durationMinutes: 30,
        closedReason: null,
        slots: [
          { start: '09:00', end: '09:30', startsAt: new Date().toISOString(), available: true },
          { start: '09:30', end: '10:00', startsAt: new Date().toISOString(), available: false },
        ],
      },
    },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderCalendar(role: UserRole, overrides = {}) {
  authTokens.clear();
  const api = mockApi(handlers(role, overrides));
  renderWithProviders(<AppRoutes />, { route: '/appointments' });
  return api;
}

/**
 * The calendar, as distinct from the today ribbon above it — the two draw some
 * of the same appointments, so a bare `getByRole` finds both.
 */
const calendar = () => screen.findByRole('region', { name: ar.appointments.title });

const block = async (time: RegExp) => within(await calendar()).findByRole('button', { name: time });

describe('Appointments page', () => {
  beforeEach(() => {
    authTokens.clear();
    setViewport(false);
    resetClinicTimeZone();
  });

  it('draws every appointment as its own button, named by time, patient and status', async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    // Colour is never the only channel: the status is in the name, in words.
    expect(
      await block(new RegExp(`10:00.*أحمد خالد الحسن.*${ar.appointments.statuses.confirmed}`)),
    ).toBeInTheDocument();
  });

  it('opens the detail drawer on a block, with the actions that status allows', async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await userEvent.click(await block(/10:00/));

    const drawer = await screen.findByRole('dialog');

    // Confirmed → arrived or no-show. Not "complete": a confirmed appointment
    // nobody turned up to must not be markable as done.
    expect(
      within(drawer).getByRole('button', { name: ar.appointments.actions.arrived }),
    ).toBeVisible();
    expect(
      within(drawer).queryByRole('button', { name: ar.appointments.actions.complete }),
    ).not.toBeInTheDocument();
  });

  it('offers a visit only once the patient has arrived', async () => {
    await renderCalendar(USER_ROLE.DOCTOR);

    await userEvent.click(await block(/14:00/));
    const drawer = await screen.findByRole('dialog');

    expect(
      within(drawer).getByRole('button', { name: ar.appointments.actions.openVisit }),
    ).toBeVisible();
  });

  it('does not offer a receptionist the visit button — a visit is clinical', async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await userEvent.click(await block(/14:00/));
    const drawer = await screen.findByRole('dialog');

    expect(
      within(drawer).queryByRole('button', { name: ar.appointments.actions.openVisit }),
    ).not.toBeInTheDocument();
  });

  it('hides booking from a technician, who has no write on the calendar', async () => {
    await renderCalendar(USER_ROLE.TECHNICIAN);

    // They still read it — the calendar row is `R` for every role.
    expect(await block(/10:00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ar.appointments.create })).not.toBeInTheDocument();
  });

  it('shows the day as an agenda on a phone, with no week toggle', async () => {
    setViewport(true);
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await block(/10:00/);

    // The week is seven 40px columns at 390px, so it is not offered at all.
    expect(screen.queryByRole('radio', { name: ar.appointments.week })).not.toBeInTheDocument();
  });

  it('draws times in the clinic’s zone, not the browser’s', async () => {
    // The bug this guards: the API books in the clinic's zone. Drawing in the
    // browser's would show 10:00 where the API booked 13:00 on any machine
    // whose clock is set elsewhere — and the grid would disagree with the
    // availability endpoint about what a day contains.
    await renderCalendar(USER_ROLE.RECEPTIONIST, {
      'GET /clinic': {
        status: 200,
        body: { ...makeClinic(), settings: { timezone: 'Asia/Tokyo' } },
      },
    });

    // 10:00 UTC is 19:00 in Tokyo.
    expect(await block(/19:00/)).toBeInTheDocument();
    expect(
      within(await calendar()).queryByRole('button', { name: /\b10:00\b/ }),
    ).not.toBeInTheDocument();
  });

  it('only lets a real slot be picked in the booking form', async () => {
    await renderCalendar(USER_ROLE.RECEPTIONIST);

    await userEvent.click(await screen.findByRole('button', { name: ar.appointments.create }));

    const dialog = await screen.findByRole('dialog');

    // Slots only exist once a doctor is chosen — "availability for no doctor"
    // is not a question, and asking it would put an error in front of someone
    // who has simply not finished filling the form in.
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);

    await userEvent.selectOptions(within(dialog).getByLabelText(ar.appointments.doctor), DOCTOR_ID);

    const slots = await within(dialog).findAllByRole('radio');

    expect(slots.map((slot) => slot.textContent)).toEqual(['09:00', '09:30']);

    // A taken slot is drawn and disabled: a hole in the grid says "that one is
    // gone" where a shorter list only says "there are fewer".
    expect(slots[0]).toBeEnabled();
    expect(slots[1]).toBeDisabled();
  });
});
