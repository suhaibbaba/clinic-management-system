import {
  USER_ROLE,
  type Doctor,
  type Paginated,
  type PerformedProcedure,
  type TreatmentPlan,
  type UserRole,
  type Visit,
} from "@clinic/shared";
import { doctors } from "@api/database/schema";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { staffName } from "@test/helpers/staff-name";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";

// A visiting doctor sees the patients assigned to them — an appointment, a plan or a plan item — and
// nothing else; everybody else's file is a 404, as another clinic's would be.
describe("Visiting doctor (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let visitorDoctorId: string;
  let assigned: string;
  let other: string;

  const as = (role: UserRole) => auth(tokens[role]);

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.VISITING_DOCTOR,
      USER_ROLE.RECEPTIONIST,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    const [visitor] = await context.db
      .insert(doctors)
      .values({
        clinicId: clinic.id,
        userId: clinic.userIds[USER_ROLE.VISITING_DOCTOR],
        specialtyId: clinic.specialtyId,
      })
      .returning({ id: doctors.id });
    visitorDoctorId = visitor!.id;

    assigned = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("سلمى يوسف ناصر"),
      phone: uniquePhone(),
    });
    other = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("كريم عادل حسن"),
      phone: uniquePhone(),
    });

    for (const patientId of [assigned, other]) {
      await context.app.inject({
        method: "POST",
        url: "/visits",
        headers: as(USER_ROLE.DOCTOR),
        payload: { patientId, doctorId: fixtures.doctorId, visitDate: new Date().toISOString() },
      });
    }
  });

  afterAll(async () => {
    await context.close();
  });

  const patientIds = async (): Promise<string[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: "/patients",
      headers: as(USER_ROLE.VISITING_DOCTOR),
    });

    return (response.json() as Paginated<{ id: string }>).items.map((row) => row.id);
  };

  it("sees nobody before a patient is assigned", async () => {
    expect(await patientIds()).toEqual([]);

    const file = await context.app.inject({
      method: "GET",
      url: `/patients/${assigned}`,
      headers: as(USER_ROLE.VISITING_DOCTOR),
    });
    expect(file.statusCode).toBe(404);
  });

  describe("once a plan item names them as its performer", () => {
    let itemId: string;

    beforeAll(async () => {
      const plan = await context.app.inject({
        method: "POST",
        url: "/treatment-plans",
        headers: as(USER_ROLE.DOCTOR),
        payload: {
          patientId: assigned,
          doctorId: fixtures.doctorId,
          title: "Implant",
          items: [{ procedureId: fixtures.catalogId, performerDoctorId: visitorDoctorId }],
        },
      });

      expect(plan.statusCode).toBe(201);
      const body = plan.json() as TreatmentPlan;
      expect(body.items?.[0]?.performerDoctorId).toBe(visitorDoctorId);
      itemId = body.items![0]!.id;
    });

    it("lists that patient and only that patient", async () => {
      expect(await patientIds()).toEqual([assigned]);
    });

    it("opens the clinical file without the clinic's accounts", async () => {
      const file = await context.app.inject({
        method: "GET",
        url: `/patients/${assigned}`,
        headers: as(USER_ROLE.VISITING_DOCTOR),
      });

      expect(file.statusCode).toBe(200);
      expect(file.json()).not.toHaveProperty("balance");

      const balance = await context.app.inject({
        method: "GET",
        url: `/patients/${assigned}/balance`,
        headers: as(USER_ROLE.VISITING_DOCTOR),
      });
      expect(balance.statusCode).toBe(403);
    });

    it("answers 404 for every other patient, by path and by query", async () => {
      for (const url of [
        `/patients/${other}`,
        `/visits?patientId=${other}`,
        `/treatment-plans?patientId=${other}`,
        `/patients/${other}/timeline`,
      ]) {
        const response = await context.app.inject({
          method: "GET",
          url,
          headers: as(USER_ROLE.VISITING_DOCTOR),
        });

        expect({ url, status: response.statusCode }).toEqual({ url, status: 404 });
      }
    });

    it("keeps a list asked without a patient to the assigned ones", async () => {
      const visits = await context.app.inject({
        method: "GET",
        url: "/visits",
        headers: as(USER_ROLE.VISITING_DOCTOR),
      });

      const rows = (visits.json() as Paginated<Visit>).items;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.patientId === assigned)).toBe(true);
    });

    it("hides another patient's record by its own id", async () => {
      const others = await context.app.inject({
        method: "GET",
        url: `/visits?patientId=${other}`,
        headers: as(USER_ROLE.DOCTOR),
      });
      const visitId = (others.json() as Paginated<Visit>).items[0]!.id;

      const response = await context.app.inject({
        method: "GET",
        url: `/visits/${visitId}`,
        headers: as(USER_ROLE.VISITING_DOCTOR),
      });
      expect(response.statusCode).toBe(404);
    });

    it("is the doctor on the procedure the item becomes", async () => {
      const converted = await context.app.inject({
        method: "POST",
        url: `/plan-items/${itemId}/convert`,
        headers: as(USER_ROLE.DOCTOR),
        payload: {},
      });

      expect(converted.statusCode).toBe(201);
      expect((converted.json() as PerformedProcedure).doctorId).toBe(visitorDoctorId);
    });

    it("may not register or edit a patient", async () => {
      const create = await context.app.inject({
        method: "POST",
        url: "/patients",
        headers: as(USER_ROLE.VISITING_DOCTOR),
        payload: { ...nameParts("نور علي سعيد"), phone: uniquePhone() },
      });
      expect(create.statusCode).toBe(403);

      const update = await context.app.inject({
        method: "PATCH",
        url: `/patients/${assigned}`,
        headers: as(USER_ROLE.VISITING_DOCTOR),
        payload: { address: "Elsewhere" },
      });
      expect(update.statusCode).toBe(403);
    });
  });

  describe("adding one from a plan", () => {
    const visitor = () => ({
      ...staffName("زائر", "Visitor"),
      phone: uniquePhone(),
    });

    it("lets a doctor add a visiting doctor, account and profile together", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/doctors/visiting",
        headers: as(USER_ROLE.DOCTOR),
        payload: visitor(),
      });

      expect(response.statusCode).toBe(201);
      const doctor = response.json() as Doctor;
      expect(doctor.isVisiting).toBe(true);
      expect(doctor.specialtyId).toBe(clinic.specialtyId);
    });

    it("refuses a receptionist", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/doctors/visiting",
        headers: as(USER_ROLE.RECEPTIONIST),
        payload: visitor(),
      });

      expect(response.statusCode).toBe(403);
    });

    it("refuses the role on the users screen, which would leave it without a profile", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/users",
        headers: as(USER_ROLE.ADMIN),
        payload: { ...visitor(), password: TEST_PASSWORD, role: USER_ROLE.VISITING_DOCTOR },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
