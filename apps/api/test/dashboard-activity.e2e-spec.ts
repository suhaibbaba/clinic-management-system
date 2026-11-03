import {
  DASHBOARD_COLLECTION_DAYS,
  PAYMENT_METHOD,
  USER_ROLE,
  type DashboardCollections,
  type DashboardSummary,
  type DashboardVisits,
  type UserRole,
} from "@clinic/shared";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Dashboard activity (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let patientId: string;
  const tokens = {} as Record<UserRole, string>;

  const get = async (role: UserRole, url: string) =>
    context.app.inject({ method: "GET", url, headers: auth(tokens[role]) });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.VISITING_DOCTOR,
      USER_ROLE.TECHNICIAN,
      USER_ROLE.RECEPTIONIST,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);
    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("مريض الزيارة"),
      phone: uniquePhone(),
    });

    const visit = await context.app.inject({
      method: "POST",
      url: "/visits",
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        fee: { procedureId: fixtures.catalogId, price: "300" },
      },
    });

    expect(visit.statusCode).toBe(201);

    const paid = await context.app.inject({
      method: "POST",
      url: "/payments",
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: { patientId, amount: "100.00", method: PAYMENT_METHOD.CASH },
    });

    expect(paid.statusCode).toBe(201);
  });

  afterAll(async () => {
    await context.close();
  });

  it("lists today's visits with the patient's balance for the front desk", async () => {
    const response = await get(USER_ROLE.RECEPTIONIST, "/dashboard/visits-today");
    const body = response.json<DashboardVisits>();

    expect(response.statusCode).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ patientId, balance: "200.00" });
  });

  it("shows a visiting doctor only the visits that are theirs", async () => {
    const response = await get(USER_ROLE.VISITING_DOCTOR, "/dashboard/visits-today");

    expect(response.json<DashboardVisits>()).toEqual({ items: [], total: 0 });
  });

  it("totals the last week's collections day by day, today last", async () => {
    const response = await get(USER_ROLE.RECEPTIONIST, "/dashboard/collections");
    const days = response.json<DashboardCollections>().days;

    expect(days).toHaveLength(DASHBOARD_COLLECTION_DAYS);
    expect(days.at(-1)?.total).toBe("100.00");
    expect(days.slice(0, -1).every((day) => day.total === "0.00")).toBe(true);
  });

  it("keeps the collections from a doctor by default", async () => {
    expect((await get(USER_ROLE.DOCTOR, "/dashboard/collections")).statusCode).toBe(403);
  });

  it("adds today's visits, collections and new patients to the summary of those who may see them", async () => {
    const receptionist = (
      await get(USER_ROLE.RECEPTIONIST, "/dashboard/summary")
    ).json<DashboardSummary>();
    const doctor = (await get(USER_ROLE.DOCTOR, "/dashboard/summary")).json<DashboardSummary>();

    expect(receptionist).toMatchObject({
      visitsToday: 1,
      collectedToday: "100.00",
      newPatientsToday: 1,
    });
    expect(doctor).toMatchObject({ visitsToday: 1 });
    expect(doctor).not.toHaveProperty("collectedToday");
  });
});
