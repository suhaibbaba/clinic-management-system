import { USER_ROLE, type DashboardSummary, type UserRole } from '@clinic/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import {
  makeCalendarAppointment,
  makeClinic,
  makeDashboardSummary,
  makeProfile,
  paginated,
  PATIENT_ID,
} from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';

async function renderDashboard(
  role: UserRole,
  summary: DashboardSummary = makeDashboardSummary(),
): Promise<void> {
  authTokens.clear();
  mockApi({
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role }) },
    'GET /clinic': { status: 200, body: { ...makeClinic(), settings: { timezone: 'UTC' } } },
    'GET /dashboard/summary': { status: 200, body: summary },
    'GET /appointments/pending-confirmation': { status: 200, body: paginated([]) },
  } as Record<string, MockResponse>);

  renderWithProviders(<AppRoutes />, { route: '/dashboard' });
  await screen.findByRole('heading', { name: ar.dashboard.title, level: 1 });
}

/** `findBy`, because the card only exists once the response says the role may have it. */
const card = async (label: string): Promise<HTMLElement> => {
  const link = (await screen.findByText(label)).closest('a');
  expect(link).not.toBeNull();

  return link as HTMLElement;
};

describe('Dashboard', () => {
  it('is where a signed-in user lands', async () => {
    authTokens.clear();
    mockApi({
      'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
      'GET /me': { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      'GET /clinic': { status: 200, body: makeClinic() },
      'GET /dashboard/summary': { status: 200, body: makeDashboardSummary() },
      'GET /appointments/pending-confirmation': { status: 200, body: paginated([]) },
    } as Record<string, MockResponse>);

    renderWithProviders(<AppRoutes />, { route: '/' });

    expect(
      await screen.findByRole('heading', { name: ar.dashboard.title, level: 1 }),
    ).toBeInTheDocument();
  });

  it('asks for the three figures once, not three times', async () => {
    authTokens.clear();
    const api = mockApi({
      'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
      'GET /me': { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      'GET /clinic': { status: 200, body: makeClinic() },
      'GET /dashboard/summary': { status: 200, body: makeDashboardSummary() },
      'GET /appointments/pending-confirmation': { status: 200, body: paginated([]) },
    } as Record<string, MockResponse>);

    renderWithProviders(<AppRoutes />, { route: '/dashboard' });
    await screen.findByRole('heading', { name: ar.dashboard.title, level: 1 });

    expect(api.calls.filter((call) => call.url.includes('/dashboard/summary'))).toHaveLength(1);
    // Not the paginated list behind the card, which would be a second request
    // for a number the summary already carried.
    expect(api.calls.some((call) => call.url.includes('/billing/overdue'))).toBe(false);
  });

  it('draws each figure as a door to the rows behind it', async () => {
    await renderDashboard(USER_ROLE.ADMIN);

    const today = await card(ar.dashboard.kpi.today);
    const pending = await card(ar.dashboard.kpi.pending);
    const overdue = await card(ar.dashboard.kpi.overdue);

    expect(today).toHaveAttribute('href', '/appointments');
    expect(pending).toHaveAttribute('href', '/appointments?status=pending');
    expect(overdue).toHaveAttribute('href', '/patients?filter=balance');

    expect(within(today).getByText('3')).toBeInTheDocument();
    expect(within(pending).getByText('2')).toBeInTheDocument();
    expect(within(overdue).getByText(/450/)).toBeInTheDocument();
  });

  // The API omits the figures a role may not read, so the page draws what it was sent and keeps no
  // copy of the permission matrix.
  it('draws no card for a figure the response withheld', async () => {
    await renderDashboard(
      USER_ROLE.TECHNICIAN,
      makeDashboardSummary({
        pendingBookings: undefined,
        overdueTotal: undefined,
        overduePatients: undefined,
      }),
    );

    expect(await card(ar.dashboard.kpi.today)).toBeInTheDocument();
    expect(screen.queryByText(ar.dashboard.kpi.pending)).not.toBeInTheDocument();
    expect(screen.queryByText(ar.dashboard.kpi.overdue)).not.toBeInTheDocument();
  });

  it("lists today's appointments in order, each opening its patient's file", async () => {
    await renderDashboard(
      USER_ROLE.ADMIN,
      makeDashboardSummary({
        schedule: [
          makeCalendarAppointment({ startsAt: '2026-09-07T09:00:00.000Z' }),
          makeCalendarAppointment({
            id: '77777777-7777-4777-8777-777777777777',
            startsAt: '2026-09-07T11:30:00.000Z',
            patientName: 'ليلى محمود العلي',
          }),
        ],
      }),
    );

    const schedule = screen.getByRole('region', { name: ar.dashboard.schedule.title });
    await within(schedule).findByText('09:00');

    const rows = within(schedule).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('09:00')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('11:30')).toBeInTheDocument();

    expect(within(rows[0]!).getByRole('link', { name: 'أحمد خالد الحسن' })).toHaveAttribute(
      'href',
      `/patients/${PATIENT_ID}`,
    );
    expect(
      within(schedule).getByRole('link', { name: ar.dashboard.schedule.seeAll }),
    ).toHaveAttribute('href', '/appointments');
  });

  it('leaves a name unlinked for a role that may not open the file', async () => {
    await renderDashboard(
      USER_ROLE.TECHNICIAN,
      makeDashboardSummary({
        pendingBookings: undefined,
        overdueTotal: undefined,
        overduePatients: undefined,
        schedule: [makeCalendarAppointment()],
      }),
    );

    const schedule = screen.getByRole('region', { name: ar.dashboard.schedule.title });

    expect(await within(schedule).findByText('أحمد خالد الحسن')).toBeInTheDocument();
    // A link to a page that would bounce them straight back is worse than the
    // same name in plain text.
    expect(
      within(schedule).queryByRole('link', { name: 'أحمد خالد الحسن' }),
    ).not.toBeInTheDocument();
  });

  it('says so plainly when nothing is booked', async () => {
    await renderDashboard(USER_ROLE.RECEPTIONIST, makeDashboardSummary({ schedule: [] }));

    expect(await screen.findByText(ar.dashboard.schedule.empty)).toBeInTheDocument();
  });
});
