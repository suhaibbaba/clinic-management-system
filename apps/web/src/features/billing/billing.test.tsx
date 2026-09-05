import { USER_ROLE, type UserRole } from '@clinic/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import {
  makeBalance,
  makeClinic,
  makeOverduePatient,
  makePatient,
  makePayment,
  makeProfile,
  makeStatement,
  paginated,
  PATIENT_ID,
} from '@test/helpers/fixtures';
import { mockApi, renderWithProviders, type MockResponse } from '@test/helpers/render';

function handlers(role: UserRole, overrides: Record<string, MockResponse> = {}) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: makeProfile({ role }) },
    'GET /clinic': { status: 200, body: makeClinic() },
    'GET /patients': { status: 200, body: paginated([]) },
    'GET /doctors': { status: 200, body: paginated([]) },
    'GET /performed-procedures': { status: 200, body: paginated([]) },
    'GET /procedure-catalog': { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
    [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
      status: 200,
      body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
    },
    [`GET /patients/${PATIENT_ID}/balance`]: { status: 200, body: makeBalance() },
    [`GET /patients/${PATIENT_ID}/statement`]: { status: 200, body: makeStatement() },
    'POST /payments': { status: 201, body: makePayment() },
    'GET /billing/overdue': { status: 200, body: paginated([makeOverduePatient()]) },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderAccountTab(role: UserRole, overrides: Record<string, MockResponse> = {}) {
  authTokens.clear();
  const api = mockApi(handlers(role, overrides));
  renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });

  const tab = await screen.findByRole('tab', { name: ar.patients.tabs.billing });
  await userEvent.click(tab);

  return api;
}

describe('Billing', () => {
  beforeEach(() => {
    authTokens.clear();
    // The receipt opens in a new tab from a blob; jsdom has neither.
    vi.stubGlobal('open', vi.fn());
    URL.createObjectURL = vi.fn(() => 'blob:receipt');
    URL.revokeObjectURL = vi.fn();
  });

  describe('account tab', () => {
    it('runs the balance down the statement', async () => {
      await renderAccountTab(USER_ROLE.DOCTOR);

      const table = await screen.findByRole('table');
      const rows = within(table).getAllByRole('row').slice(1);

      const cells = (row: HTMLElement): string[] =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent?.trim() ?? '');

      expect(rows).toHaveLength(2);
      // date | description | debit | credit | balance | actions
      expect(cells(rows[0]!).slice(1, 5)).toEqual(['حشوة تجميلية', '150.00', '', '150.00']);
      // The payment shows as a credit and takes the balance down with it.
      expect(cells(rows[1]!).slice(2, 5)).toEqual(['', '50.00', '100.00']);
    });

    it('names the procedure and nothing clinical beside it', async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      // ROLES.md keeps diagnoses and visit notes away from a receptionist, and
      // a statement they read is no exception — the API sends the catalog name
      // and this screen has nothing else to show.
      expect(await screen.findByText('حشوة تجميلية')).toBeInTheDocument();
      expect(screen.queryByText(/تشخيص/)).not.toBeInTheDocument();
    });

    it('records a payment and prints its receipt', async () => {
      const api = await renderAccountTab(USER_ROLE.RECEPTIONIST, {
        [`GET /payments/${makePayment().id}/receipt`]: { status: 200, body: {} },
      });

      await userEvent.click(await screen.findByRole('button', { name: ar.billing.recordPayment }));

      const amount = await screen.findByLabelText(new RegExp(ar.billing.amount));
      await userEvent.clear(amount);
      await userEvent.type(amount, '40.00');
      await userEvent.click(screen.getByRole('button', { name: ar.billing.recordAndPrint }));

      const posted = await vi.waitFor(() => {
        const call = api.calls.find(
          (entry) => entry.method === 'POST' && entry.url.endsWith('/payments'),
        );
        expect(call).toBeDefined();
        return call!;
      });

      expect(posted.body).toMatchObject({
        patientId: PATIENT_ID,
        amount: '40.00',
        method: 'cash',
      });

      // The receipt is the point of taking the payment, so it is fetched too.
      await vi.waitFor(() => {
        expect(
          api.calls.some((entry) => entry.url.includes(`/payments/${makePayment().id}/receipt`)),
        ).toBe(true);
      });
    });

    it('is read-only for a doctor', async () => {
      await renderAccountTab(USER_ROLE.DOCTOR);

      await screen.findByRole('table');
      expect(
        screen.queryByRole('button', { name: ar.billing.recordPayment }),
      ).not.toBeInTheDocument();
    });

    it('offers the reversal to an admin', async () => {
      await renderAccountTab(USER_ROLE.ADMIN);

      await screen.findByRole('table');
      expect(screen.getByRole('button', { name: ar.billing.reverse })).toBeVisible();
    });

    it('does not offer it to a receptionist — only an admin may correct a payment', async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      await screen.findByRole('table');
      expect(screen.queryByRole('button', { name: ar.billing.reverse })).not.toBeInTheDocument();
    });

    it('suggests the outstanding balance without committing to it', async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      await userEvent.click(await screen.findByRole('button', { name: ar.billing.recordPayment }));

      // Prefilled, because a patient usually settles what they owe — but it is
      // an editable field, because often they do not.
      expect(await screen.findByLabelText(new RegExp(ar.billing.amount))).toHaveValue('100.00');
    });
  });

  describe('overdue balances', () => {
    const renderOverdue = async (role: UserRole) => {
      authTokens.clear();
      const api = mockApi(handlers(role));
      renderWithProviders(<AppRoutes />, { route: '/billing/overdue' });
      return api;
    };

    it('lists the debtor, the balance, the last payment and the phone', async () => {
      await renderOverdue(USER_ROLE.RECEPTIONIST);

      const link = await screen.findByRole('link', { name: 'أحمد خالد الحسن' });
      const row = link.closest('tr') as HTMLElement;

      expect(link).toHaveAttribute('href', `/patients/${PATIENT_ID}`);
      expect(within(row).getByText('300.00 USD')).toBeInTheDocument();
      expect(within(row).getByText(ar.billing.daysAgo.replace('{{count}}', '96'))).toBeVisible();
      expect(within(row).getByRole('link', { name: '+963931000001' })).toBeInTheDocument();
    });

    it('turns a doctor away — the matrix gives it to admin and reception', async () => {
      await renderOverdue(USER_ROLE.DOCTOR);

      expect(await screen.findByRole('heading', { name: ar.patients.title })).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: ar.billing.overdueTitle }),
      ).not.toBeInTheDocument();
    });
  });
});
