import {
  PAYMENT_METHOD,
  USER_ROLE,
  type Paginated,
  type PatientBalance,
  type Payment,
  type PerformedProcedure,
  type Visit,
} from "@clinic/shared";
import { randomUUID } from "node:crypto";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Visit fee (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let adminToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    doctorToken = await context.login(clinic.phones[USER_ROLE.DOCTOR]);
    fixtures = await seedClinicFixtures(context, clinic, adminToken);
  });

  afterAll(async () => {
    await context.close();
  });

  const newPatient = (): Promise<string> =>
    createPatient(context, adminToken, nameParts(`مريض ${randomUUID().slice(0, 6)}`));

  const recordVisit = (token: string, patientId: string, fee?: Record<string, unknown>) =>
    context.app.inject({
      method: "POST",
      url: "/visits",
      headers: auth(token),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        visitDate: new Date().toISOString(),
        complaint: "ألم في الركبة",
        ...(fee && { fee }),
      },
    });

  const get = async <T>(url: string): Promise<T> => {
    const response = await context.app.inject({ method: "GET", url, headers: auth(adminToken) });
    expect(response.statusCode).toBe(200);
    return response.json() as T;
  };

  const ledgerOf = async (patientId: string) => ({
    balance: await get<PatientBalance>(`/patients/${patientId}/balance`),
    procedures: await get<Paginated<PerformedProcedure>>(
      `/performed-procedures?patientId=${patientId}`,
    ),
    payments: await get<Paginated<Payment>>(`/payments?patientId=${patientId}`),
  });

  it("records the visit, its fee and the payment in one save", async () => {
    const patientId = await newPatient();

    const response = await recordVisit(doctorToken, patientId, {
      procedureId: fixtures.catalogId,
      price: "100.00",
      paidWith: PAYMENT_METHOD.CASH,
    });

    expect(response.statusCode).toBe(201);
    const visit = response.json() as Visit;
    const { balance, procedures, payments } = await ledgerOf(patientId);

    expect(procedures.items).toEqual([
      expect.objectContaining({ visitId: visit.id, price: "100.00", status: "done" }),
    ]);
    expect(payments.items).toEqual([
      expect.objectContaining({ amount: "100.00", method: PAYMENT_METHOD.CASH }),
    ]);
    expect(balance).toMatchObject({ charged: "100.00", paid: "100.00", balance: "0.00" });
  });

  it("charges the price list's price and leaves it owed when not paid now", async () => {
    const patientId = await newPatient();

    const response = await recordVisit(doctorToken, patientId, {
      procedureId: fixtures.catalogId,
    });

    expect(response.statusCode).toBe(201);
    const { balance, payments } = await ledgerOf(patientId);

    expect(payments.items).toHaveLength(0);
    expect(balance).toMatchObject({ charged: "60.00", paid: "0.00", balance: "60.00" });
  });

  it("saves nothing when any part fails", async () => {
    const patientId = await newPatient();

    const response = await recordVisit(doctorToken, patientId, {
      procedureId: fixtures.catalogId,
      paidWith: "not-a-method",
    });

    expect(response.statusCode).toBe(400);
    const visits = await get<Paginated<Visit>>(`/visits?patientId=${patientId}`);
    const { procedures, payments } = await ledgerOf(patientId);

    expect(visits.items).toHaveLength(0);
    expect(procedures.items).toHaveLength(0);
    expect(payments.items).toHaveLength(0);
  });

  it("refuses to take the payment from a role that may not record one", async () => {
    const permissions = context.app.get(PermissionsService);
    const withdraw = (allowed: boolean) =>
      permissions.set(
        clinic.id,
        USER_ROLE.DOCTOR,
        "payments.create",
        allowed,
        clinic.userIds[USER_ROLE.ADMIN],
      );
    const patientId = await newPatient();

    await withdraw(false);
    const response = await recordVisit(doctorToken, patientId, {
      procedureId: fixtures.catalogId,
      paidWith: PAYMENT_METHOD.CASH,
    });

    await withdraw(true);

    expect(response.statusCode).toBe(403);
    const visits = await get<Paginated<Visit>>(`/visits?patientId=${patientId}`);
    expect(visits.items).toHaveLength(0);
  });

  it("writes an audit entry for the visit, the charge's procedure and the payment", async () => {
    const patientId = await newPatient();

    const response = await recordVisit(adminToken, patientId, {
      procedureId: fixtures.catalogId,
      paidWith: PAYMENT_METHOD.CASH,
    });
    const visit = response.json() as Visit;
    const { procedures, payments } = await ledgerOf(patientId);

    const entities = await Promise.all(
      [
        ["visits", visit.id],
        ["performed_procedures", procedures.items[0]?.id],
        ["payments", payments.items[0]?.id],
      ].map(async ([entity, id]) => {
        const page = await get<Paginated<{ entity: string }>>(
          `/audit-log?entity=${entity}&entityId=${id}`,
        );
        return page.items.length;
      }),
    );

    expect(entities).toEqual([1, 1, 1]);
  });
});
