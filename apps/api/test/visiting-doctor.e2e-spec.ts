import {
  type StaffPayment,
  type DoctorSettlement,
  USER_ROLE,
  type Doctor,
  type Paginated,
  type PerformedProcedure,
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

  describe("once a planned treatment names them as its doctor", () => {
    let treatmentId: string;

    beforeAll(async () => {
      const treatment = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: as(USER_ROLE.DOCTOR),
        payload: {
          patientId: assigned,
          doctorId: visitorDoctorId,
          procedureId: fixtures.catalogId,
          status: "planned",
        },
      });

      expect(treatment.statusCode).toBe(201);
      treatmentId = (treatment.json() as PerformedProcedure).id;
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
        `/performed-procedures?patientId=${other}`,
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

    it("stays the doctor once the treatment is done", async () => {
      const done = await context.app.inject({
        method: "PATCH",
        url: `/performed-procedures/${treatmentId}`,
        headers: as(USER_ROLE.DOCTOR),
        payload: { status: "done" },
      });

      expect(done.statusCode).toBe(200);
      expect((done.json() as PerformedProcedure).doctorId).toBe(visitorDoctorId);
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
      specialtyId: clinic.specialtyId,
      defaultAppointmentDurationMinutes: 45,
      weeklySchedule: [{ weekday: 1, ranges: [{ start: "09:00", end: "13:00" }] }],
      clinicSharePercent: 40,
    });

    it("lets the admin add a visiting doctor with their specialty and working days", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/doctors/visiting",
        headers: as(USER_ROLE.ADMIN),
        payload: visitor(),
      });

      expect(response.statusCode).toBe(201);
      const doctor = response.json() as Doctor;
      expect(doctor.isVisiting).toBe(true);
      expect(doctor.specialtyId).toBe(clinic.specialtyId);
      expect(doctor.defaultAppointmentDurationMinutes).toBe(45);
      expect(doctor.weeklySchedule).toHaveLength(1);
      expect(doctor).not.toHaveProperty("clinicSharePercent");
    });

    it("refuses a doctor and a receptionist", async () => {
      for (const role of [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]) {
        const response = await context.app.inject({
          method: "POST",
          url: "/doctors/visiting",
          headers: as(role),
          payload: visitor(),
        });

        expect({ role, status: response.statusCode }).toEqual({ role, status: 403 });
      }
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

  describe("settling with a visiting doctor", () => {
    const today = new Date().toISOString().slice(0, 10);
    const around = `from=2000-01-01&to=2099-12-31`;
    let first: string;
    let second: string;

    const treat = async (payload: Record<string, unknown>) => {
      const response = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: as(USER_ROLE.DOCTOR),
        payload: {
          patientId: assigned,
          doctorId: visitorDoctorId,
          procedureId: fixtures.catalogId,
          status: "done",
          ...payload,
        },
      });

      expect(response.statusCode).toBe(201);
      return (response.json() as PerformedProcedure).id;
    };

    const settlement = async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/doctors/${visitorDoctorId}/settlement?${around}`,
        headers: as(USER_ROLE.ADMIN),
      });

      expect(response.statusCode).toBe(200);
      return response.json() as DoctorSettlement;
    };

    const row = (report: DoctorSettlement, id: string) =>
      report.treatments.find((treatment) => treatment.id === id);

    beforeAll(async () => {
      const terms = await context.app.inject({
        method: "PUT",
        url: `/doctors/${visitorDoctorId}/settlement-terms`,
        headers: as(USER_ROLE.ADMIN),
        payload: { clinicSharePercent: 40 },
      });
      expect(terms.statusCode).toBe(204);

      first = await treat({ price: "1000" });
      second = await treat({ price: "500", discount: "100", discountReason: "خصم" });
    });

    it("takes the clinic's percentage of the price after discount and materials", async () => {
      const report = await settlement();

      expect(report.clinicSharePercent).toBe(40);
      expect(row(report, first)).toMatchObject({
        net: "1000.00",
        clinicShare: "400.00",
        doctorShare: "600.00",
      });
      expect(row(report, second)).toMatchObject({
        net: "400.00",
        clinicShare: "160.00",
        doctorShare: "240.00",
      });
    });

    it("lets the admin set materials and the clinic's share per treatment, down to nothing", async () => {
      const set = (id: string, payload: Record<string, unknown>) =>
        context.app.inject({
          method: "PATCH",
          url: `/settlement-treatments/${id}`,
          headers: as(USER_ROLE.ADMIN),
          payload,
        });

      expect((await set(first, { materialCost: "200" })).statusCode).toBe(204);
      expect((await set(second, { clinicSharePercent: 0 })).statusCode).toBe(204);

      const report = await settlement();

      expect(row(report, first)).toMatchObject({
        materialCost: "200.00",
        materialCostSet: true,
        net: "800.00",
        clinicShare: "320.00",
        doctorShare: "480.00",
      });
      expect(row(report, second)).toMatchObject({
        clinicSharePercent: 0,
        clinicSharePercentSet: true,
        clinicShare: "0.00",
        doctorShare: "400.00",
      });
    });

    it("keeps what was paid to the doctor, and a reversal takes it back", async () => {
      const before = await settlement();

      const paid = await context.app.inject({
        method: "POST",
        url: `/doctors/${visitorDoctorId}/payouts`,
        headers: as(USER_ROLE.ADMIN),
        payload: { amount: "500", method: "cash" },
      });
      expect(paid.statusCode).toBe(201);

      const after = await settlement();
      expect(Number(after.paid) - Number(before.paid)).toBe(500);
      expect(Number(after.balance)).toBe(Number(after.earned) - Number(after.paid));

      const reversed = await context.app.inject({
        method: "POST",
        url: `/staff-payments/${(paid.json() as StaffPayment).id}/reverse`,
        headers: as(USER_ROLE.ADMIN),
        payload: { reason: "دفعة مكررة" },
      });
      expect(reversed.statusCode).toBe(201);
      expect((await settlement()).paid).toBe(before.paid);
    });

    it("keeps the settlement to the admin", async () => {
      for (const role of [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.RECEPTIONIST]) {
        const response = await context.app.inject({
          method: "GET",
          url: `/doctors/${visitorDoctorId}/settlement?from=${today}&to=${today}`,
          headers: as(role),
        });

        expect({ role, status: response.statusCode }).toEqual({ role, status: 403 });
      }
    });
  });
});
