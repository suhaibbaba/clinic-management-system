import { randomUUID } from "node:crypto";
import { BODY_SIDE, CHART_TYPE, USER_ROLE, type UserRole } from "@clinic/shared";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Orthopedics: specialties and body-region chart marks (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let otherClinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;
  let otherAdminToken: string;

  let patientId: string;
  let specialtyId: string;
  let catalogId: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    otherClinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
    otherAdminToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("ليث ماجد النمر"),
      phone: uniquePhone(),
    });
  });

  afterAll(async () => {
    await context.close();
  });

  const createSpecialty = (token: string, payload: Record<string, unknown>) =>
    context.app.inject({ method: "POST", url: "/specialties", headers: auth(token), payload });

  const createProcedure = (chartMarks: unknown[], procedureId = catalogId) =>
    context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: { patientId, doctorId: fixtures.doctorId, procedureId, chartMarks },
    });

  const region = (code: string, side?: string) => ({
    chartType: CHART_TYPE.BODY_REGION,
    location: { region: code, ...(side && { side }) },
  });

  describe("specialties", () => {
    it("lets an admin add a specialty with a body chart", async () => {
      const response = await createSpecialty(tokens[USER_ROLE.ADMIN], {
        code: "orthopedic",
        name: "Orthopedics",
        chartType: CHART_TYPE.BODY_REGION,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        code: "orthopedic",
        chartType: CHART_TYPE.BODY_REGION,
        isActive: true,
      });
      specialtyId = (response.json() as { id: string }).id;
    });

    it("writes an audit entry for the new specialty", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/audit-log?entity=specialties&entityId=${specialtyId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as { items: { action: string }[] }).items).toEqual(
        expect.arrayContaining([expect.objectContaining({ action: "create" })]),
      );
    });

    it("refuses a code already in use", async () => {
      const response = await createSpecialty(tokens[USER_ROLE.ADMIN], {
        code: "orthopedic",
        name: "Bones",
        chartType: CHART_TYPE.BODY_REGION,
      });

      expect(response.statusCode).toBe(409);
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST])(
      "refuses a %s adding a specialty",
      async (role: UserRole) => {
        const response = await createSpecialty(tokens[role], {
          code: `spec_${randomUUID().slice(0, 6)}`,
          name: "Physiotherapy",
          chartType: CHART_TYPE.NONE,
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it("renames a specialty and keeps its code and chart", async () => {
      const response = await context.app.inject({
        method: "PATCH",
        url: `/specialties/${specialtyId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { name: "Orthopedic surgery", code: "bones", chartType: CHART_TYPE.NONE },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: "Orthopedic surgery",
        code: "orthopedic",
        chartType: CHART_TYPE.BODY_REGION,
      });
    });

    it("answers another clinic's specialty with 404", async () => {
      const response = await context.app.inject({
        method: "PATCH",
        url: `/specialties/${specialtyId}`,
        headers: auth(otherAdminToken),
        payload: { name: "Taken over" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("offers the body chart in the session once the specialty is active", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: "/me",
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as { clinic: { chartTypes: string[] } }).clinic.chartTypes).toEqual(
        expect.arrayContaining([CHART_TYPE.TOOTH_FDI, CHART_TYPE.BODY_REGION]),
      );
    });
  });

  describe("body-region chart marks", () => {
    beforeAll(async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          specialtyId,
          code: `ORTHO-${randomUUID().slice(0, 8)}`,
          name: "Cast application",
          defaultPrice: "80.00",
        },
      });

      if (response.statusCode !== 201) {
        throw new Error(`Failed to create the orthopedic procedure: ${response.body}`);
      }

      catalogId = (response.json() as { id: string }).id;
    });

    it("records a treatment on the left knee", async () => {
      const response = await createProcedure([region("knee", BODY_SIDE.LEFT)]);

      expect(response.statusCode).toBe(201);
      expect(
        (response.json() as { chartMarks: { chartType: string; location: unknown }[] }).chartMarks,
      ).toEqual([
        expect.objectContaining({
          chartType: CHART_TYPE.BODY_REGION,
          location: { region: "knee", side: BODY_SIDE.LEFT },
        }),
      ]);
    });

    it("records a spine treatment on the midline", async () => {
      const response = await createProcedure([region("lumbar_spine")]);

      expect(response.statusCode).toBe(201);
    });

    it("refuses a region the clinic's list does not have", async () => {
      const response = await createProcedure([region("tail", BODY_SIDE.LEFT)]);

      expect(response.statusCode).toBe(400);
    });

    it("refuses a paired region without a side", async () => {
      const response = await createProcedure([region("shoulder")]);

      expect(response.statusCode).toBe(400);
    });

    it("refuses a side on a midline region", async () => {
      const response = await createProcedure([region("cervical_spine", BODY_SIDE.RIGHT)]);

      expect(response.statusCode).toBe(400);
    });

    it("refuses a tooth mark on an orthopedic procedure", async () => {
      const response = await createProcedure([
        { chartType: CHART_TYPE.TOOTH_FDI, location: { tooth: 36, surfaces: [] } },
      ]);

      expect(response.statusCode).toBe(400);
    });

    it("still refuses a body mark on a dental procedure", async () => {
      const response = await createProcedure([region("knee", BODY_SIDE.LEFT)], fixtures.catalogId);

      expect(response.statusCode).toBe(400);
    });

    it("refuses a region once the clinic switches it off", async () => {
      const lookups = await context.app.inject({
        method: "GET",
        url: "/lookups?listKey=body_region&includeInactive=true",
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      const options = (lookups.json() as { body_region?: { id: string; code: string }[] })
        .body_region;
      const ankle = options?.find((option) => option.code === "ankle");

      expect(ankle).toBeDefined();

      await context.app.inject({
        method: "PATCH",
        url: `/lookups/${ankle?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { isActive: false },
      });

      const response = await createProcedure([region("ankle", BODY_SIDE.RIGHT)]);

      expect(response.statusCode).toBe(400);
    });
  });
});
