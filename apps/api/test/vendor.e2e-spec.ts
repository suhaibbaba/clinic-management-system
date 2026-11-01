import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  CLINIC_ERROR,
  CLINIC_MODULE,
  SUBSCRIPTION_EVENT,
  SUBSCRIPTION_STATUS,
  USER_ROLE,
  VENDOR_MISSING_MODULES,
  addDays,
  type Paginated,
  type Plan,
  type SaveSubscriptionInput,
  type VendorClinicDetail,
  type VendorClinicSummary,
} from "@clinic/shared";
import { clinics, subscriptionEvents, vendorUsers } from "@api/database/schema";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const PASSWORD = "VendorPassword123!";

describe("Vendor console (e2e)", () => {
  let context: TestContext;
  let email: string;
  let cookie: string;

  const today = () => new Date().toISOString().slice(0, 10);

  const call = (method: "GET" | "POST" | "PUT" | "PATCH", url: string, payload?: unknown) =>
    context.app.inject({
      method,
      url,
      headers: { cookie },
      ...(payload !== undefined && { payload: payload as Record<string, unknown> }),
    });

  const createPlan = async (modules: readonly string[]): Promise<Plan> => {
    const code = `plan-${randomUUID().slice(0, 8)}`;
    const created = await call("POST", "/vendor/plans", {
      code,
      name: `Plan ${code}`,
      modules,
      maxUsers: null,
      maxDoctors: null,
      isActive: true,
    });

    expect(created.statusCode).toBe(204);

    const list = await call("GET", "/vendor/plans?limit=100");
    const plan = list.json<Paginated<Plan>>().items.find((item) => item.code === code);

    if (!plan) {
      throw new Error("The plan was not listed");
    }

    return plan;
  };

  const subscription = (
    planId: string,
    overrides: Partial<SaveSubscriptionInput> = {},
  ): SaveSubscriptionInput => ({
    planId,
    addOnModules: [],
    status: SUBSCRIPTION_STATUS.ACTIVE,
    startsOn: addDays(today(), -30),
    endsOn: addDays(today(), 335),
    graceDays: 14,
    notes: null,
    ...overrides,
  });

  const modulesOf = async (clinic: TestClinic) => {
    const [row] = await context.db
      .select({ modules: clinics.modules })
      .from(clinics)
      .where(eq(clinics.id, clinic.id));

    return row?.modules ?? [];
  };

  beforeAll(async () => {
    context = await createTestContext();
    email = `vendor-${randomUUID().slice(0, 8)}@example.test`;

    await context.db.insert(vendorUsers).values({
      email,
      name: "Vendor",
      passwordHash: await context.app.get(PasswordService).hash(PASSWORD),
    });

    const login = await context.app.inject({
      method: "POST",
      url: "/vendor/session",
      payload: { email, password: PASSWORD },
    });

    expect(login.statusCode).toBe(200);
    cookie = String(login.headers["set-cookie"]).split(";")[0] ?? "";
  });

  afterAll(async () => {
    await context.close();
  });

  describe("the session", () => {
    it("refuses a wrong password", async () => {
      context.resetThrottle();
      const response = await context.app.inject({
        method: "POST",
        url: "/vendor/session",
        payload: { email, password: "wrong-password" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("keeps every vendor route closed without the vendor cookie", async () => {
      for (const url of [
        "/vendor/session",
        "/vendor/clinics",
        "/vendor/plans",
        "/vendor/overview",
      ]) {
        const response = await context.app.inject({ method: "GET", url });

        expect([url, response.statusCode]).toEqual([url, 401]);
      }
    });

    it("never takes a clinic admin's token for a vendor session", async () => {
      const clinic = await context.createClinic();
      const response = await context.app.inject({
        method: "GET",
        url: "/vendor/clinics",
        headers: auth(await context.login(clinic.phones[USER_ROLE.ADMIN])),
      });

      expect(response.statusCode).toBe(401);
    });

    it("never takes the vendor cookie on a clinic route", async () => {
      const response = await call("GET", "/patients");

      expect(response.statusCode).toBe(401);
    });

    it("answers who is signed in", async () => {
      const response = await call("GET", "/vendor/session");

      expect(response.json()).toMatchObject({ email, name: "Vendor" });
    });
  });

  describe("subscriptions", () => {
    it("computes a clinic's modules from its plan and add-ons, and records the change", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([CLINIC_MODULE.APPOINTMENTS, CLINIC_MODULE.LABS]);

      const saved = await call(
        "PUT",
        `/vendor/clinics/${clinic.id}/subscription`,
        subscription(plan.id, { addOnModules: [CLINIC_MODULE.WEBSITE] }),
      );

      expect(saved.statusCode).toBe(204);
      expect(await modulesOf(clinic)).toEqual([
        CLINIC_MODULE.APPOINTMENTS,
        CLINIC_MODULE.LABS,
        CLINIC_MODULE.WEBSITE,
      ]);

      const detail = (await call("GET", `/vendor/clinics/${clinic.id}`)).json<VendorClinicDetail>();

      expect(detail.subscription).toMatchObject({
        planId: plan.id,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        addOnModules: [CLINIC_MODULE.WEBSITE],
      });
      expect(detail.events[0]).toMatchObject({
        action: SUBSCRIPTION_EVENT.SUBSCRIPTION_SAVED,
        actor: "Vendor",
        oldValue: null,
      });
    });

    it("refuses booking without appointments", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([CLINIC_MODULE.LABS]);

      const saved = await call(
        "PUT",
        `/vendor/clinics/${clinic.id}/subscription`,
        subscription(plan.id, { addOnModules: [CLINIC_MODULE.BOOKING] }),
      );

      expect(saved.statusCode).toBe(400);
      expect(saved.json()).toMatchObject({ message: VENDOR_MISSING_MODULES });
      expect(await modulesOf(clinic)).toEqual([]);
    });

    it("carries a plan's new modules to every clinic on it", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([CLINIC_MODULE.LABS]);

      await call("PUT", `/vendor/clinics/${clinic.id}/subscription`, subscription(plan.id));

      const updated = await call("PATCH", `/vendor/plans/${plan.id}`, {
        code: plan.code,
        name: plan.name,
        modules: [CLINIC_MODULE.LABS, CLINIC_MODULE.INVENTORY],
        maxUsers: null,
        maxDoctors: null,
        isActive: true,
      });

      expect(updated.statusCode).toBe(204);
      expect(await modulesOf(clinic)).toEqual([CLINIC_MODULE.LABS, CLINIC_MODULE.INVENTORY]);
    });

    it("lists a clinic with its subscription and filters by status", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([CLINIC_MODULE.LABS]);

      await call(
        "PUT",
        `/vendor/clinics/${clinic.id}/subscription`,
        subscription(plan.id, { status: SUBSCRIPTION_STATUS.TRIAL }),
      );

      const trials = (await call("GET", `/vendor/clinics?status=trial&search=${clinic.slug}`)).json<
        Paginated<VendorClinicSummary>
      >();
      const unmanaged = (
        await call("GET", `/vendor/clinics?status=none&search=${clinic.slug}`)
      ).json<Paginated<VendorClinicSummary>>();

      expect(trials.items.map((item) => item.id)).toEqual([clinic.id]);
      expect(trials.items[0]?.subscription?.planName).toBe(plan.name);
      expect(trials.items[0]?.users).toBeGreaterThan(0);
      expect(unmanaged.items).toEqual([]);
    });
  });

  describe("expiry", () => {
    it("moves an ended subscription to grace, then suspends it, recording each step", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([CLINIC_MODULE.LABS]);
      const service = context.app.get(SubscriptionsService);

      await call(
        "PUT",
        `/vendor/clinics/${clinic.id}/subscription`,
        subscription(plan.id, { endsOn: addDays(today(), -1), graceDays: 3 }),
      );

      await service.advance(today());
      expect(
        (await call("GET", `/vendor/clinics/${clinic.id}`)).json<VendorClinicDetail>().subscription
          ?.status,
      ).toBe(SUBSCRIPTION_STATUS.GRACE);

      await service.advance(addDays(today(), 5));
      expect(
        (await call("GET", `/vendor/clinics/${clinic.id}`)).json<VendorClinicDetail>().subscription
          ?.status,
      ).toBe(SUBSCRIPTION_STATUS.SUSPENDED);

      const events = await context.db
        .select({ action: subscriptionEvents.action, actor: subscriptionEvents.vendorUserId })
        .from(subscriptionEvents)
        .where(eq(subscriptionEvents.clinicId, clinic.id));

      expect(events.filter((event) => event.action === SUBSCRIPTION_EVENT.STATUS_ADVANCED)).toEqual(
        [
          { action: SUBSCRIPTION_EVENT.STATUS_ADVANCED, actor: null },
          { action: SUBSCRIPTION_EVENT.STATUS_ADVANCED, actor: null },
        ],
      );
    });

    it("leaves a subscription without an end date alone", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([CLINIC_MODULE.LABS]);

      await call(
        "PUT",
        `/vendor/clinics/${clinic.id}/subscription`,
        subscription(plan.id, { endsOn: null }),
      );
      await context.app.get(SubscriptionsService).advance(addDays(today(), 3650));

      expect(
        (await call("GET", `/vendor/clinics/${clinic.id}`)).json<VendorClinicDetail>().subscription
          ?.status,
      ).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    });
  });

  describe("a suspended clinic", () => {
    it("reads but refuses every change, to the admin too", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const plan = await createPlan([]);
      const headers = auth(await context.login(clinic.phones[USER_ROLE.ADMIN]));

      await call(
        "PUT",
        `/vendor/clinics/${clinic.id}/subscription`,
        subscription(plan.id, { status: SUBSCRIPTION_STATUS.SUSPENDED }),
      );

      const read = await context.app.inject({ method: "GET", url: "/patients", headers });
      const write = await context.app.inject({
        method: "POST",
        url: "/notes",
        headers,
        payload: { body: "note" },
      });

      expect(read.statusCode).toBe(200);
      expect(write.statusCode).toBe(403);
      expect(write.json()).toMatchObject({ message: CLINIC_ERROR.SUSPENDED });
    });
  });

  it("keeps the change history append-only", async () => {
    await expect(
      context.db.update(subscriptionEvents).set({ action: "rewritten" }),
    ).rejects.toThrow();
  });
});
