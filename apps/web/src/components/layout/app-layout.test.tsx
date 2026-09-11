import { USER_ROLE, type UserRole } from '@clinic/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import {
  makeCalendarFeed,
  makeClinic,
  makeDashboardSummary,
  makeProfile,
  paginated,
} from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';

function handlers(role: UserRole, overrides: Record<string, MockResponse> = {}) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': {
      status: 200,
      body: makeProfile({ role, name: { ar: `مستخدم ${role}`, en: `User ${role}` } }),
    },
    'GET /clinic': { status: 200, body: makeClinic() },
    'GET /dashboard/summary': { status: 200, body: makeDashboardSummary() },
    'GET /doctors': { status: 200, body: paginated([]) },
    'GET /users': { status: 200, body: paginated([]) },
    'GET /audit-log': { status: 200, body: paginated([]) },
    'GET /appointments/pending-confirmation': { status: 200, body: paginated([], { total: 4 }) },
    'GET /appointments/calendar': { status: 200, body: makeCalendarFeed() },
    'GET /notes': { status: 200, body: paginated([]) },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderAs(role: UserRole, route = '/dashboard'): Promise<void> {
  authTokens.clear();
  mockApi(handlers(role));

  renderWithProviders(<AppRoutes />, { route });
  // `findAll`: the dashboard's banner greets the same person the rail's footer names.
  await screen.findAllByText(`مستخدم ${role}`);
}

const nav = (): HTMLElement => screen.getByRole('navigation', { name: ar.nav.menu });

const linkNames = (): string[] =>
  within(nav())
    .getAllByRole('link')
    .map((link) => link.textContent?.trim() ?? '');

// Each role's list is asserted whole: the failure that matters is an entry appearing for somebody
// it was never meant for.
describe('Sidebar navigation', () => {
  it('gives an admin every section, settings included', async () => {
    await renderAs(USER_ROLE.ADMIN);

    // The settings group is a caption over rows rather than a disclosure, so its links are part of
    // the rail's list and are asserted with the rest of it.
    expect(linkNames()).toEqual([
      ar.nav.dashboard,
      ar.nav.patients,
      ar.nav.appointments,
      ar.nav.labs,
      ar.nav.inventory,
      ar.nav.clinic,
      ar.nav.doctors,
      ar.nav.users,
      ar.nav.lists,
      ar.nav.audit,
    ]);
  });

  it.each([
    [USER_ROLE.DOCTOR, [ar.nav.dashboard, ar.nav.patients, ar.nav.appointments, ar.nav.labs]],
    [USER_ROLE.TECHNICIAN, [ar.nav.dashboard, ar.nav.labs, ar.nav.inventory]],
    [USER_ROLE.RECEPTIONIST, [ar.nav.dashboard, ar.nav.patients, ar.nav.appointments]],
  ])('gives %s exactly their sections and no settings rows', async (role, expected) => {
    await renderAs(role);

    expect(linkNames()).toEqual(expected);
    expect(within(nav()).queryByRole('link', { name: ar.nav.users })).not.toBeInTheDocument();
  });

  it('keeps the account out of the nav and behind the avatar', async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    expect(within(nav()).queryByRole('link', { name: ar.nav.profile })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: new RegExp(ar.roles.receptionist) }));

    expect(await screen.findByRole('menuitem', { name: ar.nav.profile })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'العربية' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: ar.nav.logout })).toBeInTheDocument();
  });

  it('shows the signed-in user with their translated role', async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    expect(screen.getByText(ar.roles.receptionist)).toBeInTheDocument();
  });

  it('counts the unanswered online bookings beside the appointments row', async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    // Labelled rather than a bare digit, so the row reads as "appointments, 4 awaiting
    // confirmation".
    const badge = await within(nav()).findByLabelText(
      ar.nav.waitingCount.replace('{{count}}', '4'),
    );

    expect(badge).toHaveTextContent('4');
    expect(badge.closest('a')).toHaveAttribute('href', '/appointments');
  });

  it('leaves the badge off for a doctor, who does not answer bookings', async () => {
    await renderAs(USER_ROLE.DOCTOR);

    expect(
      within(nav()).queryByLabelText(ar.nav.waitingCount.replace('{{count}}', '4')),
    ).not.toBeInTheDocument();
  });
});

describe('The settings group', () => {
  it('lists its rows without a control in front of them', async () => {
    await renderAs(USER_ROLE.ADMIN);

    // It used to be a disclosure. Five links worth showing do not need a button operated first,
    // and the reference's rail has no control in it at all.
    expect(within(nav()).queryByRole('button')).not.toBeInTheDocument();

    for (const label of [ar.nav.clinic, ar.nav.doctors, ar.nav.users, ar.nav.lists, ar.nav.audit]) {
      expect(within(nav()).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

// `/clinic/lists` sits under `/clinic`, and a prefix test calls both current — two pills and two
// `aria-current` rows. The longest match wins.
describe('The current row', () => {
  it('marks the deepest section a URL belongs to, and only that one', async () => {
    await renderAs(USER_ROLE.ADMIN, '/clinic/lists');

    const current = within(nav())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent?.trim());

    expect(current).toEqual([ar.nav.lists]);
  });

  it('keeps the section current on a page below it', async () => {
    await renderAs(USER_ROLE.ADMIN, '/clinic');

    const current = within(nav())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent?.trim());

    expect(current).toEqual([ar.nav.clinic]);
  });
});

// Hiding a link is not hiding a page: the address still resolves, so every section a role cannot
// see redirects to one they always can.
describe('Route guards', () => {
  it.each([
    [USER_ROLE.TECHNICIAN, '/patients'],
    [USER_ROLE.TECHNICIAN, '/appointments'],
    [USER_ROLE.DOCTOR, '/inventory'],
    [USER_ROLE.RECEPTIONIST, '/labs'],
    [USER_ROLE.RECEPTIONIST, '/users'],
    [USER_ROLE.DOCTOR, '/audit-log'],
  ])('redirects %s away from %s and onto the dashboard', async (role, route) => {
    await renderAs(role, route);

    // The dashboard's `<h1>` is the greeting, so the day's panel is what names the screen.
    expect(
      await screen.findByRole('region', { name: ar.dashboard.schedule.title }),
    ).toBeInTheDocument();
  });
});
