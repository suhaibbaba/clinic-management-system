import {
  PATIENT_ERROR,
  USER_ROLE,
  type Paginated,
  type ProcedureCatalogItem,
  type Statement,
} from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";
import {
  createPatient,
  nameParts,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";

describe("Turkish clinics: catalog names and national IDs (e2e)", () => {
  let context: TestContext;
  let turkish: TestClinic;
  let palestinian: TestClinic;
  let admin: string;
  let doctor: string;
  let otherAdmin: string;
  let fixtures: PatientFixtures;

  const COMPOSITE = { tr: "Kompozit dolgu", en: "Composite filling" };

  const newPatient = (token: string, nationalId?: string) =>
    context.app.inject({
      method: "POST",
      url: "/patients",
      headers: auth(token),
      payload: {
        ...nameParts("Ayşe Yılmaz"),
        phone: uniquePhone(),
        ...(nationalId !== undefined && { nationalId }),
      },
    });

  beforeAll(async () => {
    context = await createTestContext();
    turkish = await context.createClinic();
    palestinian = await context.createClinic();
    admin = await context.login(turkish.phones[USER_ROLE.ADMIN]);
    doctor = await context.login(turkish.phones[USER_ROLE.DOCTOR]);
    otherAdmin = await context.login(palestinian.phones[USER_ROLE.ADMIN]);

    const turned = await context.app.inject({
      method: "PATCH",
      url: "/clinic",
      headers: auth(admin),
      payload: {
        name: { tr: "Nur Diş Kliniği", en: "Nur Dental" },
        country: "TR",
        currency: "TRY",
        settings: {
          timezone: "Europe/Istanbul",
          locale: { languages: ["tr", "en"], clock: "24h", weekStart: 1 },
          documents: { language: "tr" },
        },
      },
    });
    expect(turned.statusCode).toBe(200);

    fixtures = await seedClinicFixtures(context, turkish, admin);
  });

  afterAll(async () => {
    await context.close();
  });

  describe("a procedure named in Turkish", () => {
    let procedureId: string;

    it("is created with a Turkish and an English name, and found by either", async () => {
      const created = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog",
        headers: auth(admin),
        payload: {
          specialtyId: turkish.specialtyId,
          code: "FILL-TR",
          name: COMPOSITE,
          defaultPrice: "100",
        },
      });

      expect(created.statusCode).toBe(201);
      expect((created.json() as ProcedureCatalogItem).name).toEqual(COMPOSITE);
      procedureId = (created.json() as ProcedureCatalogItem).id;

      for (const search of ["Kompozit", "composite"]) {
        const found = await context.app.inject({
          method: "GET",
          url: `/procedure-catalog?search=${search}`,
          headers: auth(admin),
        });

        expect(found.statusCode).toBe(200);
        expect((found.json() as Paginated<ProcedureCatalogItem>).items.map((i) => i.id)).toContain(
          procedureId,
        );
      }
    });

    it("refuses a name with no language at all", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog",
        headers: auth(admin),
        payload: {
          specialtyId: turkish.specialtyId,
          code: "EMPTY-1",
          name: { tr: "", en: "" },
          defaultPrice: "100",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("names the treatment in Turkish on the statement and the timeline", async () => {
      const patient = await newPatient(admin);
      const patientId = (patient.json() as { id: string }).id;
      const performed = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: auth(doctor),
        payload: procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId,
          tooth: 11,
        }),
      });
      expect(performed.statusCode).toBe(201);

      const statement = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/statement`,
        headers: auth(admin),
      });
      expect(statement.statusCode).toBe(200);
      expect((statement.json() as Statement).entries[0]?.description).toBe(COMPOSITE.tr);

      const timeline = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/timeline?type=procedure`,
        headers: auth(admin),
      });
      expect(timeline.statusCode).toBe(200);
      expect((timeline.json() as Paginated<{ title: string }>).items[0]?.title).toBe(COMPOSITE.tr);
    });
  });

  describe("the national ID", () => {
    it("refuses a Turkish ID that fails its checksum, on create and on update", async () => {
      const refused = await newPatient(admin, "12345678901");

      expect(refused.statusCode).toBe(400);
      expect(refused.json()).toMatchObject({
        statusCode: 400,
        message: PATIENT_ERROR.NATIONAL_ID_INVALID,
      });

      const accepted = await newPatient(admin, "10000000146");
      expect(accepted.statusCode).toBe(201);
      expect(accepted.json()).toMatchObject({ nationalId: "10000000146" });

      const update = await context.app.inject({
        method: "PATCH",
        url: `/patients/${(accepted.json() as { id: string }).id}`,
        headers: auth(admin),
        payload: { nationalId: "12345678901" },
      });
      expect(update.statusCode).toBe(400);
      expect(update.json()).toMatchObject({ message: PATIENT_ERROR.NATIONAL_ID_INVALID });
    });

    it("lets a Turkish patient go without an ID", async () => {
      expect((await newPatient(admin)).statusCode).toBe(201);
    });

    it("takes any ID in a country with no check", async () => {
      const patientId = await createPatient(context, otherAdmin, {
        ...nameParts("سامي الأحمد"),
        phone: uniquePhone(),
        nationalId: "12345678901",
      });

      expect(patientId).toEqual(expect.any(String));
    });
  });
});
