import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import { LoginPage } from '@web/features/auth/login-page';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import { makeProfile, paginated } from '@test/helpers/fixtures';
import { mockApi, renderWithProviders } from '@test/helpers/render';

/** No signed-in session: the silent refresh on mount fails. */
const NO_SESSION = { 'POST /auth/refresh': { status: 401, body: {} } };

describe('Login flow', () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it('signs in and stores the access token in memory only', async () => {
    const profile = makeProfile();
    mockApi({
      ...NO_SESSION,
      'POST /auth/login': {
        status: 200,
        body: { accessToken: 'access-1', expiresIn: 900, user: profile },
      },
    });

    renderWithProviders(<LoginPage />, { route: '/login' });

    await userEvent.type(screen.getByLabelText(ar.auth.identifier), 'admin@clinic.local');
    await userEvent.type(screen.getByLabelText(ar.auth.password), 'ChangeMe123!');
    await userEvent.click(screen.getByRole('button', { name: ar.auth.submit }));

    await waitFor(() => {
      expect(authTokens.get()).toBe('access-1');
    });

    // Never persisted anywhere a script could read it after a reload.
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows an Arabic message when the password is wrong and keeps the user signed out', async () => {
    mockApi({
      ...NO_SESSION,
      'POST /auth/login': {
        status: 401,
        body: { statusCode: 401, message: 'Invalid credentials', error: 'Unauthorized' },
      },
    });

    renderWithProviders(<LoginPage />, { route: '/login' });

    await userEvent.type(screen.getByLabelText(ar.auth.identifier), 'admin@clinic.local');
    await userEvent.type(screen.getByLabelText(ar.auth.password), 'WrongPassword1');
    await userEvent.click(screen.getByRole('button', { name: ar.auth.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ar.auth.invalidCredentials);
    expect(authTokens.get()).toBeNull();
  });

  it('validates before calling the API', async () => {
    const { calls } = mockApi(NO_SESSION);

    renderWithProviders(<LoginPage />, { route: '/login' });

    await userEvent.type(screen.getByLabelText(ar.auth.identifier), 'admin@clinic.local');
    await userEvent.type(screen.getByLabelText(ar.auth.password), 'short');
    await userEvent.click(screen.getByRole('button', { name: ar.auth.submit }));

    expect(await screen.findByText(ar.errors.validation.passwordMin)).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes('/auth/login'))).toBe(false);
  });

  it('refreshes once on a 401 and replays the request', async () => {
    const profile = makeProfile();
    let meCalls = 0;
    let refreshCalls = 0;

    mockApi({
      // The cold-load refresh succeeds, so the app tries /me.
      'POST /auth/refresh': () => {
        refreshCalls += 1;
        return { status: 200, body: { accessToken: `access-${refreshCalls}`, expiresIn: 900 } };
      },
      // The first /me is rejected as if the access token had just expired.
      'GET /me': () => {
        meCalls += 1;
        return meCalls === 1
          ? { status: 401, body: { statusCode: 401 } }
          : { status: 200, body: profile };
      },
      'GET /doctors': { status: 200, body: paginated([]) },
    });

    renderWithProviders(<AppRoutes />, { route: '/doctors' });

    // The retried /me succeeded, so the shell renders with the user on it.
    expect(await screen.findByText(profile.name)).toBeInTheDocument();
    expect(meCalls).toBe(2);
    // Once on cold load, once for the 401 — not one refresh per failed call.
    expect(refreshCalls).toBe(2);
    expect(authTokens.get()).toBe('access-2');
  });

  it('sends the user back to the login screen when the refresh also fails', async () => {
    mockApi({
      'POST /auth/refresh': { status: 401, body: {} },
      'GET /me': { status: 401, body: {} },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });

    expect(await screen.findByRole('button', { name: ar.auth.submit })).toBeInTheDocument();
  });
});
