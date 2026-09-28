import { randomInt, randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { ThrottlerStorage } from "@nestjs/throttler";
import { hash } from "@node-rs/argon2";
import { CHART_TYPE, SPECIALTY_CODE, USER_ROLES, type UserRole } from "@clinic/shared";
import { AppModule } from "@api/app.module";
import { createFastifyAdapter, registerFastifyPlugins } from "@api/bootstrap";
import { DATABASE, POSTGRES_CLIENT, type Database } from "@api/database/database.module";
import { clinics, specialties, users } from "@api/database/schema";
import { ensureSystemLookups } from "@api/database/system-lookups";

export const TEST_PASSWORD = "TestPassword123!";

let passwordHashPromise: Promise<string> | undefined;

function testPasswordHash(): Promise<string> {
  passwordHashPromise ??= hash(TEST_PASSWORD, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  return passwordHashPromise;
}

export interface TestClinic {
  readonly id: string;
  readonly slug: string;
  readonly specialtyId: string;
  readonly userIds: Record<UserRole, string>;
  readonly phones: Record<UserRole, string>;
}

export interface TestContext {
  readonly app: NestFastifyApplication;
  readonly db: Database;
  login(phone: string): Promise<string>;
  createClinic(): Promise<TestClinic>;
  resetThrottle(): void;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    logger: false,
  });

  await registerFastifyPlugins(app);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const db = app.get<Database>(DATABASE);

  const clearThrottle = (): void => {
    const storage = app.get<{
      storage?: Map<string, unknown>;
      timeoutIds?: Map<string, ReturnType<typeof setTimeout>[]>;
    }>(ThrottlerStorage, { strict: false });

    storage?.timeoutIds?.forEach((ids) => ids.forEach(clearTimeout));
    storage?.timeoutIds?.clear();
    storage?.storage?.clear();
  };

  const context: TestContext = {
    app,
    db,

    async login(phone: string): Promise<string> {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        headers: { "x-forwarded-for": `203.0.113.${randomInt(1, 255)}` },
        payload: { identifier: phone, password: TEST_PASSWORD },
      });

      if (response.statusCode !== 200) {
        throw new Error(`Login failed for ${phone}: ${response.statusCode} ${response.body}`);
      }

      return (response.json() as { accessToken: string }).accessToken;
    },

    async createClinic(): Promise<TestClinic> {
      const passwordHash = await testPasswordHash();
      const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
      const phoneDigits = String(Number.parseInt(suffix.slice(0, 8), 16))
        .padStart(10, "0")
        .slice(-10);

      const [clinic] = await db
        .insert(clinics)
        .values({
          nameAr: `عيادة اختبار ${suffix}`,
          nameEn: `Test Clinic ${suffix}`,
          slug: `test-${suffix}`,
        })
        .returning({ id: clinics.id, slug: clinics.slug });

      if (!clinic) {
        throw new Error("Failed to create the test clinic");
      }

      await ensureSystemLookups(db, clinic.id);

      const [specialty] = await db
        .insert(specialties)
        .values({
          clinicId: clinic.id,
          code: SPECIALTY_CODE.DENTAL,
          name: "Dentistry",
          chartType: CHART_TYPE.TOOTH_FDI,
        })
        .returning({ id: specialties.id });

      if (!specialty) {
        throw new Error("Failed to create the test specialty");
      }

      const userIds = {} as Record<UserRole, string>;
      const phones = {} as Record<UserRole, string>;

      for (const [index, role] of USER_ROLES.entries()) {
        const phone = `+99${phoneDigits}${index}`;
        const [user] = await db
          .insert(users)
          .values({
            clinicId: clinic.id,
            firstNameAr: "اختبار",
            lastNameAr: role,
            firstNameEn: "Test",
            lastNameEn: role,
            nameAr: `اختبار ${role}`,
            nameEn: `Test ${role}`,
            phone,
            email: `${role}.${suffix}@test.local`,
            passwordHash,
            role,
          })
          .returning({ id: users.id });

        if (!user) {
          throw new Error(`Failed to create the test ${role}`);
        }

        userIds[role] = user.id;
        phones[role] = phone;
      }

      return { id: clinic.id, slug: clinic.slug, specialtyId: specialty.id, userIds, phones };
    },

    resetThrottle(): void {
      clearThrottle();
    },

    async close(): Promise<void> {
      clearThrottle();
      await app.close();
      await moduleRef.get(POSTGRES_CLIENT, { strict: false })?.end?.({ timeout: 5 });
    },
  };

  return context;
}

export const auth = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});
