import { CHART_TYPE, USER_ROLE, type UserRole } from "@clinic/shared";
import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
  nameParts,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

describe("Patient clinical records (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;

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

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("عمر سامي الخطيب"),
      phone: uniquePhone(),
    });
  });

  afterAll(async () => {
    await context.close();
  });

  const asDoctor = () => auth(tokens[USER_ROLE.DOCTOR]);

  const createProcedure = async (tooth: number, surfaces?: string[]) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: asDoctor(),
      payload: procedurePayload({
        patientId,
        doctorId: fixtures.doctorId,
        procedureId: fixtures.catalogId,
        tooth,
        ...(surfaces && { surfaces }),
      }),
    });

    return response;
  };

  describe("FDI validation", () => {
    it.each([9, 19, 49, 50, 86, 100, -11, 0])(
      "rejects %s as a tooth number",
      async (tooth: number) => {
        const response = await createProcedure(tooth);

        expect(response.statusCode).toBe(400);
      },
    );

    it.each([11, 18, 21, 38, 48, 51, 55, 71, 85])(
      "accepts %s as a tooth number",
      async (tooth: number) => {
        const response = await createProcedure(tooth);

        expect(response.statusCode).toBe(201);
      },
    );

    it("rejects a mark whose chart type does not match the specialty", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: asDoctor(),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          chartMarks: [
            { chartType: CHART_TYPE.BODY_REGION, location: { region: "knee", side: "left" } },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects an invalid tooth number on the tooth-history route", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/teeth/49`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("procedures", () => {
    it("snapshots the catalog price when none is supplied", async () => {
      const response = await createProcedure(46);

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ price: "60.00", discount: "0.00" });
    });

    it("keeps the snapshot when the catalog price later changes", async () => {
      const created = await createProcedure(47);
      const { id, price } = created.json() as { id: string; price: string };

      await context.app.inject({
        method: "PATCH",
        url: `/procedure-catalog/${fixtures.catalogId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { defaultPrice: "95.00" },
      });

      const after = await context.app.inject({
        method: "GET",
        url: `/performed-procedures/${id}`,
        headers: asDoctor(),
      });

      expect((after.json() as { price: string }).price).toBe(price);

      await context.app.inject({
        method: "PATCH",
        url: `/procedure-catalog/${fixtures.catalogId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { defaultPrice: "60.00" },
      });
    });

    it("refuses a receptionist any access", async () => {
      const list = await context.app.inject({
        method: "GET",
        url: `/performed-procedures?patientId=${patientId}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(list.statusCode).toBe(403);
    });

    it("gives a technician an empty page — only lab-linked rows are theirs", async () => {
      const list = await context.app.inject({
        method: "GET",
        url: `/performed-procedures?patientId=${patientId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(list.statusCode).toBe(200);
      expect((list.json() as { items: unknown[] }).items).toHaveLength(0);
    });
  });

  describe("chart outcome", () => {
    it("round-trips the classification the chart colours a tooth by", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/procedure-catalog/${fixtures.catalogId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ chartOutcome: "filling" });
    });

    it("accepts a procedure that charts nothing", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          specialtyId: clinic.specialtyId,
          code: `CLEAN-${Date.now()}`,
          name: "Scaling",
          defaultPrice: "40.00",
        },
      });

      expect(response.statusCode).toBe(201);
      expect((response.json() as { chartOutcome: unknown }).chartOutcome).toBeNull();
    });

    it("rejects an outcome the chart cannot show", async () => {
      const response = await context.app.inject({
        method: "PATCH",
        url: `/procedure-catalog/${fixtures.catalogId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { chartOutcome: "healthy" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("tooth history", () => {
    let historyPatientId: string;

    beforeAll(async () => {
      historyPatientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
        ...nameParts("مريض سجل الأسنان"),
        phone: uniquePhone(),
      });

      for (const [tooth, surfaces] of [
        [36, ["O"]],
        [36, ["M", "O"]],
        [26, ["O"]],
      ] as [number, string[]][]) {
        const response = await context.app.inject({
          method: "POST",
          url: "/performed-procedures",
          headers: asDoctor(),
          payload: procedurePayload({
            patientId: historyPatientId,
            doctorId: fixtures.doctorId,
            procedureId: fixtures.catalogId,
            tooth,
            surfaces,
          }),
        });

        expect(response.statusCode).toBe(201);
      }
    });

    it("aggregates every procedure and mark recorded on one tooth", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${historyPatientId}/teeth/36`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json() as {
        tooth: number;
        procedures: { id: string; chartMarks?: unknown[] }[];
        marks: { location: { tooth: number } }[];
      };

      expect(body.tooth).toBe(36);
      expect(body.procedures).toHaveLength(2);
      expect(body.marks).toHaveLength(2);
      expect(body.marks.every((mark) => mark.location.tooth === 36)).toBe(true);
    });

    it("does not leak a neighbouring tooth into the result", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${historyPatientId}/teeth/26`,
        headers: asDoctor(),
      });

      expect((response.json() as { procedures: unknown[] }).procedures).toHaveLength(1);
    });

    it("returns an empty history for a tooth nothing was done to", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${historyPatientId}/teeth/11`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ procedures: [], marks: [] });
    });

    it("refuses a receptionist", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${historyPatientId}/teeth/36`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("treatment plans", () => {
    let planId: string;

    const plan = async () =>
      (
        await context.app.inject({
          method: "GET",
          url: `/treatment-plans/${planId}`,
          headers: asDoctor(),
        })
      ).json() as {
        summary: {
          total: string;
          done: string;
          remaining: string;
          treatments: number;
          completed: number;
        };
      };

    const plannedTreatment = async (tooth: number, extra: Record<string, unknown> = {}) => {
      const response = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: asDoctor(),
        payload: {
          ...procedurePayload({
            patientId,
            doctorId: fixtures.doctorId,
            procedureId: fixtures.catalogId,
            tooth,
          }),
          treatmentPlanId: planId,
          status: "planned",
          ...extra,
        },
      });

      expect(response.statusCode).toBe(201);
      return response.json() as { id: string; treatmentPlanId: string; status: string };
    };

    const move = (id: string, payload: Record<string, unknown>) =>
      context.app.inject({
        method: "PATCH",
        url: `/performed-procedures/${id}`,
        headers: asDoctor(),
        payload,
      });

    beforeEach(async () => {
      const created = await context.app.inject({
        method: "POST",
        url: "/treatment-plans",
        headers: asDoctor(),
        payload: { patientId, doctorId: fixtures.doctorId, title: "خطة معالجة" },
      });

      expect(created.statusCode).toBe(201);
      planId = (created.json() as { id: string }).id;
    });

    it("starts empty, with nothing to pay", async () => {
      expect((await plan()).summary).toEqual({
        total: "0.00",
        done: "0.00",
        remaining: "0.00",
        treatments: 0,
        completed: 0,
      });
    });

    it("totals its treatments from the treatments themselves", async () => {
      const first = await plannedTreatment(16);
      await plannedTreatment(17, { price: "100", discount: "10", discountReason: "خصم" });
      const dropped = await plannedTreatment(18);

      expect((await move(first.id, { status: "done" })).statusCode).toBe(200);
      expect((await move(dropped.id, { status: "cancelled" })).statusCode).toBe(200);

      expect((await plan()).summary).toEqual({
        total: "150.00",
        done: "60.00",
        remaining: "90.00",
        treatments: 2,
        completed: 1,
      });
    });

    it("bills a planned treatment only once work on it starts", async () => {
      const balance = async () =>
        (
          (
            await context.app.inject({
              method: "GET",
              url: `/patients/${patientId}/balance`,
              headers: auth(tokens[USER_ROLE.ADMIN]),
            })
          ).json() as { balance: string }
        ).balance;

      const before = await balance();
      const treatment = await plannedTreatment(26);
      expect(await balance()).toBe(before);

      await move(treatment.id, { status: "in_progress" });
      expect(Number(await balance())).toBe(Number(before) + 60);

      await move(treatment.id, { status: "cancelled" });
      expect(await balance()).toBe(before);
    });

    it("refuses a move the treatment's state does not allow", async () => {
      const treatment = await plannedTreatment(27);
      await move(treatment.id, { status: "done" });

      expect((await move(treatment.id, { status: "planned" })).statusCode).toBe(409);
      expect((await move(treatment.id, { status: "cancelled" })).statusCode).toBe(409);
    });

    it("keeps the teeth of a planned treatment when it is done", async () => {
      const treatment = await plannedTreatment(36);
      const done = await move(treatment.id, { status: "done" });

      const body = done.json() as { chartMarks: { location: { tooth: number } }[] };
      expect(body.chartMarks.map((mark) => mark.location.tooth)).toEqual([36]);
    });

    it("refuses a plan that belongs to another patient", async () => {
      const otherId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
        firstName: "سلمى",
        lastName: "عودة",
        phone: uniquePhone(),
      });

      const response = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: asDoctor(),
        payload: {
          ...procedurePayload({
            patientId: otherId,
            doctorId: fixtures.doctorId,
            procedureId: fixtures.catalogId,
            tooth: 11,
          }),
          treatmentPlanId: planId,
          status: "planned",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("removes the unstarted treatments with the plan and keeps the billed ones", async () => {
      const planned = await plannedTreatment(46);
      const started = await plannedTreatment(47);
      await move(started.id, { status: "done" });

      const removed = await context.app.inject({
        method: "DELETE",
        url: `/treatment-plans/${planId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      expect(removed.statusCode).toBe(204);

      const read = (id: string) =>
        context.app.inject({
          method: "GET",
          url: `/performed-procedures/${id}`,
          headers: asDoctor(),
        });

      expect((await read(planned.id)).statusCode).toBe(404);
      expect((await read(started.id)).statusCode).toBe(200);
    });

    it("refuses a receptionist and a technician", async () => {
      for (const role of [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
        const response = await context.app.inject({
          method: "GET",
          url: `/treatment-plans?patientId=${patientId}`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(403);
      }
    });
  });

  describe("audit log", () => {
    const entriesFor = async (entityId: string): Promise<AuditEntry[]> => {
      const response = await context.app.inject({
        method: "GET",
        url: `/audit-log?entityId=${entityId}&limit=100`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      return (response.json() as { items: AuditEntry[] }).items;
    };

    it("records old and new values when a procedure is edited", async () => {
      const created = await createProcedure(45);
      const { id } = created.json() as { id: string };

      const updated = await context.app.inject({
        method: "PATCH",
        url: `/performed-procedures/${id}`,
        headers: asDoctor(),
        payload: { price: "120.00", discount: "20.00", discountReason: "مريض دائم" },
      });

      expect(updated.statusCode).toBe(200);

      const entries = await entriesFor(id);
      const update = entries.find((entry) => entry.action === "update");

      expect(update).toBeDefined();
      expect(update?.entity).toBe("performed_procedures");
      expect(update?.oldValue).toMatchObject({ price: "60.00", discount: "0.00" });
      expect(update?.newValue).toMatchObject({ price: "120.00", discount: "20.00" });
    });

    it("records the create and the soft delete of a procedure", async () => {
      const created = await createProcedure(44);
      const { id } = created.json() as { id: string };

      const removed = await context.app.inject({
        method: "DELETE",
        url: `/performed-procedures/${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      expect(removed.statusCode).toBe(204);

      const entries = await entriesFor(id);
      const actions = entries.map((entry) => entry.action);

      expect(actions).toContain("create");
      expect(actions).toContain("delete");
      expect(entries.find((entry) => entry.action === "delete")?.newValue).toBeNull();
    });

    it("keys the medical history entry by the patient it belongs to", async () => {
      await context.app.inject({
        method: "PATCH",
        url: `/patients/${patientId}/medical-history`,
        headers: asDoctor(),
        payload: { allergies: ["اللاتكس"] },
      });

      const entries = await entriesFor(patientId);
      const history = entries.find((entry) => entry.entity === "medical_histories");

      expect(history).toBeDefined();
      expect(history?.newValue).toMatchObject({ allergies: ["اللاتكس"] });
    });
  });
});
