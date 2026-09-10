import { SCHEDULE_CONFLICT_ERROR, USER_ROLE } from '@clinic/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import { makeClinic, makeProfile, paginated } from '@test/helpers/fixtures';
import {
  mockApi,
  renderWithProviders,
  type MockResponse,
  type RouteHandler,
} from '@test/helpers/render';

const CLOSURE = {
  id: '55555555-5555-4555-8555-555555555555',
  clinicId: makeClinic().id,
  startsOn: '2026-09-20',
  endsOn: '2026-09-21',
  reason: 'عيد الفطر',
  isAnnual: false,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
};

const CONFLICT = {
  statusCode: 409,
  error: SCHEDULE_CONFLICT_ERROR,
  message: 'Appointments fall inside this period',
  appointments: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      startsAt: '2026-09-20T07:00:00.000Z',
      durationMinutes: 30,
      patientName: 'أحمد خالد الحسن',
      patientPhone: '+963931000001',
      doctorId: '77777777-7777-4777-8777-777777777777',
    },
  ],
};

type Handlers = Record<string, RouteHandler | MockResponse>;

function handlers(overrides: Handlers = {}) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    'GET /clinic': { status: 200, body: makeClinic() },
    'GET /clinic-closures': { status: 200, body: paginated([CLOSURE]) },
    'GET /version': { status: 200, body: { version: '1.0.0' } },
    ...overrides,
  } satisfies Handlers;
}

const openClinicSettings = async (overrides: Handlers = {}) => {
  authTokens.clear();
  const api = mockApi(handlers(overrides));
  renderWithProviders(<AppRoutes />, { route: '/clinic' });
  await screen.findByRole('heading', { name: ar.clinic.title });

  return api;
};

async function fillClosureForm(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name: ar.schedule.closures.add }));

  const dialog = await screen.findByRole('dialog');

  await userEvent.click(within(dialog).getByRole('button', { name: ar.schedule.closures.dates }));
  await userEvent.click(await screen.findByLabelText(/20 سبتمبر 2026/));
  await userEvent.click(await screen.findByRole('button', { name: ar.common.done }));

  await userEvent.type(within(dialog).getByLabelText(ar.schedule.closures.reason), 'عيد الفطر');

  return dialog;
}

describe('closures in clinic settings', () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it('lists the days the clinic is shut, with the reason it gave', async () => {
    await openClinicSettings();

    // The reason, not "closed": reception reads this out down the phone.
    expect(await screen.findByText('عيد الفطر')).toBeInTheDocument();
  });

  it('names the appointments in the way rather than counting them', async () => {
    await openClinicSettings({ 'POST /clinic-closures': { status: 409, body: CONFLICT } });

    const dialog = await fillClosureForm();
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    // "3 appointments" with no way to see which three is a question nobody can
    // answer — reception knows these patients by name.
    expect(await screen.findByText('أحمد خالد الحسن')).toBeInTheDocument();
    expect(screen.getByText('+963931000001')).toBeInTheDocument();
  });

  it('writes the closure and cancels them when that is the choice', async () => {
    const api = await openClinicSettings({
      'POST /clinic-closures': ({ url }: { url: string }) =>
        url.includes('force=true')
          ? { status: 201, body: { item: CLOSURE, cancelledAppointments: 1 } }
          : { status: 409, body: CONFLICT },
    });

    const dialog = await fillClosureForm();
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    await userEvent.click(
      await screen.findByRole('button', { name: ar.schedule.conflicts.cancelThem }),
    );

    await waitFor(() => {
      const forced = api.calls.filter(
        (call) => call.method === 'POST' && call.url.includes('cancelAppointments=true'),
      );

      expect(forced).toHaveLength(1);
      // And it was forced too: cancelling without forcing would be refused
      // again by the same 409.
      expect(forced[0]?.url).toContain('force=true');
    });
  });

  it('keeps them when that is the choice, and forces without cancelling', async () => {
    const api = await openClinicSettings({
      'POST /clinic-closures': ({ url }: { url: string }) =>
        url.includes('force=true')
          ? { status: 201, body: { item: CLOSURE, cancelledAppointments: 0 } }
          : { status: 409, body: CONFLICT },
    });

    const dialog = await fillClosureForm();
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    await userEvent.click(
      await screen.findByRole('button', { name: ar.schedule.conflicts.keepThem }),
    );

    await waitFor(() => {
      const forced = api.calls.filter(
        (call) => call.method === 'POST' && call.url.includes('force=true'),
      );

      expect(forced).toHaveLength(1);
      // A practice with three patients it knows rings round and moves them by
      // hand; nothing was cancelled on its behalf.
      expect(forced[0]?.url).not.toContain('cancelAppointments=true');
    });
  });

  it('writes nothing when the dialog is dismissed', async () => {
    const api = await openClinicSettings({
      'POST /clinic-closures': { status: 409, body: CONFLICT },
    });

    const dialog = await fillClosureForm();
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    const conflict = await screen.findByText(/أحمد خالد الحسن/);
    const conflictDialog = conflict.closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(conflictDialog).getByRole('button', { name: ar.common.cancel }));

    // The refused attempt, and nothing after it. (Scoped to the endpoint: the
    // token refresh is a POST too.)
    const attempts = api.calls.filter(
      (call) => call.method === 'POST' && call.url.includes('/clinic-closures'),
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.url).not.toContain('force=true');
  });
});
