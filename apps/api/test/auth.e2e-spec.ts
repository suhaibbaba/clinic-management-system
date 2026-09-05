import { USER_ROLE } from '@clinic/shared';

import { REFRESH_COOKIE_NAME } from '@api/auth/refresh-cookie';
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

  /** The refresh cookie the API set on a response, if any. */
  const refreshCookie = (response: { cookies: unknown[] }) =>
    (
      response.cookies as { name: string; value: string; httpOnly?: boolean; sameSite?: string }[]
    ).find((cookie) => cookie.name === REFRESH_COOKIE_NAME);

  /** Replays a refresh cookie the way a browser would. */
  const withCookie = (token: string) => ({ cookie: `${REFRESH_COOKIE_NAME}=${token}` });

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

      // The refresh token is set as an httpOnly cookie and must never appear
      // in the body, so JavaScript on the page cannot read it.
      expect(body.refreshToken).toBeUndefined();
      const cookie = refreshCookie(response);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite?.toLowerCase()).toBe('lax');
      expect(typeof cookie?.value).toBe('string');
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
    it('rotates the refresh cookie and returns a working access token', async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.DOCTOR]);
      const firstToken = refreshCookie(loggedIn)?.value ?? '';

      const refreshed = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: withCookie(firstToken),
        payload: {},
      });

      expect(refreshed.statusCode).toBe(200);
      const body = refreshed.json();
      expect(body.refreshToken).toBeUndefined();
      expect(refreshCookie(refreshed)?.value).not.toBe(firstToken);

      const profile = await context.app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(body.accessToken),
      });

      expect(profile.statusCode).toBe(200);
      expect(profile.json()).toMatchObject({ role: USER_ROLE.DOCTOR, clinicId: clinic.id });
    });

    it('revokes the whole session when a rotated token is replayed', async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.RECEPTIONIST]);
      const firstToken = refreshCookie(loggedIn)?.value ?? '';

      const rotated = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: withCookie(firstToken),
        payload: {},
      });
      const rotatedToken = refreshCookie(rotated)?.value ?? '';

      const replay = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: withCookie(firstToken),
        payload: {},
      });

      expect(replay.statusCode).toBe(401);

      // Reuse means the token leaked, so the replacement is revoked too.
      const afterReuse = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: withCookie(rotatedToken),
        payload: {},
      });

      expect(afterReuse.statusCode).toBe(401);
    });

    it('still accepts a refresh token in the body for non-browser clients', async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.ADMIN]);
      const token = refreshCookie(loggedIn)?.value ?? '';

      const refreshed = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: token },
      });

      expect(refreshed.statusCode).toBe(200);
    });

    it('rejects a refresh with neither cookie nor body token', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
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
    it('revokes the refresh token, clears the cookie and is idempotent', async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.TECHNICIAN]);
      const token = refreshCookie(loggedIn)?.value ?? '';

      const first = await context.app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: withCookie(token),
        payload: {},
      });
      const second = await context.app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: withCookie(token),
        payload: {},
      });

      expect(first.statusCode).toBe(204);
      expect(second.statusCode).toBe(204);
      // An empty value with a past expiry is how a cookie is deleted.
      expect(refreshCookie(first)?.value).toBe('');

      const refreshAfterLogout = await context.app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: withCookie(token),
        payload: {},
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
      const loggedIn = await login(phone);
      const session = loggedIn.json();
      const sessionToken = refreshCookie(loggedIn)?.value ?? '';
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
        headers: withCookie(sessionToken),
        payload: {},
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
