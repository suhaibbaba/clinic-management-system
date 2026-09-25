import { CLINICAL_DELETE_ERROR, PAYMENT_METHOD, USER_ROLE, type UserRole } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { charges } from "@api/database/schema";
import {
  createPatient,
  nameParts,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

// A clinical record goes with its charge reversed, never deleted, and money taken for it keeps it.
describe("Deleting visits and procedures (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  const as = (role: UserRole) => auth(tokens[role]);

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);
  });

  afterAll(async () => {
    await context.close();
  });

  const newPatient = () =>
    createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("ليان خالد عمر"),
      phone: uniquePhone(),
    });

  const newVisit = async (patientId: string): Promise<string> => {
    const response = await context.app.inject({
      method: "POST",
      url: "/visits",
      headers: as(USER_ROLE.DOCTOR),
      payload: { patientId, doctorId: fixtures.doctorId, visitDate: new Date().toISOString() },
    });
    return (response.json() as { id: string }).id;
  };

  const newProcedure = async (patientId: string, visitId: string, tooth: number) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: as(USER_ROLE.DOCTOR),
      payload: {
        ...procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth,
        }),
        visitId,
      },
    });
    return (response.json() as { id: string }).id;
  };

  const pay = (patientId: string, amount: string) =>
    context.app.inject({
      method: "POST",
      url: "/payments",
      headers: as(USER_ROLE.ADMIN),
      payload: { patientId, amount, method: PAYMENT_METHOD.CASH },
    });

  const chargesOf = (procedureId: string) =>
    context.db.select().from(charges).where(eq(charges.performedProcedureId, procedureId));

  const remove = (url: string, role: UserRole = USER_ROLE.DOCTOR) =>
    context.app.inject({ method: "DELETE", url, headers: as(role) });

  it("reverses the charge of a deleted procedure, keeping the original row", async () => {
    const patientId = await newPatient();
    const procedureId = await newProcedure(patientId, await newVisit(patientId), 36);

    expect((await remove(`/performed-procedures/${procedureId}`)).statusCode).toBe(204);

    const rows = await chargesOf(procedureId);
    const original = rows.find((row) => row.reversesId === null);
    const reversal = rows.find((row) => row.reversesId === original?.id);

    expect(original?.reversedAt).not.toBeNull();
    expect(original?.deletedAt).toBeNull();
    expect(reversal?.amount).toBe(`-${original?.amount}`);
  });

  it("refuses to delete a procedure the patient's payments cover", async () => {
    const patientId = await newPatient();
    const procedureId = await newProcedure(patientId, await newVisit(patientId), 36);
    await pay(patientId, "60");

    const response = await remove(`/performed-procedures/${procedureId}`);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: CLINICAL_DELETE_ERROR.HAS_PAYMENTS });
    expect((await chargesOf(procedureId)).every((row) => row.reversedAt === null)).toBe(true);
  });

  it("keeps the whole visit when one of its procedures is paid for", async () => {
    const patientId = await newPatient();
    const visitId = await newVisit(patientId);
    const first = await newProcedure(patientId, visitId, 36);
    const second = await newProcedure(patientId, visitId, 46);
    await pay(patientId, "60");

    expect((await remove(`/visits/${visitId}`)).statusCode).toBe(409);

    const visit = await context.app.inject({
      method: "GET",
      url: `/visits/${visitId}`,
      headers: as(USER_ROLE.DOCTOR),
    });
    expect(visit.statusCode).toBe(200);
    for (const procedureId of [first, second]) {
      expect((await chargesOf(procedureId)).every((row) => row.reversedAt === null)).toBe(true);
    }
  });

  it("refuses a receptionist either delete", async () => {
    const patientId = await newPatient();
    const visitId = await newVisit(patientId);
    const procedureId = await newProcedure(patientId, visitId, 36);

    expect((await remove(`/visits/${visitId}`, USER_ROLE.RECEPTIONIST)).statusCode).toBe(403);
    expect(
      (await remove(`/performed-procedures/${procedureId}`, USER_ROLE.RECEPTIONIST)).statusCode,
    ).toBe(403);
  });
});
