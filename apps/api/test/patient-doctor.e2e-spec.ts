import { RULE, USER_ROLE, type PatientClinicalView } from "@clinic/shared";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("A patient's treating doctor", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let other: TestClinic;
  let fixtures: PatientFixtures;
  let otherFixtures: PatientFixtures;
  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    other = await context.createClinic();

    adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    doctorToken = await context.login(clinic.phones[USER_ROLE.DOCTOR]);
    receptionistToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);

    fixtures = await seedClinicFixtures(context, clinic, adminToken);
    otherFixtures = await seedClinicFixtures(
      context,
      other,
      await context.login(other.phones[USER_ROLE.ADMIN]),
    );
  });

  afterAll(async () => {
    await context.close();
  });

  const newPatient = (doctorId?: string | null): Promise<string> =>
    createPatient(context, receptionistToken, {
      ...nameParts("ليلى حسن"),
      phone: uniquePhone(),
      ...(doctorId !== undefined && { assignedDoctorId: doctorId }),
    });

  const read = async (patientId: string, token = adminToken): Promise<PatientClinicalView> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/patients/${patientId}`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);

    return response.json<PatientClinicalView>();
  };

  it("is chosen when the patient is registered, and shown to the front desk", async () => {
    const patientId = await newPatient(fixtures.doctorId);

    expect((await read(patientId)).assignedDoctorId).toBe(fixtures.doctorId);
    expect((await read(patientId, receptionistToken)).assignedDoctorId).toBe(fixtures.doctorId);
  });

  it("starts empty, can be set later, and cleared again", async () => {
    const patientId = await newPatient();

    expect((await read(patientId)).assignedDoctorId).toBeNull();

    const set = await context.app.inject({
      method: "PATCH",
      url: `/patients/${patientId}`,
      headers: auth(adminToken),
      payload: { assignedDoctorId: fixtures.doctorId },
    });

    expect(set.statusCode).toBe(200);
    expect((await read(patientId)).assignedDoctorId).toBe(fixtures.doctorId);

    const cleared = await context.app.inject({
      method: "PATCH",
      url: `/patients/${patientId}`,
      headers: auth(adminToken),
      payload: { assignedDoctorId: null },
    });

    expect(cleared.statusCode).toBe(200);
    expect((await read(patientId)).assignedDoctorId).toBeNull();
  });

  it("refuses another clinic's doctor", async () => {
    const response = await context.app.inject({
      method: "POST",
      url: "/patients",
      headers: auth(receptionistToken),
      payload: {
        ...nameParts("ليلى حسن"),
        phone: uniquePhone(),
        assignedDoctorId: otherFixtures.doctorId,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("counts as the doctor's own patient once the clinic limits doctors to theirs", async () => {
    const assigned = await newPatient(fixtures.doctorId);
    const stranger = await newPatient();
    const grant = (allowed: boolean) =>
      context.app.inject({
        method: "PATCH",
        url: "/permissions",
        headers: auth(adminToken),
        payload: { role: USER_ROLE.DOCTOR, capability: RULE.PATIENTS_ALL, allowed },
      });

    expect((await grant(false)).statusCode).toBe(204);

    try {
      const get = (patientId: string) =>
        context.app.inject({
          method: "GET",
          url: `/patients/${patientId}`,
          headers: auth(doctorToken),
        });

      expect((await get(assigned)).statusCode).toBe(200);
      expect((await get(stranger)).statusCode).toBe(404);
    } finally {
      await grant(true);
    }
  });
});
