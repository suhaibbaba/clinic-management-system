import { randomUUID } from 'node:crypto';

import { USER_ROLE, type UserRole } from '@clinic/shared';

import { REFRESH_COOKIE_NAME } from '@api/auth/refresh-cookie';
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from '@test/helpers/test-app';

/** Endpoints added so the web app can manage users and pick a specialty. */
describe('Admin user management and specialties (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  describe('PATCH /me', () => {
    it('lets anybody correct their own name and contact details', async () => {
      // A unique address per run: identifiers are unique system-wide and this database outlives
      // the suite that writes to it.
      const email = `me.${randomUUID()}@test.local`;
      const response = await context.app.inject({
        method: 'PATCH',
        url: '/me',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { name: { ar: 'مؤيد كنعان', en: 'Muayyad Kanaan' }, email },
      });
      const body = response.json<{ name: { ar: string }; email: string; role: string }>();

      expect(response.statusCode).toBe(200);
      expect(body.name.ar).toBe('مؤيد كنعان');
      expect(body.email).toBe(email);
      // The whole profile comes back, so the session the caller holds can be replaced with it.
      expect(body.role).toBe(USER_ROLE.TECHNICIAN);
    });

    it('is not a way to change your own role', async () => {
      const escalate = await context.app.inject({
        method: 'PATCH',
        url: '/me',
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { role: USER_ROLE.ADMIN },
      });

      // `role` is not a field of the schema at all, so the body carries nothing writable.
      expect(escalate.statusCode).toBe(400);

      const after = await context.app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(after.json<{ role: string }>().role).toBe(USER_ROLE.RECEPTIONIST);
    });

    it('refuses a phone another account already answers to', async () => {
      const phone = `+9725${String(Date.now()).slice(-7)}`;
      const created = await context.app.inject({
        method: 'POST',
        url: '/users',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          name: { ar: 'زميل', en: 'Colleague' },
          phone,
          role: USER_ROLE.RECEPTIONIST,
          password: TEST_PASSWORD,
        },
      });

      expect(created.statusCode).toBe(201);

      const response = await context.app.inject({
        method: 'PATCH',
        url: '/me',
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { phone },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('sets a new password, ends existing sessions and records the reset', async () => {
      const phone = clinic.phones[USER_ROLE.RECEPTIONIST];
      const userId = clinic.userIds[USER_ROLE.RECEPTIONIST];
      const newPassword = 'AdminResetPass123!';

      const loggedIn = await context.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: phone, password: TEST_PASSWORD },
      });
      const sessionCookie = (response: { cookies: unknown[] }): string =>
        (response.cookies as { name: string; value: string }[]).find(
          (cookie) => cookie.name === REFRESH_COOKIE_NAME,
        )?.value ?? '';

      const reset = await context.app.inject({
        method: 'POST',
        url: `/users/${userId}/reset-password`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { newPassword },
      });

      expect(reset.statusCode).toBe(204);

      const withOld = await context.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: phone, password: TEST_PASSWORD },
      });
      const withNew = await context.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: phone, password: newPassword },
      });

      expect(withOld.statusCode).toBe(401);
      expect(withNew.statusCode).toBe(200);

      // The session held before the reset must be dead.
      const refreshOld = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${sessionCookie(loggedIn)}` },
        payload: {},
      });
      expect(refreshOld.statusCode).toBe(401);

      // Recorded as a fact, never as a value.
      const trail = await context.app.inject({
        method: 'GET',
        url: `/audit-log?entityId=${userId}&limit=50`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      const entries = trail.json().items as { newValue: Record<string, unknown> | null }[];
      const resetEntry = entries.find((entry) => entry.newValue?.['passwordReset'] === true);

      expect(resetEntry).toBeDefined();
      expect(JSON.stringify(entries)).not.toContain(newPassword);
      expect(JSON.stringify(entries)).not.toContain('$argon2');
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s',
      async (role) => {
        const response = await context.app.inject({
          method: 'POST',
          url: `/users/${clinic.userIds[USER_ROLE.TECHNICIAN]}/reset-password`,
          headers: auth(tokens[role]),
          payload: { newPassword: 'ShouldNotWork123!' },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it('returns 404 for a user in another clinic', async () => {
      const other = await context.createClinic();

      const response = await context.app.inject({
        method: 'POST',
        url: `/users/${other.userIds[USER_ROLE.DOCTOR]}/reset-password`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { newPassword: 'ShouldNotWork123!' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /specialties', () => {
    it.each([USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'is readable by %s',
      async (role) => {
        const response = await context.app.inject({
          method: 'GET',
          url: '/specialties',
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(200);
        const items = response.json().items as { id: string; clinicId: string }[];
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((item) => item.clinicId === clinic.id)).toBe(true);
      },
    );

    it('requires authentication', async () => {
      const response = await context.app.inject({ method: 'GET', url: '/specialties' });

      expect(response.statusCode).toBe(401);
    });
  });
});
