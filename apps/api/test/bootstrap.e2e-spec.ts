import { randomInt, randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import { CHART_TYPE, CLINIC_MODULE, LOOKUP_LIST, SPECIALTY_CODE, USER_ROLE } from "@clinic/shared";
import { clinics, lookupOptions, specialties, users } from "@api/database/schema";
import { bootstrapClinic } from "@api/database/bootstrap/bootstrap-clinic";
import { bootstrapEnvSchema, type BootstrapEnv } from "@api/database/bootstrap/bootstrap-env";
import { auth, createTestContext, TEST_PASSWORD, type TestContext } from "@test/helpers/test-app";

describe("Clinic bootstrap (e2e)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await context.close();
  });

  const environment = (overrides: Record<string, string> = {}): BootstrapEnv => {
    const suffix = randomUUID().slice(0, 8);

    return bootstrapEnvSchema.parse({
      BOOTSTRAP_CLINIC_SLUG: `boot-${suffix}`,
      BOOTSTRAP_CLINIC_NAME_AR: "عيادة د. قصي جرار",
      BOOTSTRAP_CLINIC_NAME_EN: "Dr. Kossai Jarrar Clinic",
      BOOTSTRAP_SPECIALTIES: "orthopedic",
      BOOTSTRAP_MODULES: "website",
      BOOTSTRAP_SITE_DOMAIN: `${suffix}.example.test`,
      BOOTSTRAP_ADMIN_FIRST_NAME_AR: "قصي",
      BOOTSTRAP_ADMIN_LAST_NAME_AR: "جرار",
      BOOTSTRAP_ADMIN_FIRST_NAME_EN: "Kossai",
      BOOTSTRAP_ADMIN_LAST_NAME_EN: "Jarrar",
      BOOTSTRAP_ADMIN_PHONE: `+97059${randomInt(1_000_000, 9_999_999)}`,
      ...overrides,
    });
  };

  const passwordHash = () =>
    hash(TEST_PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });

  it("creates the clinic, its specialty, its lists and its admin, with no demo data", async () => {
    const env = environment();
    const result = await bootstrapClinic(context.db, env, await passwordHash());

    expect(result).toMatchObject({ createdClinic: true, createdAdmin: true });

    const [clinic] = await context.db.select().from(clinics).where(eq(clinics.id, result.clinicId));
    expect(clinic).toMatchObject({
      slug: env.BOOTSTRAP_CLINIC_SLUG,
      nameEn: "Dr. Kossai Jarrar Clinic",
      siteDomain: env.BOOTSTRAP_SITE_DOMAIN,
      modules: [CLINIC_MODULE.WEBSITE],
      currency: "ILS",
    });

    const clinicSpecialties = await context.db
      .select({ code: specialties.code, chartType: specialties.chartType })
      .from(specialties)
      .where(eq(specialties.clinicId, result.clinicId));
    expect(clinicSpecialties).toEqual([
      { code: SPECIALTY_CODE.ORTHOPEDIC, chartType: CHART_TYPE.BODY_REGION },
    ]);

    const regions = await context.db
      .select({ code: lookupOptions.code })
      .from(lookupOptions)
      .where(
        and(
          eq(lookupOptions.clinicId, result.clinicId),
          eq(lookupOptions.listKey, LOOKUP_LIST.BODY_REGION),
        ),
      );
    expect(regions.length).toBeGreaterThan(0);

    const staff = await context.db
      .select({ role: users.role, nameEn: users.nameEn })
      .from(users)
      .where(and(eq(users.clinicId, result.clinicId), isNull(users.deletedAt)));
    expect(staff).toEqual([{ role: USER_ROLE.ADMIN, nameEn: "Kossai Jarrar" }]);
  });

  it("lets the admin sign in with the bootstrap password and see an empty clinic", async () => {
    const env = environment();
    await bootstrapClinic(context.db, env, await passwordHash());

    const token = await context.login(env.BOOTSTRAP_ADMIN_PHONE);
    const patients = await context.app.inject({
      method: "GET",
      url: "/patients",
      headers: auth(token),
    });

    expect(patients.statusCode).toBe(200);
    expect((patients.json() as { total: number }).total).toBe(0);
  });

  it("changes nothing when it runs again", async () => {
    const env = environment();
    const first = await bootstrapClinic(context.db, env, await passwordHash());
    const second = await bootstrapClinic(
      context.db,
      { ...env, BOOTSTRAP_CLINIC_NAME_EN: "Renamed", BOOTSTRAP_ADMIN_PHONE: "+970599000111" },
      null,
    );

    expect(second).toMatchObject({
      clinicId: first.clinicId,
      createdClinic: false,
      createdAdmin: false,
    });

    const [clinic] = await context.db
      .select({ nameEn: clinics.nameEn })
      .from(clinics)
      .where(eq(clinics.id, first.clinicId));
    expect(clinic?.nameEn).toBe("Dr. Kossai Jarrar Clinic");

    const admins = await context.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clinicId, first.clinicId));
    expect(admins).toHaveLength(1);

    const token = await context.login(env.BOOTSTRAP_ADMIN_PHONE);
    expect(token).toEqual(expect.any(String));
  });

  it("leaves the password empty when none is given", async () => {
    const result = await bootstrapClinic(context.db, environment(), null);
    const [admin] = await context.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.clinicId, result.clinicId));

    expect(admin?.passwordHash).toBeNull();
  });

  describe("environment", () => {
    it("reads comma-separated specialties and modules", () => {
      const env = environment({
        BOOTSTRAP_SPECIALTIES: " orthopedic , dental ",
        BOOTSTRAP_MODULES: "",
      });

      expect(env.BOOTSTRAP_SPECIALTIES).toEqual([SPECIALTY_CODE.ORTHOPEDIC, SPECIALTY_CODE.DENTAL]);
      expect(env.BOOTSTRAP_MODULES).toEqual([]);
    });

    it.each([
      ["no specialty", { BOOTSTRAP_SPECIALTIES: "" }],
      ["an unknown specialty", { BOOTSTRAP_SPECIALTIES: "cardiology" }],
      ["an unknown module", { BOOTSTRAP_MODULES: "payroll" }],
      ["a slug with spaces", { BOOTSTRAP_CLINIC_SLUG: "kossai jarrar" }],
      ["a local phone number", { BOOTSTRAP_ADMIN_PHONE: "0599123456" }],
      ["a short password", { BOOTSTRAP_ADMIN_PASSWORD: "short" }],
    ])("refuses %s", (_label, overrides) => {
      expect(() => environment(overrides)).toThrow();
    });
  });
});
