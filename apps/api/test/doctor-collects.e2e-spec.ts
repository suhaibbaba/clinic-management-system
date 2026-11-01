import {
  PAYMENT_COLLECTOR,
  PAYMENT_ERROR,
  PAYROLL_ERROR,
  USER_ROLE,
  type DoctorSettlement,
  type Payment,
  type PaymentHolder,
  type PatientBalance,
  type Payroll,
  type PerformedProcedure,
  type StaffPayment,
  type UserRole,
} from "@clinic/shared";
import { doctors } from "@api/database/schema";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { clinicToday } from "@test/helpers/clinic-time";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("A doctor who takes the patients' money (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let collectorId: string;
  let patientId: string;
  const tokens = {} as Record<UserRole, string>;
  const month = clinicToday().slice(0, 7);
  const around = "from=2000-01-01&to=2099-12-31";

  const as = (role: UserRole) => auth(tokens[role]);

  const settlement = async (): Promise<DoctorSettlement> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/doctors/${collectorId}/settlement?${around}`,
      headers: as(USER_ROLE.ADMIN),
    });

    expect(response.statusCode).toBe(200);
    return response.json() as DoctorSettlement;
  };

  const payrollLine = async () => {
    const response = await context.app.inject({
      method: "GET",
      url: `/payroll/${month}`,
      headers: as(USER_ROLE.ADMIN),
    });

    expect(response.statusCode).toBe(200);
    const payroll = response.json() as Payroll;

    return {
      payroll,
      line: payroll.lines.find(
        (entry) => entry.userId === clinic.userIds[USER_ROLE.VISITING_DOCTOR],
      ),
    };
  };

  const pay = (heldBy: string | null) =>
    context.app.inject({
      method: "POST",
      url: "/payments",
      headers: as(USER_ROLE.RECEPTIONIST),
      payload: { patientId, amount: "1000", method: "cash", heldBy },
    });

  const remit = (doctorId: string, amount: string) =>
    context.app.inject({
      method: "POST",
      url: `/doctors/${doctorId}/remittances`,
      headers: as(USER_ROLE.ADMIN),
      payload: { amount, method: "cash", month },
    });

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
    collectorId = visitor!.id;

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("ليلى سامي خليل"),
      phone: uniquePhone(),
    });

    const terms = await context.app.inject({
      method: "PUT",
      url: `/doctors/${collectorId}/settlement-terms`,
      headers: as(USER_ROLE.ADMIN),
      payload: { clinicSharePercent: 40, effectiveMonth: month },
    });
    expect(terms.statusCode).toBe(200);

    const treatment = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: as(USER_ROLE.DOCTOR),
      payload: {
        patientId,
        doctorId: collectorId,
        procedureId: fixtures.catalogId,
        status: "done",
        price: "1000",
      },
    });
    expect(treatment.statusCode).toBe(201);
    expect((treatment.json() as PerformedProcedure).id).toBeDefined();
  });

  afterAll(async () => {
    await context.close();
  });

  it("refuses to hand a payment to a doctor the clinic collects for", async () => {
    const response = await pay(collectorId);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: PAYMENT_ERROR.NOT_A_HOLDER });
  });

  it("lets only the admin decide who takes a doctor's payments", async () => {
    for (const role of [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.RECEPTIONIST]) {
      const response = await context.app.inject({
        method: "PUT",
        url: `/doctors/${collectorId}/collection-terms`,
        headers: as(role),
        payload: { collector: PAYMENT_COLLECTOR.DOCTOR, effectiveMonth: month },
      });

      expect({ role, status: response.statusCode }).toEqual({ role, status: 403 });
    }

    const set = await context.app.inject({
      method: "PUT",
      url: `/doctors/${collectorId}/collection-terms`,
      headers: as(USER_ROLE.ADMIN),
      payload: { collector: PAYMENT_COLLECTOR.DOCTOR, effectiveMonth: month },
    });
    expect(set.statusCode).toBe(200);

    const holders = await context.app.inject({
      method: "GET",
      url: "/payments/holders",
      headers: as(USER_ROLE.RECEPTIONIST),
    });
    expect(holders.statusCode).toBe(200);
    expect((holders.json() as PaymentHolder[]).map((holder) => holder.doctorId)).toEqual([
      collectorId,
    ]);
  });

  it("settles the patient's account and leaves the money with the doctor", async () => {
    const response = await pay(collectorId);
    expect(response.statusCode).toBe(201);
    expect((response.json() as Payment).heldBy).toBe(collectorId);

    const balance = await context.app.inject({
      method: "GET",
      url: `/patients/${patientId}/balance`,
      headers: as(USER_ROLE.ADMIN),
    });
    expect((balance.json() as PatientBalance).balance).toBe("0.00");

    const report = await settlement();
    expect(report).toMatchObject({
      collector: PAYMENT_COLLECTOR.DOCTOR,
      earned: "600.00",
      held: "1000.00",
      remitted: "0.00",
      balance: "-400.00",
    });

    const { payroll, line } = await payrollLine();
    expect(line).toMatchObject({
      collector: PAYMENT_COLLECTOR.DOCTOR,
      held: "1000.00",
      owed: "-400.00",
    });
    expect(Number(payroll.totals.owedToClinic)).toBeGreaterThanOrEqual(400);
  });

  it("records what the doctor hands to the clinic, and a reversal takes it back", async () => {
    const handed = await remit(collectorId, "400");
    expect(handed.statusCode).toBe(201);

    expect((await settlement()).balance).toBe("0.00");
    const { line } = await payrollLine();
    expect(line).toMatchObject({ remitted: "400.00", owed: "0.00" });
    expect(line?.remittances).toHaveLength(1);

    const reversed = await context.app.inject({
      method: "POST",
      url: `/staff-payments/${(handed.json() as StaffPayment).id}/reverse`,
      headers: as(USER_ROLE.ADMIN),
      payload: { reason: "سُجّل مرتين" },
    });
    expect(reversed.statusCode).toBe(201);
    expect((await settlement()).balance).toBe("-400.00");
  });

  it("takes nothing from a doctor whose payments the clinic collects", async () => {
    const response = await remit(fixtures.doctorId, "100");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: PAYROLL_ERROR.NOT_COLLECTING });
  });

  it("keeps the remittance to the admin", async () => {
    for (const role of [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.RECEPTIONIST]) {
      const response = await context.app.inject({
        method: "POST",
        url: `/doctors/${collectorId}/remittances`,
        headers: as(role),
        payload: { amount: "100", method: "cash", month },
      });

      expect({ role, status: response.statusCode }).toEqual({ role, status: 403 });
    }
  });
});
