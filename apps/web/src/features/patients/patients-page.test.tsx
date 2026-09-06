import { USER_ROLE, type UserRole } from '@clinic/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import { makePatient, makeProfile, paginated, PATIENT_ID } from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';

const PATIENTS = [
  makePatient(),
  makePatient({
    id: '11111111-2222-4333-8444-555555555555',
    fileNumber: '00002',
    fullName: 'ليلى محمود العلي',
    phone: '+963931000002',
    address: 'المالكي، دمشق',
  }),
];

function handlers(role: UserRole, overrides: Record<string, MockResponse | unknown> = {}) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role }) },
    'GET /patients': { status: 200, body: paginated(PATIENTS) },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderList(role: UserRole, overrides = {}) {
  authTokens.clear();
  const api = mockApi(handlers(role, overrides));
  renderWithProviders(<AppRoutes />, { route: '/patients' });
  await screen.findByRole('heading', { name: ar.patients.title });
  return api;
}

const searchCalls = (api: { calls: { url: string; method: string }[] }) =>
  api.calls.filter((call) => call.method === 'GET' && call.url.includes('/patients?'));

describe('Patients list', () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it('lists patients with their file number and phone', async () => {
    await renderList(USER_ROLE.DOCTOR);

    const row = (await screen.findByText(PATIENTS[0]!.fullName)).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('00001')).toBeInTheDocument();
    expect(within(row!).getByText('+963931000001')).toBeInTheDocument();
  });

  describe('search', () => {
    it('searches on the server, not by filtering the page', async () => {
      const api = await renderList(USER_ROLE.RECEPTIONIST);

      await userEvent.type(screen.getByLabelText(ar.patients.search), 'خالد');

      await waitFor(() => {
        expect(searchCalls(api).some((call) => call.url.includes('search='))).toBe(true);
      });
    });

    it('debounces: a burst of typing is one request, not one per keystroke', async () => {
      const api = await renderList(USER_ROLE.RECEPTIONIST);
      const before = searchCalls(api).length;

      await userEvent.type(screen.getByLabelText(ar.patients.search), 'خالد');

      await waitFor(() => {
        expect(searchCalls(api).length).toBeGreaterThan(before);
      });

      // Four characters typed; far fewer requests than that.
      await waitFor(() => {
        expect(searchCalls(api).length - before).toBeLessThan(4);
      });
    });

    it('tells the difference between an empty clinic and an empty search', async () => {
      await renderList(USER_ROLE.RECEPTIONIST, {
        'GET /patients': { status: 200, body: paginated([]) },
      });

      expect(await screen.findByText(ar.patients.empty)).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(ar.patients.search), 'لا-يوجد');

      expect(await screen.findByText(ar.patients.noMatches)).toBeInTheDocument();
    });
  });

  describe('columns by role (ROLES.md field-level security)', () => {
    it('shows the clinical column to admin and doctor', async () => {
      await renderList(USER_ROLE.DOCTOR);

      expect(
        await screen.findByRole('columnheader', { name: ar.patients.address }),
      ).toBeInTheDocument();
    });

    it.each([
      // ROLES.md lists `balance` on the public view, but the field rules keep
      // financial data out of a technician's response entirely — so only the
      // receptionist gets the column.
      [USER_ROLE.RECEPTIONIST, true],
      [USER_ROLE.TECHNICIAN, false],
    ])('gives %s the public-view columns only', async (role, withBalance) => {
      await renderList(role as UserRole);

      await screen.findByText(PATIENTS[0]!.fullName);

      const headers = screen
        .getAllByRole('columnheader')
        .map((header) => header.textContent?.trim());

      // The file number has no column of its own any more — it is the caption
      // under the name, in the same cell — so it is asserted as content below
      // rather than as a header.
      expect(headers).toEqual([
        ar.patients.fullName,
        ar.patients.phone,
        ar.patients.age,
        ...(withBalance ? [ar.patients.balance] : []),
        ar.common.actions,
      ]);
      expect(screen.getAllByText(PATIENTS[0]!.fileNumber).length).toBeGreaterThan(0);

      // The address is in the fixture but never in a public-view response.
      expect(screen.queryByText('المالكي، دمشق')).not.toBeInTheDocument();
    });
  });

  describe('registering a patient', () => {
    it('offers the action to the roles that may create one', async () => {
      await renderList(USER_ROLE.RECEPTIONIST);

      expect(screen.getAllByRole('button', { name: ar.patients.create }).length).toBeGreaterThan(0);
    });

    it('hides it from a technician, whose access is read-only', async () => {
      await renderList(USER_ROLE.TECHNICIAN);

      await screen.findByText(PATIENTS[0]!.fullName);
      expect(screen.queryByRole('button', { name: ar.patients.create })).not.toBeInTheDocument();
    });

    it('sends what the form collected and opens the new file', async () => {
      const created = makePatient({ id: PATIENT_ID, fullName: 'سامر التلاوي' });

      const api = await renderList(USER_ROLE.RECEPTIONIST, {
        'POST /patients': { status: 201, body: created },
        [`GET /patients/${PATIENT_ID}`]: { status: 200, body: created },
        [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
          status: 200,
          body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
        },
      });

      await userEvent.click(screen.getAllByRole('button', { name: ar.patients.create })[0]!);

      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(ar.patients.fullName), 'سامر التلاوي');
      await userEvent.type(within(dialog).getByLabelText(ar.patients.phone), '+963944123456');
      await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

      await waitFor(() => {
        const call = api.calls.find(
          (entry) => entry.method === 'POST' && entry.url.endsWith('/patients'),
        );
        expect(call?.body).toMatchObject({
          fullName: 'سامر التلاوي',
          phone: '+963944123456',
        });
        // The file number is the API's to allocate.
        expect(call?.body).not.toHaveProperty('fileNumber');
      });
    });

    it('will not submit a patient with no name', async () => {
      const api = await renderList(USER_ROLE.RECEPTIONIST);

      await userEvent.click(screen.getAllByRole('button', { name: ar.patients.create })[0]!);

      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(ar.patients.phone), '+963944123456');
      await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

      await waitFor(() => {
        expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0);
      });

      expect(
        api.calls.some((entry) => entry.method === 'POST' && entry.url.endsWith('/patients')),
      ).toBe(false);
    });
  });
});
