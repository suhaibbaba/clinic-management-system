import { randomUUID } from "node:crypto";
import { AUTH_ERROR, USER_ROLE, type LoginResponse } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics, users } from "@api/database/schema";
import { REFRESH_COOKIE_NAME } from "@api/modules/auth/lib/refresh-cookie";
import { createTestContext, TEST_PASSWORD, type TestContext } from "@test/helpers/test-app";

describe("The same email and phone in two clinics (e2e)", () => {
  let context: TestContext;
  const email = `shared-${randomUUID().slice(0, 8)}@example.test`;
  const phone = `+9725${String(Date.now()).slice(-8)}`;
  const accounts: { clinicId: string; userId: string; host: string }[] = [];

  beforeAll(async () => {
    context = await createTestContext();

    for (const label of ["first", "second"]) {
      const clinic = await context.createClinic();
      const host = `admin.${label}-${randomUUID().slice(0, 8)}.example.ps`;
      const userId = clinic.userIds[USER_ROLE.ADMIN];

      await context.db.update(clinics).set({ appDomain: host }).where(eq(clinics.id, clinic.id));
      await context.db.update(users).set({ email, phone }).where(eq(users.id, userId));
      accounts.push({ clinicId: clinic.id, userId, host });
    }
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  const signIn = (
    identifier: string,
    host: string,
    password = TEST_PASSWORD,
    headers: Record<string, string> = {},
  ) =>
    context.app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { ...headers, host },
      payload: { identifier, password },
    });

  it.each([
    ["email", () => email],
    ["phone", () => phone],
  ])("signs in by %s to the account of the clinic whose address was used", async (_, id) => {
    for (const { clinicId, userId, host } of accounts) {
      const response = await signIn(id(), host);

      expect(response.statusCode).toBe(200);
      expect(response.json<LoginResponse>().user).toMatchObject({ id: userId, clinicId });
    }
  });

  it("refuses the shared identifier where no clinic's address tells them apart", async () => {
    expect((await signIn(email, "localhost")).statusCode).toBe(401);
  });

  it("lets a clinic add staff whose email and phone another clinic already uses", async () => {
    const third = await context.createClinic();
    const token = await context.login(third.phones[USER_ROLE.ADMIN]);

    const response = await context.app.inject({
      method: "POST",
      url: "/users",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        firstName: { ar: "سهى", en: "Suha" },
        lastName: { ar: "علي", en: "Ali" },
        phone,
        email,
        role: USER_ROLE.RECEPTIONIST,
        isActive: true,
        joinedOn: "2026-01-01",
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it("still refuses an email twice inside one clinic", async () => {
    const [first] = accounts;
    const clinic = await context.createClinic();
    const token = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    const add = () =>
      context.app.inject({
        method: "POST",
        url: "/users",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          firstName: { ar: "سهى", en: "Suha" },
          lastName: { ar: "علي", en: "Ali" },
          phone: `+9725${String(Date.now() + 7).slice(-8)}`,
          email: `twice-${first?.clinicId.slice(0, 6)}@example.test`,
          role: USER_ROLE.RECEPTIONIST,
          isActive: true,
          joinedOn: "2026-01-01",
        },
      });

    expect((await add()).statusCode).toBe(201);
    expect((await add()).statusCode).toBe(409);
  });

  it("locks the identifier in one clinic only, and only that clinic's admin lifts it", async () => {
    const [first, second] = accounts;

    if (!first || !second) {
      throw new Error("Two accounts were expected");
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signIn(email, first.host, "wrong-password");
    }

    const locked = await signIn(email, first.host);

    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toMatchObject({ message: AUTH_ERROR.LOCKED });
    expect((await signIn(email, second.host)).statusCode).toBe(200);

    const secondAdmin = (await signIn(email, second.host)).json<LoginResponse>().accessToken;
    await context.app.inject({
      method: "POST",
      url: `/users/${second.userId}/unlock`,
      headers: { authorization: `Bearer ${secondAdmin}`, host: second.host },
    });

    expect((await signIn(email, first.host)).statusCode).toBe(429);
  });

  it.each(["vendor", "site"])("refuses staff sign-in on an address marked %s", async (entry) => {
    const [first] = accounts;

    expect(
      (await signIn(email, first?.host ?? "", TEST_PASSWORD, { "x-clinic-entry": entry }))
        .statusCode,
    ).toBe(401);
  });

  it("lets only one of two refreshes racing with the same token through", async () => {
    const [, second] = accounts;
    const signedIn = await signIn(phone, second?.host ?? "");
    const token =
      (signedIn.cookies as { name: string; value: string }[]).find(
        (cookie) => cookie.name === REFRESH_COOKIE_NAME,
      )?.value ?? "";

    const refresh = () =>
      context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${token}` },
        payload: {},
      });
    const results = await Promise.all([refresh(), refresh(), refresh()]);

    expect(results.filter((result) => result.statusCode === 200)).toHaveLength(1);
  });
});
