import { RULE, USER_ROLE, type Permissions, type UserRole } from "@clinic/shared";
import { createPatient, seedClinicFixtures } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Data rules a clinic can grant (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  let patientId: string;

  const grant = (role: UserRole, capability: string, allowed: boolean) =>
    context.app.inject({
      method: "PATCH",
      url: "/permissions",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: { role, capability, allowed },
    });

  const withGrant = async (
    role: UserRole,
    capability: string,
    allowed: boolean,
    run: () => Promise<void>,
  ): Promise<void> => {
    expect((await grant(role, capability, allowed)).statusCode).toBe(204);

    try {
      await run();
    } finally {
      await grant(role, capability, !allowed);
    }
  };

  const get = (role: UserRole, url: string) =>
    context.app.inject({ method: "GET", url, headers: auth(tokens[role]) });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of Object.values(USER_ROLE)) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.ADMIN], {
      firstName: "ليلى",
      lastName: "حداد",
      phone: `+9725${String(Date.now()).slice(-8)}`,
      address: "رام الله",
    });
  });

  afterAll(async () => {
    await context.close();
  });

  it("lists every rule on the permissions page", async () => {
    const response = await get(USER_ROLE.ADMIN, "/permissions");
    const keys = response.json<Permissions>().capabilities.map((capability) => capability.key);

    expect(keys).toEqual(expect.arrayContaining(Object.values(RULE)));
  });

  it("shows a receptionist medical details once the clinic allows it", async () => {
    expect((await get(USER_ROLE.RECEPTIONIST, `/patients/${patientId}`)).json()).not.toHaveProperty(
      "address",
    );

    await withGrant(USER_ROLE.RECEPTIONIST, RULE.PATIENTS_CLINICAL, true, async () => {
      expect((await get(USER_ROLE.RECEPTIONIST, `/patients/${patientId}`)).json()).toMatchObject({
        address: "رام الله",
      });
    });
  });

  it("hides balances from a doctor once the clinic takes them away", async () => {
    expect((await get(USER_ROLE.DOCTOR, `/patients/${patientId}`)).json()).toHaveProperty(
      "balance",
    );

    await withGrant(USER_ROLE.DOCTOR, RULE.PATIENTS_FINANCIAL, false, async () => {
      expect((await get(USER_ROLE.DOCTOR, `/patients/${patientId}`)).json()).not.toHaveProperty(
        "balance",
      );
    });
  });

  it("limits a doctor to assigned patients once the clinic takes away every patient", async () => {
    expect((await get(USER_ROLE.DOCTOR, `/patients/${patientId}`)).statusCode).toBe(200);

    await withGrant(USER_ROLE.DOCTOR, RULE.PATIENTS_ALL, false, async () => {
      expect((await get(USER_ROLE.DOCTOR, `/patients/${patientId}`)).statusCode).toBe(404);
    });
  });

  it("gives a receptionist the full catalog once the clinic allows it", async () => {
    const [first] = (await get(USER_ROLE.RECEPTIONIST, "/procedure-catalog")).json<{
      items: Record<string, unknown>[];
    }>().items;

    expect(first).not.toHaveProperty("isActive");

    await withGrant(USER_ROLE.RECEPTIONIST, RULE.CATALOG_DETAILS, true, async () => {
      const [full] = (await get(USER_ROLE.RECEPTIONIST, "/procedure-catalog")).json<{
        items: Record<string, unknown>[];
      }>().items;

      expect(full).toHaveProperty("isActive");
    });
  });

  it("lets a technician delete a colleague's note once the clinic allows it", async () => {
    const write = async () =>
      (
        await context.app.inject({
          method: "POST",
          url: "/notes",
          headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
          payload: { body: "ملاحظة الاستقبال" },
        })
      ).json<{ id: string }>().id;
    const remove = (id: string) =>
      context.app.inject({
        method: "DELETE",
        url: `/notes/${id}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

    expect((await remove(await write())).statusCode).toBe(403);

    await withGrant(USER_ROLE.TECHNICIAN, RULE.ALL_NOTES, true, async () => {
      expect((await remove(await write())).statusCode).toBe(204);
    });
  });

  it("puts the overdue widget on a doctor's dashboard once the clinic allows it", async () => {
    expect((await get(USER_ROLE.DOCTOR, "/dashboard/summary")).json()).not.toHaveProperty(
      "overdueTotal",
    );

    await withGrant(USER_ROLE.DOCTOR, RULE.OVERDUE_WIDGET, true, async () => {
      expect((await get(USER_ROLE.DOCTOR, "/dashboard/summary")).json()).toHaveProperty(
        "overdueTotal",
      );
    });
  });

  it("opens the patient list to a role only while it holds patients.list", async () => {
    expect((await get(USER_ROLE.TECHNICIAN, "/patients")).statusCode).toBe(200);

    await withGrant(USER_ROLE.TECHNICIAN, "patients.list", false, async () => {
      expect((await get(USER_ROLE.TECHNICIAN, "/patients")).statusCode).toBe(403);
    });
  });
});
