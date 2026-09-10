import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerStorage } from '@nestjs/throttler';
import { hash } from '@node-rs/argon2';
import { CHART_TYPE, SPECIALTY_CODE, USER_ROLE, USER_ROLES, type UserRole } from '@clinic/shared';

import { AppModule } from '@api/app.module';
import { createFastifyAdapter, registerFastifyPlugins } from '@api/bootstrap';
import { DATABASE, POSTGRES_CLIENT, type Database } from '@api/database/database.module';
import { clinics, specialties, users } from '@api/database/schema';
import { ensureSystemLookups } from '@api/database/system-lookups';

export const TEST_PASSWORD = 'TestPassword123!';

/** argon2 is deliberately slow, so the digest for the shared test password is computed once per run. */
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
  /** Handle for the public booking routes, which carry no other clinic hint. */
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
  // Public booking allows five a minute per address, far too few for a suite that books a dozen a
  // second. The throttling suite simply does not call this.
  resetThrottle(): void;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  // The production adapter, not a plain one: proxy trust changes what `request.protocol` and
  // `request.ip` report.
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    logger: false,
  });

  // Same plugin set as the production bootstrap, so the harness exercises the
  // real wiring rather than a subset of it.
  await registerFastifyPlugins(app);

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
        // The slug is unique system-wide, so each isolated clinic needs its own.
        .values({
          nameAr: `عيادة اختبار ${suffix}`,
          nameEn: `Test Clinic ${suffix}`,
          slug: `test-${suffix}`,
        })
        .returning({ id: clinics.id, slug: clinics.slug });

      if (!clinic) {
        throw new Error('Failed to create the test clinic');
      }

      // The choice lists are rows now, and the services check codes against
      // them — a clinic without them has dropdowns that refuse every value.
      await ensureSystemLookups(db, clinic.id);

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
      const storage = app.get<{ storage?: Map<string, unknown> }>(ThrottlerStorage, {
        strict: false,
      });

      storage?.storage?.clear();
    },

    async close(): Promise<void> {
      // Closing the app triggers the module's shutdown hook, which ends the pool.
      await app.close();
      await moduleRef.get(POSTGRES_CLIENT, { strict: false })?.end?.({ timeout: 5 });
    },
  };

  return context;
}

export const auth = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});

export { USER_ROLE };
