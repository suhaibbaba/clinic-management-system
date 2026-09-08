import { USER_ROLE, type UserRole } from '@clinic/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import {
  makeClinic,
  makeDashboardSummary,
  makeDoctor,
  makeProfile,
  paginated,
} from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';

/**
 * Enough of the API for any of the merged sections to draw.
 *
 * Deliberately one set for all of them: these tests are about which panel is
 * showing, and a per-section fixture would only make the tab assertions harder
 * to read.
 */
function handlers(role: UserRole) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role }) },
    'GET /clinic': { status: 200, body: makeClinic() },
    'GET /dashboard/summary': { status: 200, body: makeDashboardSummary() },
    'GET /doctors': { status: 200, body: paginated([makeDoctor()]) },
    'GET /waiting-list': { status: 200, body: paginated([]) },
    'GET /appointments': { status: 200, body: paginated([]) },
    'GET /appointments/calendar': {
      status: 200,
      body: { from: '2026-09-07', to: '2026-09-07', appointments: [] },
    },
    'GET /appointments/pending-confirmation': { status: 200, body: paginated([]) },
    'GET /labs': { status: 200, body: paginated([]) },
    'GET /lab-orders': { status: 200, body: paginated([]) },
    'GET /inventory/items': { status: 200, body: paginated([]) },
    // The real shape (inventoryAlertsSchema): `low`, not `lowStock`, and the
    // warning window. With the wrong key the alert cards read `low.length` off
    // `undefined` and threw — a crash the suite reported as an unhandled error
    // beside 261 passing tests, which is how it survived.
    'GET /inventory/alerts': {
      status: 200,
      body: { expiryWarningDays: 30, low: [], expiring: [], expired: [] },
    },
    'GET /suppliers': { status: 200, body: paginated([]) },
  } as Record<string, MockResponse>;
}

/**
 * The address, on the page.
 *
 * `MemoryRouter` keeps its history in memory, so `window.location` never moves
 * and cannot be asserted against — which matters here, because "the tab is in
 * the address" is the whole property under test.
 */
function LocationProbe(): JSX.Element {
  const { pathname, search } = useLocation();

  return <output data-testid="location">{`${pathname}${search}`}</output>;
}

const address = (): string => screen.getByTestId('location').textContent ?? '';

async function render(role: UserRole, route: string): Promise<void> {
  authTokens.clear();
  mockApi(handlers(role));
  renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { route },
  );
  await screen.findByRole('navigation', { name: ar.nav.menu });
}

const strip = async (name: string): Promise<HTMLElement> => screen.findByRole('tablist', { name });

/**
 * Four nav entries became two pages with tabs.
 *
 * What is worth asserting is not that the tabs render — it is that the tab is
 * in the address. Every one of these panels used to be a page somebody could
 * link to, and a tab kept in component state would have quietly broken all of
 * those links while looking identical on screen.
 */
describe('Appointments, as tabs', () => {
  it('opens on the calendar, with the booking queue beside it', async () => {
    await render(USER_ROLE.RECEPTIONIST, '/appointments');

    const tabs = await strip(ar.appointments.tabs.label);

    expect(within(tabs).getByRole('tab', { name: ar.appointments.tabs.all })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      await screen.findByRole('heading', { name: ar.appointments.title, level: 1 }),
    ).toBeVisible();
  });

  it('opens the queue when the address names it', async () => {
    await render(USER_ROLE.RECEPTIONIST, '/appointments?status=pending');

    expect(
      await screen.findByRole('heading', { name: ar.booking.pending.title, level: 1 }),
    ).toBeVisible();
    expect(
      within(await strip(ar.appointments.tabs.label)).getByRole('tab', {
        name: new RegExp(ar.appointments.tabs.pending),
      }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('carries the retired /appointments/pending address onto that tab', async () => {
    await render(USER_ROLE.RECEPTIONIST, '/appointments/pending');

    expect(
      await screen.findByRole('heading', { name: ar.booking.pending.title, level: 1 }),
    ).toBeVisible();
  });

  it('puts the tab in the address when it is chosen', async () => {
    await render(USER_ROLE.RECEPTIONIST, '/appointments');

    await userEvent.click(
      within(await strip(ar.appointments.tabs.label)).getByRole('tab', {
        name: ar.appointments.tabs.confirmed,
      }),
    );

    expect(address()).toBe('/appointments?status=confirmed');
    expect(
      await screen.findByRole('heading', { name: ar.appointments.confirmed.title, level: 1 }),
    ).toBeVisible();
  });

  it('shows a doctor the calendar alone — the queue is front-desk work', async () => {
    await render(USER_ROLE.DOCTOR, '/appointments');

    expect(
      screen.queryByRole('tablist', { name: ar.appointments.tabs.label }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: ar.appointments.title, level: 1 }),
    ).toBeVisible();
  });
});

describe('Labs and inventory, as tabs', () => {
  it('opens the labs board first and the directory beside it', async () => {
    await render(USER_ROLE.TECHNICIAN, '/labs');

    const tabs = await strip(ar.labs.section.label);

    expect(within(tabs).getByRole('tab', { name: ar.labs.section.orders })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.click(within(tabs).getByRole('tab', { name: ar.labs.section.directory }));

    expect(address()).toBe('/labs?tab=directory');
  });

  it('carries the retired /lab-orders address onto the board tab', async () => {
    await render(USER_ROLE.TECHNICIAN, '/lab-orders');

    expect(
      within(await strip(ar.labs.section.label)).getByRole('tab', {
        name: ar.labs.section.orders,
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(address()).toBe('/labs?tab=orders');
  });

  it('carries the retired /suppliers address into the store cupboard', async () => {
    await render(USER_ROLE.TECHNICIAN, '/suppliers');

    expect(
      within(await strip(ar.inventory.section.label)).getByRole('tab', {
        name: ar.inventory.section.suppliers,
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(address()).toBe('/inventory?tab=suppliers');
  });

  it('opens the stock list first', async () => {
    await render(USER_ROLE.TECHNICIAN, '/inventory');

    expect(
      within(await strip(ar.inventory.section.label)).getByRole('tab', {
        name: ar.inventory.section.stock,
      }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
