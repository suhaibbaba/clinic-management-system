import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { hash } from '@node-rs/argon2';
import { CHART_TYPE, SPECIALTY_CODE, USER_ROLE, USER_ROLES, type UserRole } from '@clinic/shared';

import { AppModule } from '@api/app.module';
import { DATABASE, POSTGRES_CLIENT, type Database } from '@api/database/database.module';
import { clinics, specialties, users } from '@api/database/schema';

export const TEST_PASSWORD = 'TestPassword123!';

/**
 * argon2 is deliberately slow, so the digest for the shared test password is
 * computed once per run and reused for every seeded account.
 */
let passwordHashPromise: Promise<string> | undefined;

function testPasswordHash(): Promise<string> {
  passwordHashPromise ??= hash(TEST_PASSWORD, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  return passwordHashPromise;
}

/** One isolated tenant: a clinic, a specialty and one account per role. */
export interface TestClinic {
  readonly id: string;
  readonly specialtyId: string;
  readonly userIds: Record<UserRole, string>;
  readonly phones: Record<UserRole, string>;
}

export interface TestContext {
  readonly app: NestFastifyApplication;
  readonly db: Database;
  /** Signs in and returns a bearer access token. */
  login(phone: string): Promise<string>;
  /** Creates a fresh, fully isolated clinic. */
  createClinic(): Promise<TestClinic>;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const db = app.get<Database>(DATABASE);

  const context: TestContext = {
    app,
    db,

    async login(phone: string): Promise<string> {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: phone, password: TEST_PASSWORD },
      });

      if (response.statusCode !== 200) {
        throw new Error(`Login failed for ${phone}: ${response.statusCode} ${response.body}`);
      }

      return (response.json() as { accessToken: string }).accessToken;
    },

    async createClinic(): Promise<TestClinic> {
      const passwordHash = await testPasswordHash();
      const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

      const [clinic] = await db
        .insert(clinics)
        .values({ name: `Test Clinic ${suffix}` })
        .returning({ id: clinics.id });

      if (!clinic) {
        throw new Error('Failed to create the test clinic');
      }

      const [specialty] = await db
        .insert(specialties)
        .values({
          clinicId: clinic.id,
          code: SPECIALTY_CODE.DENTAL,
          name: 'Dentistry',
          chartType: CHART_TYPE.TOOTH_FDI,
        })
        .returning({ id: specialties.id });

      if (!specialty) {
        throw new Error('Failed to create the test specialty');
      }

      const userIds = {} as Record<UserRole, string>;
      const phones = {} as Record<UserRole, string>;

      for (const [index, role] of USER_ROLES.entries()) {
        // Phone and email are unique system-wide, so every suite needs its own.
        const phone = `+99${suffix}${index}`;
        const [user] = await db
          .insert(users)
          .values({
            clinicId: clinic.id,
            name: `Test ${role}`,
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

      return { id: clinic.id, specialtyId: specialty.id, userIds, phones };
    },

    async close(): Promise<void> {
      // Closing the app triggers the module's shutdown hook, which ends the pool.
      await app.close();
      await moduleRef.get(POSTGRES_CLIENT, { strict: false })?.end?.({ timeout: 5 });
    },
  };

  return context;
}

/** Bearer header helper. */
export const auth = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});

export { USER_ROLE };
