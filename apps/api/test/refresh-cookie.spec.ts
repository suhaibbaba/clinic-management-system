import { refreshCookieSecurity } from '@api/auth/refresh-cookie';

// Both failures are silent — too strict and the browser drops the cookie without saying so, too
// loose and a session token crosses a plain-http hop.
describe('refreshCookieSecurity', () => {
  const base = {
    mode: 'auto',
    sameSite: 'lax',
    production: false,
    clientProtocol: 'http',
  } as const;

  describe('auto', () => {
    it('marks the cookie Secure in production', () => {
      // Even when the request looks like plain http — inside the Docker network
      // it always does, and nginx is the only thing that knows better.
      expect(refreshCookieSecurity({ ...base, production: true })).toEqual({
        secure: true,
        sameSite: 'lax',
      });
    });

    it('follows the browser scheme outside production', () => {
      expect(refreshCookieSecurity({ ...base, clientProtocol: 'https' }).secure).toBe(true);
      expect(refreshCookieSecurity({ ...base, clientProtocol: 'http' }).secure).toBe(false);
    });

    it('never lets a forwarded scheme talk production out of Secure', () => {
      // `X-Forwarded-Proto` is a header, and a header can be written by anyone
      // who can reach the deployment.
      expect(
        refreshCookieSecurity({ ...base, production: true, clientProtocol: 'http' }).secure,
      ).toBe(true);
    });
  });

  describe('always and never', () => {
    it('always is Secure whatever the request looked like', () => {
      expect(refreshCookieSecurity({ ...base, mode: 'always' }).secure).toBe(true);
    });

    it('never is not, production included', () => {
      expect(refreshCookieSecurity({ ...base, mode: 'never', production: true }).secure).toBe(
        false,
      );
    });
  });

  describe('SameSite', () => {
    it('passes lax and strict through', () => {
      expect(refreshCookieSecurity({ ...base, sameSite: 'strict' }).sameSite).toBe('strict');
      expect(refreshCookieSecurity({ ...base, sameSite: 'lax' }).sameSite).toBe('lax');
    });

    it('keeps none where the cookie is Secure', () => {
      expect(refreshCookieSecurity({ ...base, sameSite: 'none', production: true })).toEqual({
        secure: true,
        sameSite: 'none',
      });
    });

    it('falls back to lax where it is not, rather than sending a cookie no browser stores', () => {
      expect(refreshCookieSecurity({ ...base, sameSite: 'none', mode: 'never' })).toEqual({
        secure: false,
        sameSite: 'lax',
      });
    });
  });
});
