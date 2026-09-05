import { USER_ROLE, type UserRole } from '@clinic/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '@web/app/router';
import ar from '@web/i18n/locales/ar.json';
import { authTokens } from '@web/lib/auth-tokens';
import { makeProfile, paginated } from '@test/helpers/fixtures';
import { mockApi, renderWithProviders } from '@test/helpers/render';

/** Signs in as `role` and lands on a page every role may open. */
async function renderAs(role: UserRole): Promise<void> {
  authTokens.clear();
  const profile = makeProfile({ role, name: `مستخدم ${role}` });

  mockApi({
    'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
    'GET /me': { status: 200, body: profile },
    'GET /doctors': { status: 200, body: paginated([]) },
    'GET /users': { status: 200, body: paginated([]) },
    'GET /audit-log': { status: 200, body: paginated([]) },
  });

  renderWithProviders(<AppRoutes />, { route: '/doctors' });
  await screen.findByText(profile.name);
}

const ADMIN_ONLY_LINKS = [ar.nav.users, ar.nav.audit];
const SHARED_LINKS = [ar.nav.doctors, ar.nav.clinic, ar.nav.profile];

describe('Sidebar navigation', () => {
  it('shows every entry to an admin', async () => {
    await renderAs(USER_ROLE.ADMIN);

    for (const label of [...SHARED_LINKS, ...ADMIN_ONLY_LINKS]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it.each([USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST])(
    'hides the admin-only entries from %s',
    async (role) => {
      await renderAs(role);

      for (const label of SHARED_LINKS) {
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
      }

      for (const label of ADMIN_ONLY_LINKS) {
        expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
      }
    },
  );

  it('shows the signed-in user with their translated role', async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    expect(screen.getByText(ar.roles.receptionist)).toBeInTheDocument();
  });

  /*
   * Signing out lives behind the account menu now. The menu is what a user has
   * to get through to reach it, so the test opens it rather than reaching for
   * a button that is no longer on the page.
   */
  it('offers profile, both languages and sign-out behind the account menu', async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    await userEvent.click(screen.getByRole('button', { name: new RegExp(ar.roles.receptionist) }));

    expect(await screen.findByRole('menuitem', { name: ar.nav.profile })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'العربية' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: ar.nav.logout })).toBeInTheDocument();
  });

  it('refuses an admin-only route to a non-admin who types its URL', async () => {
    authTokens.clear();
    const profile = makeProfile({ role: USER_ROLE.RECEPTIONIST });

    mockApi({
      'POST /auth/refresh': { status: 200, body: { accessToken: 'access', expiresIn: 900 } },
      'GET /me': { status: 200, body: profile },
      'GET /users': { status: 200, body: paginated([]) },
    });

    renderWithProviders(<AppRoutes />, { route: '/users' });

    // The guard renders the refusal; the API would refuse it too.
    expect(await screen.findByText(ar.errors.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ar.users.create })).not.toBeInTheDocument();
  });
});
