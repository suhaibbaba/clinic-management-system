import { randomInt, randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import { CHART_TYPE, CLINIC_MODULE, LOOKUP_LIST, SPECIALTY_CODE, USER_ROLE } from "@clinic/shared";
import { clinics, lookupOptions, procedureCatalog, specialties, users } from "@api/database/schema";
import { bootstrapClinic } from "@api/database/bootstrap/bootstrap-clinic";
import { bootstrapEnvSchema, type BootstrapEnv } from "@api/database/bootstrap/bootstrap-env";
import { applySpecialtyPack } from "@api/database/specialty-packs/specialty-pack";
import { grantSpecialty, revokeSpecialty } from "@api/database/clinic-specialties";
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
      name: expect.objectContaining({ en: "Dr. Kossai Jarrar Clinic" }),
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
      .select({ role: users.role, name: users.name })
      .from(users)
      .where(and(eq(users.clinicId, result.clinicId), isNull(users.deletedAt)));
    expect(staff).toEqual([
      { role: USER_ROLE.ADMIN, name: expect.objectContaining({ en: "Kossai Jarrar" }) },
    ]);
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
      .select({ name: clinics.name })
      .from(clinics)
      .where(eq(clinics.id, first.clinicId));
    expect(clinic?.name).toMatchObject({ en: "Dr. Kossai Jarrar Clinic" });

    const admins = await context.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clinicId, first.clinicId));
    expect(admins).toHaveLength(1);

    const token = await context.login(env.BOOTSTRAP_ADMIN_PHONE);
    expect(token).toEqual(expect.any(String));
  });

  describe("orthopedic starter pack", () => {
    const listCodes = async (clinicId: string, listKey: string) =>
      (
        await context.db
          .select({ code: lookupOptions.code })
          .from(lookupOptions)
          .where(and(eq(lookupOptions.clinicId, clinicId), eq(lookupOptions.listKey, listKey)))
      ).map((row) => row.code);

    it("gives a new orthopedic clinic its procedures, drugs and lists", async () => {
      const result = await bootstrapClinic(context.db, environment(), null);

      const procedures = await context.db
        .select({
          code: procedureCatalog.code,
          price: procedureCatalog.defaultPrice,
          isActive: procedureCatalog.isActive,
        })
        .from(procedureCatalog)
        .where(eq(procedureCatalog.clinicId, result.clinicId));
      expect(procedures.map((row) => row.code)).toEqual(
        expect.arrayContaining([
          "ORTHO-CONSULT",
          "CAST-OFF",
          "INJ-STEROID",
          "TKR",
          "ACL",
          "IM-NAIL",
        ]),
      );
      expect(procedures.every((row) => row.price === "0.00" && !row.isActive)).toBe(true);

      const [drug] = await context.db
        .select({ meta: lookupOptions.meta })
        .from(lookupOptions)
        .where(
          and(
            eq(lookupOptions.clinicId, result.clinicId),
            eq(lookupOptions.listKey, LOOKUP_LIST.FREQUENT_DRUG),
            eq(lookupOptions.code, "ibuprofen_400_mg"),
          ),
        );
      expect(drug?.meta).toMatchObject({ perDose: 1, timesPerDay: 3, days: 5 });

      expect(await listCodes(result.clinicId, LOOKUP_LIST.ATTACHMENT_TYPE)).toEqual(
        expect.arrayContaining(["xray", "mri", "ct", "clinical_photo"]),
      );
      expect(await listCodes(result.clinicId, LOOKUP_LIST.ATTACHMENT_TYPE)).not.toContain(
        "xray_panoramic",
      );
      expect(await listCodes(result.clinicId, LOOKUP_LIST.TOOTH_STATE)).toEqual([]);
      expect(await listCodes(result.clinicId, LOOKUP_LIST.APPOINTMENT_TYPE)).toEqual(
        expect.arrayContaining(["checkup", "cast_removal", "post_op"]),
      );
      expect(result.notes.join(" ")).toContain("orthopedic starter pack");
    });

    it("adds nothing twice, and leaves what the clinic changed or deleted alone", async () => {
      const { clinicId } = await bootstrapClinic(context.db, environment(), null);

      await context.db
        .update(procedureCatalog)
        .set({ defaultPrice: "150.00", isActive: true })
        .where(and(eq(procedureCatalog.clinicId, clinicId), eq(procedureCatalog.code, "CAST-OFF")));
      await context.db
        .update(lookupOptions)
        .set({ deletedAt: new Date() })
        .where(and(eq(lookupOptions.clinicId, clinicId), eq(lookupOptions.code, "mri")));

      const again = await applySpecialtyPack(context.db, clinicId, SPECIALTY_CODE.ORTHOPEDIC);
      expect(again).toEqual({ procedures: 0, lookups: 0 });

      const [castOff] = await context.db
        .select({ price: procedureCatalog.defaultPrice, isActive: procedureCatalog.isActive })
        .from(procedureCatalog)
        .where(and(eq(procedureCatalog.clinicId, clinicId), eq(procedureCatalog.code, "CAST-OFF")));
      expect(castOff).toEqual({ price: "150.00", isActive: true });
    });

    it("fills a clinic that was created before the pack existed", async () => {
      const env = environment();
      const { clinicId } = await bootstrapClinic(context.db, env, null);
      await context.db.delete(procedureCatalog).where(eq(procedureCatalog.clinicId, clinicId));

      const result = await applySpecialtyPack(context.db, clinicId, SPECIALTY_CODE.ORTHOPEDIC);

      expect(result.procedures).toBeGreaterThan(20);
      expect(result.lookups).toBe(0);
    });

    it("gives a dental clinic none of it", async () => {
      const { clinicId } = await bootstrapClinic(
        context.db,
        environment({ BOOTSTRAP_SPECIALTIES: "dental" }),
        null,
      );

      const procedures = await context.db
        .select({ id: procedureCatalog.id })
        .from(procedureCatalog)
        .where(eq(procedureCatalog.clinicId, clinicId));
      expect(procedures).toEqual([]);
      expect(await listCodes(clinicId, LOOKUP_LIST.ATTACHMENT_TYPE)).not.toContain("mri");
    });
  });

  describe("specialties the vendor grants", () => {
    const toothStates = async (clinicId: string) =>
      (
        await context.db
          .select({ code: lookupOptions.code })
          .from(lookupOptions)
          .where(
            and(
              eq(lookupOptions.clinicId, clinicId),
              eq(lookupOptions.listKey, LOOKUP_LIST.TOOTH_STATE),
            ),
          )
      ).map((row) => row.code);

    const active = async (clinicId: string) =>
      (
        await context.db
          .select({ code: specialties.code })
          .from(specialties)
          .where(and(eq(specialties.clinicId, clinicId), eq(specialties.isActive, true)))
      )
        .map((row) => row.code)
        .sort();

    it("grants a specialty added to the environment on a later boot", async () => {
      const env = environment();
      const { clinicId } = await bootstrapClinic(context.db, env, null);
      expect(await active(clinicId)).toEqual([SPECIALTY_CODE.ORTHOPEDIC]);

      const later = await bootstrapClinic(
        context.db,
        { ...env, BOOTSTRAP_SPECIALTIES: [SPECIALTY_CODE.ORTHOPEDIC, SPECIALTY_CODE.DENTAL] },
        null,
      );

      expect(await active(clinicId)).toEqual([SPECIALTY_CODE.DENTAL, SPECIALTY_CODE.ORTHOPEDIC]);
      expect(later.notes.join(" ")).toContain("Enabled the dental specialty");
      expect(await toothStates(clinicId)).toContain("crown");
    });

    it("switches one off and on again without losing what the clinic did", async () => {
      const { clinicId } = await bootstrapClinic(context.db, environment(), null);
      await context.db
        .update(procedureCatalog)
        .set({ defaultPrice: "90.00", isActive: true })
        .where(and(eq(procedureCatalog.clinicId, clinicId), eq(procedureCatalog.code, "CAST-OFF")));

      expect(await revokeSpecialty(context.db, clinicId, SPECIALTY_CODE.ORTHOPEDIC)).toBe(true);
      expect(await active(clinicId)).toEqual([]);
      expect(await revokeSpecialty(context.db, clinicId, SPECIALTY_CODE.ORTHOPEDIC)).toBe(false);

      const again = await grantSpecialty(context.db, clinicId, SPECIALTY_CODE.ORTHOPEDIC);
      expect(again).toEqual({ granted: true, procedures: 0, lookups: 0 });

      const [castOff] = await context.db
        .select({ price: procedureCatalog.defaultPrice, isActive: procedureCatalog.isActive })
        .from(procedureCatalog)
        .where(and(eq(procedureCatalog.clinicId, clinicId), eq(procedureCatalog.code, "CAST-OFF")));
      expect(castOff).toEqual({ price: "90.00", isActive: true });
    });
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
