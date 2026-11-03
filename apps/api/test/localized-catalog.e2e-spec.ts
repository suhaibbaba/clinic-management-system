import {
  USER_ROLE,
  type Paginated,
  type ProcedureCatalogItem,
  type Statement,
} from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";
import {
  nameParts,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";

describe("Turkish clinics: catalog names (e2e)", () => {
  let context: TestContext;
  let turkish: TestClinic;
  let admin: string;
  let doctor: string;
  let fixtures: PatientFixtures;

  const COMPOSITE = { tr: "Kompozit dolgu", en: "Composite filling" };

  const newPatient = (token: string) =>
    context.app.inject({
      method: "POST",
      url: "/patients",
      headers: auth(token),
      payload: {
        ...nameParts("Ayşe Yılmaz"),
        phone: uniquePhone(),
      },
    });

  beforeAll(async () => {
    context = await createTestContext();
    turkish = await context.createClinic();
    admin = await context.login(turkish.phones[USER_ROLE.ADMIN]);
    doctor = await context.login(turkish.phones[USER_ROLE.DOCTOR]);

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
});
