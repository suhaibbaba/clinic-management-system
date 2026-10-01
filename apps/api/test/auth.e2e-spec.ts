import { AUTH_ERROR, USER_ROLE, type UserRole } from "@clinic/shared";
import { eq, sql } from "drizzle-orm";
import { loginCodes, loginThrottles, users } from "@api/database/schema";
import { REFRESH_COOKIE_NAME } from "@api/modules/auth/lib/refresh-cookie";
import { loginThrottleKey } from "@api/modules/auth/lib/login-throttle";
import { EMAIL_PROVIDER } from "@api/modules/email/constants";
import { type EmailProvider, type OutboundEmail } from "@api/modules/email/lib/email-provider";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";

describe("Auth (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  const login = (identifier: string, password = TEST_PASSWORD) =>
    context.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier, password },
    });

  const refreshCookie = (response: { cookies: unknown[] }) =>
    (
      response.cookies as {
        name: string;
        value: string;
        httpOnly?: boolean;
        sameSite?: string;
        secure?: boolean;
        path?: string;
      }[]
    ).find((cookie) => cookie.name === REFRESH_COOKIE_NAME);

  const withCookie = (token: string) => ({ cookie: `${REFRESH_COOKIE_NAME}=${token}` });

  describe("login", () => {
    it("issues an access and a refresh token for a valid phone", async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN]);

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toMatchObject({
        expiresIn: expect.any(Number),
        user: { role: USER_ROLE.ADMIN, clinicId: clinic.id },
      });
      expect(typeof body.accessToken).toBe("string");

      expect(body.refreshToken).toBeUndefined();
      const cookie = refreshCookie(response);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite?.toLowerCase()).toBe("lax");
      expect(typeof cookie?.value).toBe("string");
    });

    it("never returns the password hash", async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN]);

      expect(JSON.stringify(response.json())).not.toContain("passwordHash");
      expect(JSON.stringify(response.json())).not.toContain("$argon2");
    });

    it("rejects a wrong password with the same message as an unknown identifier", async () => {
      const wrongPassword = await login(clinic.phones[USER_ROLE.ADMIN], "NotThePassword1");
      const unknownUser = await login("+99900000000000");

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownUser.statusCode).toBe(401);
      expect(unknownUser.json().message).toBe(wrongPassword.json().message);
    });

    it("locks an identifier after five failures, even against the right password", async () => {
      const other = await context.createClinic();
      const phone = other.phones[USER_ROLE.TECHNICIAN];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await login(phone, "NotThePassword1")).statusCode).toBe(401);
      }

      const locked = await login(phone);
      expect(locked.statusCode).toBe(429);
      expect(locked.json().message).toBe(AUTH_ERROR.LOCKED);
    });

    it("locks an unknown identifier the same way, so a lock reveals no account", async () => {
      const unknown = "+97000000123";
      await context.db
        .delete(loginThrottles)
        .where(eq(loginThrottles.key, loginThrottleKey(unknown)));

      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await login(unknown)).statusCode).toBe(401);
      }

      expect((await login(unknown)).statusCode).toBe(429);
    });

    it("starts the count again after a successful login", async () => {
      const other = await context.createClinic();
      const phone = other.phones[USER_ROLE.RECEPTIONIST];

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await login(phone, "NotThePassword1");
      }
      expect((await login(phone)).statusCode).toBe(200);

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await login(phone, "NotThePassword1");
      }
      expect((await login(phone)).statusCode).toBe(200);
    });

    it("ends a deactivated user's session at once, not when the access token expires", async () => {
      const other = await context.createClinic();
      const admin = await context.login(other.phones[USER_ROLE.ADMIN]);
      const technician = await context.login(other.phones[USER_ROLE.TECHNICIAN]);
      const me = () => context.app.inject({ method: "GET", url: "/me", headers: auth(technician) });

      expect((await me()).statusCode).toBe(200);

      const deactivated = await context.app.inject({
        method: "PATCH",
        url: `/users/${other.userIds[USER_ROLE.TECHNICIAN]}`,
        headers: auth(admin),
        payload: { isActive: false },
      });
      expect(deactivated.statusCode).toBe(200);

      expect((await me()).statusCode).toBe(401);
    });

    it("stops a token issued before a role change", async () => {
      const other = await context.createClinic();
      const admin = await context.login(other.phones[USER_ROLE.ADMIN]);
      const receptionist = await context.login(other.phones[USER_ROLE.RECEPTIONIST]);

      await context.app.inject({
        method: "PATCH",
        url: `/users/${other.userIds[USER_ROLE.RECEPTIONIST]}`,
        headers: auth(admin),
        payload: { role: USER_ROLE.TECHNICIAN },
      });

      const stale = await context.app.inject({
        method: "GET",
        url: "/me",
        headers: auth(receptionist),
      });
      expect(stale.statusCode).toBe(401);
    });

    it("returns the error shape the frontend resolves by code", async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN], "NotThePassword1");

      expect(response.json()).toEqual({
        statusCode: 401,
        message: expect.any(String),
        error: expect.any(String),
      });
    });
  });

  describe("refresh", () => {
    it("rotates the refresh cookie and returns a working access token", async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.DOCTOR]);
      const firstToken = refreshCookie(loggedIn)?.value ?? "";

      const refreshed = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: withCookie(firstToken),
        payload: {},
      });

      expect(refreshed.statusCode).toBe(200);
      const body = refreshed.json();
      expect(body.refreshToken).toBeUndefined();
      expect(refreshCookie(refreshed)?.value).not.toBe(firstToken);

      const profile = await context.app.inject({
        method: "GET",
        url: "/me",
        headers: auth(body.accessToken),
      });

      expect(profile.statusCode).toBe(200);
      expect(profile.json()).toMatchObject({ role: USER_ROLE.DOCTOR, clinicId: clinic.id });
    });

    it("revokes the whole session when a rotated token is replayed", async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.RECEPTIONIST]);
      const firstToken = refreshCookie(loggedIn)?.value ?? "";

      const rotated = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: withCookie(firstToken),
        payload: {},
      });
      const rotatedToken = refreshCookie(rotated)?.value ?? "";

      const replay = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: withCookie(firstToken),
        payload: {},
      });

      expect(replay.statusCode).toBe(401);

      const afterReuse = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: withCookie(rotatedToken),
        payload: {},
      });

      expect(afterReuse.statusCode).toBe(401);
    });

    it("still accepts a refresh token in the body for non-browser clients", async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.ADMIN]);
      const token = refreshCookie(loggedIn)?.value ?? "";

      const refreshed = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: token },
      });

      expect(refreshed.statusCode).toBe(200);
    });

    it("rejects a refresh with neither cookie nor body token", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects an unknown refresh token", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "not-a-real-token" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("logout", () => {
    it("revokes the refresh token, clears the cookie and is idempotent", async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.TECHNICIAN]);
      const token = refreshCookie(loggedIn)?.value ?? "";

      const first = await context.app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: withCookie(token),
        payload: {},
      });
      const second = await context.app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: withCookie(token),
        payload: {},
      });

      expect(first.statusCode).toBe(204);
      expect(second.statusCode).toBe(204);
      expect(refreshCookie(first)?.value).toBe("");

      const refreshAfterLogout = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: withCookie(token),
        payload: {},
      });

      expect(refreshAfterLogout.statusCode).toBe(401);
    });
  });

  describe("the refresh cookie", () => {
    it("is scoped to a path that covers the refresh endpoint through the proxy", async () => {
      const path = refreshCookie(await login(clinic.phones[USER_ROLE.ADMIN]))?.path;

      expect(path).toBe("/");
    });

    it("is not Secure over plain http, so a development browser keeps it", async () => {
      const response = await login(clinic.phones[USER_ROLE.ADMIN]);

      expect(refreshCookie(response)?.secure).toBeFalsy();
    });

    it("is Secure when the proxy says the browser used https", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/auth/login",
        headers: { "x-forwarded-proto": "https" },
        payload: { identifier: clinic.phones[USER_ROLE.ADMIN], password: TEST_PASSWORD },
      });

      expect(refreshCookie(response)?.secure).toBe(true);
    });

    it("clears with the same attributes it was set with", async () => {
      const loggedIn = await login(clinic.phones[USER_ROLE.ADMIN]);
      const cleared = await context.app.inject({
        method: "POST",
        url: "/auth/logout",
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshCookie(loggedIn)?.value ?? ""}` },
        payload: {},
      });

      expect(refreshCookie(cleared)?.path).toBe(refreshCookie(loggedIn)?.path);
      expect(refreshCookie(cleared)?.sameSite).toBe(refreshCookie(loggedIn)?.sameSite);
    });
  });

  describe("protected routes", () => {
    it("rejects a request with no token", async () => {
      const response = await context.app.inject({ method: "GET", url: "/me" });

      expect(response.statusCode).toBe(401);
    });

    it("rejects a malformed token", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: "/me",
        headers: auth("clearly.not.a.jwt"),
      });

      expect(response.statusCode).toBe(401);
    });

    it("leaves /health public for the container healthcheck", async () => {
      const response = await context.app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("change password", () => {
    it("changes the password and revokes existing sessions", async () => {
      const phone = clinic.phones[USER_ROLE.TECHNICIAN];
      const loggedIn = await login(phone);
      const session = loggedIn.json();
      const sessionToken = refreshCookie(loggedIn)?.value ?? "";
      const newPassword = "RotatedPassword456!";

      const changed = await context.app.inject({
        method: "POST",
        url: "/me/change-password",
        headers: auth(session.accessToken),
        payload: { currentPassword: TEST_PASSWORD, newPassword },
      });

      expect(changed.statusCode).toBe(204);

      expect((await login(phone)).statusCode).toBe(401);
      expect((await login(phone, newPassword)).statusCode).toBe(200);

      const refreshAfterChange = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: withCookie(sessionToken),
        payload: {},
      });
      expect(refreshAfterChange.statusCode).toBe(401);
    });

    it("rejects a wrong current password", async () => {
      const token = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);

      const response = await context.app.inject({
        method: "POST",
        url: "/me/change-password",
        headers: auth(token),
        payload: { currentPassword: "WrongCurrent1", newPassword: "Whatever12345" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("sign-in by email code", () => {
    let sent: OutboundEmail[];

    beforeEach(() => {
      sent = [];
      jest
        .spyOn(context.app.get<EmailProvider>(EMAIL_PROVIDER), "send")
        .mockImplementation((email) => {
          sent.push(email);
          return Promise.resolve();
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const emailOf = async (codeClinic: TestClinic, role: UserRole): Promise<string> => {
      const [row] = await context.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, codeClinic.userIds[role]));

      return row?.email ?? "";
    };

    const requestCode = (email: string) =>
      context.app.inject({ method: "POST", url: "/auth/login-code", payload: { email } });

    const verifyCode = (email: string, code: string) =>
      context.app.inject({
        method: "POST",
        url: "/auth/login-code/verify",
        payload: { email, code },
      });

    const codeSentTo = async (email: string): Promise<string> => {
      for (let tries = 0; tries < 50; tries += 1) {
        const message = sent.findLast((candidate) => candidate.to === email);
        const code = message?.text.match(/^\d{6}$/m)?.[0];

        if (code) {
          return code;
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      throw new Error(`No sign-in code reached ${email}`);
    };

    const wrongCode = (code: string): string =>
      String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    const allowResend = (email: string) =>
      context.db
        .update(loginCodes)
        .set({ createdAt: sql`${loginCodes.createdAt} - interval '2 minutes'` })
        .where(
          eq(
            loginCodes.userId,
            sql`(select ${users.id} from ${users} where lower(${users.email}) = ${email})`,
          ),
        );

    it("emails a code that signs in once, with the same session as a password", async () => {
      const codeClinic = await context.createClinic();
      const email = await emailOf(codeClinic, USER_ROLE.DOCTOR);

      const requested = await requestCode(email.toUpperCase());
      expect(requested.statusCode).toBe(204);

      const code = await codeSentTo(email);
      expect(JSON.stringify(sent)).not.toContain("http");

      const signedIn = await verifyCode(email, code);
      expect(signedIn.statusCode).toBe(200);
      expect(signedIn.json()).toMatchObject({
        user: { id: codeClinic.userIds[USER_ROLE.DOCTOR], clinicId: codeClinic.id },
      });
      expect(signedIn.json().refreshToken).toBeUndefined();
      expect(refreshCookie(signedIn)?.httpOnly).toBe(true);

      expect((await verifyCode(email, code)).statusCode).toBe(401);
    });

    it("answers an unknown email exactly like a known one and sends nothing", async () => {
      const response = await requestCode("nobody.here@test.local");

      expect(response.statusCode).toBe(204);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sent).toHaveLength(0);

      const verified = await verifyCode("nobody.here@test.local", "123456");
      expect(verified.statusCode).toBe(401);
      expect(verified.json()).toMatchObject({ message: AUTH_ERROR.CODE_INVALID });
    });

    it("burns the code after five wrong tries, even when the sixth is right", async () => {
      const codeClinic = await context.createClinic();
      const email = await emailOf(codeClinic, USER_ROLE.TECHNICIAN);

      await requestCode(email);
      const code = await codeSentTo(email);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await verifyCode(email, wrongCode(code))).statusCode).toBe(401);
      }

      expect((await verifyCode(email, code)).statusCode).toBe(429);

      await context.db
        .delete(loginThrottles)
        .where(eq(loginThrottles.key, loginThrottleKey(email)));
      expect((await verifyCode(email, code)).statusCode).toBe(401);
    });

    it("refuses an expired code", async () => {
      const codeClinic = await context.createClinic();
      const email = await emailOf(codeClinic, USER_ROLE.RECEPTIONIST);

      await requestCode(email);
      const code = await codeSentTo(email);

      await context.db
        .update(loginCodes)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(loginCodes.userId, codeClinic.userIds[USER_ROLE.RECEPTIONIST]));

      expect((await verifyCode(email, code)).statusCode).toBe(401);
    });

    it("holds a resend back for a minute, and a new code retires the old one", async () => {
      const codeClinic = await context.createClinic();
      const email = await emailOf(codeClinic, USER_ROLE.ADMIN);

      await requestCode(email);
      const first = await codeSentTo(email);

      expect((await requestCode(email)).statusCode).toBe(204);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sent).toHaveLength(1);

      await allowResend(email);
      await requestCode(email);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sent).toHaveLength(2);
      const second = await codeSentTo(email);

      if (first !== second) {
        expect((await verifyCode(email, first)).statusCode).toBe(401);
      }
      expect((await verifyCode(email, second)).statusCode).toBe(200);
    });

    it("sends at most five codes an hour to one account", async () => {
      const codeClinic = await context.createClinic();
      const email = await emailOf(codeClinic, USER_ROLE.DOCTOR);

      for (let request = 0; request < 5; request += 1) {
        await requestCode(email);
        await codeSentTo(email);
        await allowResend(email);
        context.resetThrottle();
      }

      await requestCode(email);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sent).toHaveLength(5);
    });

    it("gives a deactivated account no code and no session", async () => {
      const codeClinic = await context.createClinic();
      const email = await emailOf(codeClinic, USER_ROLE.TECHNICIAN);

      await requestCode(email);
      const code = await codeSentTo(email);

      await context.db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.id, codeClinic.userIds[USER_ROLE.TECHNICIAN]));

      expect((await verifyCode(email, code)).statusCode).toBe(401);

      sent = [];
      await allowResend(email);
      await requestCode(email);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sent).toHaveLength(0);
    });

    it("validates the email and the code shape", async () => {
      expect((await requestCode("not-an-email")).statusCode).toBe(400);
      expect((await verifyCode("someone@test.local", "12ab56")).statusCode).toBe(400);
      expect((await verifyCode("someone@test.local", "12345")).statusCode).toBe(400);
    });
  });
});
