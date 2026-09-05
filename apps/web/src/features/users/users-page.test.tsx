import { USER_ROLE, type User } from '@clinic/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import { makeProfile, makeUser, paginated } from '@test/helpers/fixtures';
import { mockApi, renderWithProviders } from '@test/helpers/render';

const admin = makeProfile();

function baseHandlers(users: User[]) {
  return {
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: admin },
    'GET /users': { status: 200, body: paginated(users) },
  };
}

async function renderUsersPage(users: User[]) {
  authTokens.clear();
  const api = mockApi(baseHandlers(users));
  renderWithProviders(<AppRoutes />, { route: '/users' });
  await screen.findByRole('heading', { name: ar.users.title });
  return api;
}

describe('Users management', () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it('lists users with their role and status', async () => {
    const user = makeUser();
    await renderUsersPage([user]);

    // Scoped to the row: the role also appears in the filter's options.
    const row = (await screen.findByText(user.name)).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText(user.phone)).toBeInTheDocument();
    expect(within(row!).getByText(ar.roles.doctor)).toBeInTheDocument();
    expect(within(row!).getByText(ar.users.active)).toBeInTheDocument();
  });

  it('shows the empty state when the clinic has no users yet', async () => {
    await renderUsersPage([]);

    expect(await screen.findByText(ar.users.empty)).toBeInTheDocument();
  });

  it('creates a user and sends exactly what the form collected', async () => {
    authTokens.clear();
    const created = makeUser({ name: 'سامر خليل', phone: '+963100000009' });

    const api = mockApi({
      ...baseHandlers([]),
      'POST /users': { status: 201, body: created },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });
    await screen.findByRole('heading', { name: ar.users.title });

    await userEvent.click(screen.getAllByRole('button', { name: ar.users.create })[0]!);

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(ar.users.name), created.name);
    await userEvent.type(within(dialog).getByLabelText(ar.users.phone), created.phone);
    await userEvent.selectOptions(
      within(dialog).getByLabelText(ar.users.role),
      USER_ROLE.RECEPTIONIST,
    );
    await userEvent.type(within(dialog).getByLabelText(ar.users.password), 'NewUserPass123!');
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find(
        (entry) => entry.method === 'POST' && entry.url.endsWith('/users'),
      );
      expect(call?.body).toMatchObject({
        name: created.name,
        phone: created.phone,
        role: USER_ROLE.RECEPTIONIST,
        password: 'NewUserPass123!',
        isActive: true,
      });
      // The clinic is taken from the token; the client must never send one.
      expect(call?.body).not.toHaveProperty('clinicId');
    });
  });

  it('edits a user without touching the password', async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      'PATCH /users/33333333-3333-4333-8333-333333333333': {
        status: 200,
        body: { ...user, name: 'ليلى حداد المحدّث' },
      },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });
    await screen.findByText(user.name);

    await userEvent.click(screen.getByRole('button', { name: ar.common.edit }));

    const dialog = await screen.findByRole('dialog');
    // Editing must not offer a password field.
    expect(within(dialog).queryByLabelText(ar.users.password)).not.toBeInTheDocument();

    const nameInput = within(dialog).getByLabelText(ar.users.name);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'ليلى حداد المحدّث');
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.method === 'PATCH');
      expect(call?.body).toMatchObject({ name: 'ليلى حداد المحدّث' });
      expect(call?.body).not.toHaveProperty('password');
    });
  });

  it('deactivates a user from the table', async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      'PATCH /users/33333333-3333-4333-8333-333333333333': {
        status: 200,
        body: { ...user, isActive: false },
      },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });
    await screen.findByText(user.name);

    await userEvent.click(screen.getByRole('switch', { name: ar.users.deactivate }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.method === 'PATCH');
      expect(call?.body).toEqual({ isActive: false });
    });
  });

  it('resets a password through the dedicated endpoint', async () => {
    authTokens.clear();
    const user = makeUser();

    const api = mockApi({
      ...baseHandlers([user]),
      'POST /users/33333333-3333-4333-8333-333333333333/reset-password': { status: 204 },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });
    await screen.findByText(user.name);

    await userEvent.click(screen.getByRole('button', { name: ar.users.resetPassword }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(ar.users.newPassword), 'ResetByAdmin123!');
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    await waitFor(() => {
      const call = api.calls.find((entry) => entry.url.includes('/reset-password'));
      expect(call?.body).toEqual({ newPassword: 'ResetByAdmin123!' });
    });
  });

  it('surfaces a duplicate phone number as an Arabic message', async () => {
    authTokens.clear();

    mockApi({
      ...baseHandlers([]),
      'POST /users': {
        status: 409,
        body: { statusCode: 409, message: 'Phone number is already in use', error: 'Conflict' },
      },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });
    await screen.findByRole('heading', { name: ar.users.title });

    await userEvent.click(screen.getAllByRole('button', { name: ar.users.create })[0]!);

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(ar.users.name), 'اسم مكرر');
    await userEvent.type(within(dialog).getByLabelText(ar.users.phone), '+963100000002');
    await userEvent.selectOptions(within(dialog).getByLabelText(ar.users.role), USER_ROLE.DOCTOR);
    await userEvent.type(within(dialog).getByLabelText(ar.users.password), 'SomePassword123!');
    await userEvent.click(within(dialog).getByRole('button', { name: ar.common.save }));

    // Resolved from the status code, never from the backend's English text.
    expect(await screen.findByText(ar.errors.conflict)).toBeInTheDocument();
  });
});
