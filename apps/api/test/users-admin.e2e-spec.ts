import { randomUUID } from "node:crypto";
import { nationalPhoneDigits, USER_ROLE, type UserRole } from "@clinic/shared";
import { sql } from "drizzle-orm";
import { nationalPhoneDigitsOf } from "@api/common/lib/phone";
import { users } from "@api/database/schema";
import { REFRESH_COOKIE_NAME } from "@api/modules/auth/lib/refresh-cookie";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";
import { staffName } from "@test/helpers/staff-name";

describe("Admin user management and specialties (e2e)", () => {
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

  describe("PATCH /users/:id on your own account", () => {
    const own = (role: UserRole): string => clinic.userIds[role];
    const withoutJoinedOn = ({ joinedOn: _, ...name }: ReturnType<typeof staffName>) => name;

    it("lets anybody correct their own name and contact details", async () => {
      const email = `me.${randomUUID()}@test.local`;
      const response = await context.app.inject({
        method: "PATCH",
        url: `/users/${own(USER_ROLE.TECHNICIAN)}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { ...withoutJoinedOn(staffName("مؤيد كنعان", "Muayyad Kanaan")), email },
      });
      const body = response.json<{ name: { ar: string }; email: string; role: string }>();

      expect(response.statusCode).toBe(200);
      expect(body.name.ar).toBe("مؤيد كنعان");
      expect(body.email).toBe(email);
      expect(body.role).toBe(USER_ROLE.TECHNICIAN);
    });

    it("lets anybody read their own account, and nobody else's", async () => {
      const mine = await context.app.inject({
        method: "GET",
        url: `/users/${own(USER_ROLE.RECEPTIONIST)}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });
      const theirs = await context.app.inject({
        method: "GET",
        url: `/users/${own(USER_ROLE.DOCTOR)}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(mine.statusCode).toBe(200);
      expect(theirs.statusCode).toBe(403);
    });

    it.each([
      ["role", { role: USER_ROLE.ADMIN }],
      ["status", { isActive: false }],
      ["joining date", { joinedOn: "2020-01-01" }],
    ])("is not a way to change your own %s", async (_label, payload) => {
      const escalate = await context.app.inject({
        method: "PATCH",
        url: `/users/${own(USER_ROLE.RECEPTIONIST)}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload,
      });

      expect(escalate.statusCode).toBe(403);

      const after = await context.app.inject({
        method: "GET",
        url: "/me",
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(after.json<{ role: string; isActive: boolean }>()).toMatchObject({
        role: USER_ROLE.RECEPTIONIST,
        isActive: true,
      });
    });

    it("refuses an edit of a colleague's account", async () => {
      const response = await context.app.inject({
        method: "PATCH",
        url: `/users/${own(USER_ROLE.DOCTOR)}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: withoutJoinedOn(staffName("منتحل", "Impostor")),
      });

      expect(response.statusCode).toBe(403);
    });

    it("refuses a phone another account already answers to", async () => {
      const phone = `+9725${String(Date.now()).slice(-7)}`;
      const created = await context.app.inject({
        method: "POST",
        url: "/users",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          ...staffName("زميل", "Colleague"),
          phone,
          role: USER_ROLE.RECEPTIONIST,
          password: TEST_PASSWORD,
        },
      });

      expect(created.statusCode).toBe(201);

      const response = await context.app.inject({
        method: "PATCH",
        url: `/users/${own(USER_ROLE.DOCTOR)}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { phone },
      });

      expect(response.statusCode).toBe(409);
    });

    describe("one national number, one account", () => {
      const national = () => `59${String(Date.now()).slice(-7)}`;
      const row = (phone: string) => ({
        clinicId: clinic.id,
        firstName: { ar: "زميل", en: "Colleague" },
        lastName: { ar: "مكرر", en: "Twin" },
        name: { ar: "زميل مكرر", en: "Colleague Twin" },
        phone,
        role: USER_ROLE.RECEPTIONIST,
      });

      it.each(["+972", "+962", "00970"])(
        "refuses the same number under %s in the database itself",
        async (dial) => {
          const number = national();
          await context.db.insert(users).values(row(`+970${number}`));

          await expect(
            context.db.insert(users).values(row(`${dial}${number}`)),
          ).rejects.toMatchObject({
            cause: { code: "23505", constraint_name: "users_phone_uniq" },
          });
        },
      );

      it("answers 409 for the same number under another country code", async () => {
        const number = national();
        await context.db.insert(users).values(row(`+970${number}`));

        const response = await context.app.inject({
          method: "POST",
          url: "/users",
          headers: auth(tokens[USER_ROLE.ADMIN]),
          payload: {
            ...staffName("زميل", "Colleague"),
            phone: `+962${number}`,
            role: USER_ROLE.RECEPTIONIST,
            password: TEST_PASSWORD,
          },
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toBe("Phone number is already in use");
      });

      it("signs in with the local form of a number saved under +972", async () => {
        const number = national();
        const created = await context.app.inject({
          method: "POST",
          url: "/users",
          headers: auth(tokens[USER_ROLE.ADMIN]),
          payload: {
            ...staffName("زميل", "Colleague"),
            phone: `+972${number}`,
            role: USER_ROLE.RECEPTIONIST,
            password: TEST_PASSWORD,
          },
        });
        expect(created.statusCode).toBe(201);

        context.resetThrottle();
        const local = await context.app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { identifier: `0${number}`, password: TEST_PASSWORD },
        });

        expect(local.statusCode).toBe(200);
      });

      it("reads a national number the same way in the database and in code", async () => {
        const phones = [
          "+970599123456",
          "+9720599123456",
          "+962791234567",
          "+201001234567",
          "+12025550123",
          "+9910000000001",
        ];

        for (const phone of phones) {
          const [stored] = await context.db.execute<{ national: string }>(
            sql`select ${nationalPhoneDigitsOf(sql`${phone}::text`)} as national`,
          );

          expect(stored?.national).toBe(nationalPhoneDigits(phone));
        }
      });
    });

    it("no longer answers on /me", async () => {
      const response = await context.app.inject({
        method: "PATCH",
        url: "/me",
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: staffName("قديم", "Old"),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /users/:id/reset-password", () => {
    it("sets a new password, ends existing sessions and records the reset", async () => {
      const phone = clinic.phones[USER_ROLE.RECEPTIONIST];
      const userId = clinic.userIds[USER_ROLE.RECEPTIONIST];
      const newPassword = "AdminResetPass123!";

      const loggedIn = await context.app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { identifier: phone, password: TEST_PASSWORD },
      });
      const sessionCookie = (response: { cookies: unknown[] }): string =>
        (response.cookies as { name: string; value: string }[]).find(
          (cookie) => cookie.name === REFRESH_COOKIE_NAME,
        )?.value ?? "";

      const reset = await context.app.inject({
        method: "POST",
        url: `/users/${userId}/reset-password`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { newPassword },
      });

      expect(reset.statusCode).toBe(204);

      const withOld = await context.app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { identifier: phone, password: TEST_PASSWORD },
      });
      const withNew = await context.app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { identifier: phone, password: newPassword },
      });

      expect(withOld.statusCode).toBe(401);
      expect(withNew.statusCode).toBe(200);

      const refreshOld = await context.app.inject({
        method: "POST",
        url: "/auth/refresh",
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${sessionCookie(loggedIn)}` },
        payload: {},
      });
      expect(refreshOld.statusCode).toBe(401);

      const trail = await context.app.inject({
        method: "GET",
        url: `/audit-log?entityId=${userId}&limit=50`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      const entries = trail.json().items as { newValue: Record<string, unknown> | null }[];
      const resetEntry = entries.find((entry) => entry.newValue?.["passwordReset"] === true);

      expect(resetEntry).toBeDefined();
      expect(JSON.stringify(entries)).not.toContain(newPassword);
      expect(JSON.stringify(entries)).not.toContain("$argon2");
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      "refuses %s",
      async (role) => {
        const response = await context.app.inject({
          method: "POST",
          url: `/users/${clinic.userIds[USER_ROLE.TECHNICIAN]}/reset-password`,
          headers: auth(tokens[role]),
          payload: { newPassword: "ShouldNotWork123!" },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it("returns 404 for a user in another clinic", async () => {
      const other = await context.createClinic();

      const response = await context.app.inject({
        method: "POST",
        url: `/users/${other.userIds[USER_ROLE.DOCTOR]}/reset-password`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { newPassword: "ShouldNotWork123!" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /users/:id/unlock", () => {
    const login = (identifier: string, password = TEST_PASSWORD) =>
      context.app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { identifier, password },
      });

    const lockOut = async (identifier: string): Promise<void> => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        context.resetThrottle();
        await login(identifier, "NotThePassword1");
      }
      context.resetThrottle();
    };

    it("shows the lock on the user and lifts it, with an audit entry", async () => {
      const other = await context.createClinic();
      const admin = await context.login(other.phones[USER_ROLE.ADMIN]);
      const phone = other.phones[USER_ROLE.TECHNICIAN];
      const userId = other.userIds[USER_ROLE.TECHNICIAN];

      await lockOut(phone);
      expect((await login(phone)).statusCode).toBe(429);

      const before = await context.app.inject({
        method: "GET",
        url: `/users/${userId}`,
        headers: auth(admin),
      });
      expect(before.json().loginLockedUntil).toEqual(expect.any(String));

      const unlock = await context.app.inject({
        method: "POST",
        url: `/users/${userId}/unlock`,
        headers: auth(admin),
        payload: {},
      });
      expect(unlock.statusCode).toBe(204);

      const after = await context.app.inject({
        method: "GET",
        url: `/users/${userId}`,
        headers: auth(admin),
      });
      expect(after.json().loginLockedUntil).toBeNull();
      expect((await login(phone)).statusCode).toBe(200);

      const trail = await context.app.inject({
        method: "GET",
        url: `/audit-log?entityId=${userId}&limit=50`,
        headers: auth(admin),
      });
      const entries = trail.json().items as { oldValue: Record<string, unknown> | null }[];
      expect(
        entries.some((entry) => typeof entry.oldValue?.["loginLockedUntil"] === "string"),
      ).toBe(true);
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      "refuses %s",
      async (role) => {
        const response = await context.app.inject({
          method: "POST",
          url: `/users/${clinic.userIds[USER_ROLE.TECHNICIAN]}/unlock`,
          headers: auth(tokens[role]),
          payload: {},
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it("returns 404 for a user in another clinic", async () => {
      const other = await context.createClinic();

      const response = await context.app.inject({
        method: "POST",
        url: `/users/${other.userIds[USER_ROLE.DOCTOR]}/unlock`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /specialties", () => {
    it.each([USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      "is readable by %s",
      async (role) => {
        const response = await context.app.inject({
          method: "GET",
          url: "/specialties",
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(200);
        const items = response.json().items as { id: string; clinicId: string }[];
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((item) => item.clinicId === clinic.id)).toBe(true);
      },
    );

    it("requires authentication", async () => {
      const response = await context.app.inject({ method: "GET", url: "/specialties" });

      expect(response.statusCode).toBe(401);
    });
  });
});
