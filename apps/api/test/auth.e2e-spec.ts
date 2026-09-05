import { USER_ROLE } from '@clinic/shared';

import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from '@test/helpers/test-app';

describe('Auth (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
  });

  afterAll(async () => {
    await context.close();
  });

  const login = (identifier: string, password = TEST_PASSWORD) =>
    context.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier, password },
    });

  describe('login', () => {
    it('issues an access and a refresh token for a valid phone', async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN]);

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        expiresIn: expect.any(Number),
        user: { role: USER_ROLE.ADMIN, clinicId: clinic.id },
      });
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('never returns the password hash', async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN]);

      expect(JSON.stringify(response.json())).not.toContain('passwordHash');
      expect(JSON.stringify(response.json())).not.toContain('$argon2');
    });

    it('rejects a wrong password with the same message as an unknown identifier', async () => {
      const wrongPassword = await login(clinic.phones[USER_ROLE.ADMIN], 'NotThePassword1');
      const unknownUser = await login('+99900000000000');

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownUser.statusCode).toBe(401);
      expect(unknownUser.json().message).toBe(wrongPassword.json().message);
    });

    it('returns the error shape the frontend resolves by code', async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN], 'NotThePassword1');

      expect(response.json()).toEqual({
        statusCode: 401,
        message: expect.any(String),
        error: expect.any(String),
      });
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and returns a working access token', async () => {
      const first = (await login(clinic.phones[USER_ROLE.DOCTOR])).json();

      const refreshed = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: first.refreshToken },
      });

      expect(refreshed.statusCode).toBe(200);
      const body = refreshed.json();
      expect(body.refreshToken).not.toBe(first.refreshToken);

      const profile = await context.app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(body.accessToken),
      });

      expect(profile.statusCode).toBe(200);
      expect(profile.json()).toMatchObject({ role: USER_ROLE.DOCTOR, clinicId: clinic.id });
    });

    it('revokes the whole session when a rotated token is replayed', async () => {
      const first = (await login(clinic.phones[USER_ROLE.RECEPTIONIST])).json();

      const rotated = (
        await context.app.inject({
          method: 'POST',
          url: '/auth/refresh',
          payload: { refreshToken: first.refreshToken },
        })
      ).json();

      const replay = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: first.refreshToken },
      });

      expect(replay.statusCode).toBe(401);

      // Reuse means the token leaked, so the replacement is revoked too.
      const afterReuse = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: rotated.refreshToken },
      });

      expect(afterReuse.statusCode).toBe(401);
    });

    it('rejects an unknown refresh token', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'not-a-real-token' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and is idempotent', async () => {
      const session = (await login(clinic.phones[USER_ROLE.TECHNICIAN])).json();

      const first = await context.app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: { refreshToken: session.refreshToken },
      });
      const second = await context.app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: { refreshToken: session.refreshToken },
      });

      expect(first.statusCode).toBe(204);
      expect(second.statusCode).toBe(204);

      const refreshAfterLogout = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: session.refreshToken },
      });

      expect(refreshAfterLogout.statusCode).toBe(401);
    });
  });

  describe('protected routes', () => {
    it('rejects a request with no token', async () => {
      const response = await context.app.inject({ method: 'GET', url: '/me' });

      expect(response.statusCode).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/me',
        headers: auth('clearly.not.a.jwt'),
      });

      expect(response.statusCode).toBe(401);
    });

    it('leaves /health public for the container healthcheck', async () => {
      const response = await context.app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('change password', () => {
    it('changes the password and revokes existing sessions', async () => {
      const phone = clinic.phones[USER_ROLE.TECHNICIAN];
      const session = (await login(phone)).json();
      const newPassword = 'RotatedPassword456!';

      const changed = await context.app.inject({
        method: 'POST',
        url: '/me/change-password',
        headers: auth(session.accessToken),
        payload: { currentPassword: TEST_PASSWORD, newPassword },
      });

      expect(changed.statusCode).toBe(204);

      expect((await login(phone)).statusCode).toBe(401);
      expect((await login(phone, newPassword)).statusCode).toBe(200);

      const refreshAfterChange = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: session.refreshToken },
      });
      expect(refreshAfterChange.statusCode).toBe(401);
    });

    it('rejects a wrong current password', async () => {
      const token = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);

      const response = await context.app.inject({
        method: 'POST',
        url: '/me/change-password',
        headers: auth(token),
        payload: { currentPassword: 'WrongCurrent1', newPassword: 'Whatever12345' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
