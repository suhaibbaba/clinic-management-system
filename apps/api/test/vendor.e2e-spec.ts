import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  CLINIC_ERROR,
  CLINIC_MODULE,
  SUBSCRIPTION_EVENT,
  SUBSCRIPTION_STATUS,
  USER_ROLE,
  VENDOR_DOMAIN_TAKEN,
  VENDOR_SLUG_TAKEN,
  VENDOR_MISSING_MODULES,
  addDays,
  type Paginated,
  type Plan,
  type SaveSubscriptionInput,
  type VendorClinicDetail,
  type VendorClinicSummary,
} from "@clinic/shared";
import { clinics, subscriptionEvents, users, vendorUsers } from "@api/database/schema";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";

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

  describe("the domain", () => {
    it("stores the bare domain, records the change and finds the clinic by it", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const domain = `clinic-${randomUUID().slice(0, 8)}.example.ps`;

      const saved = await call("PUT", `/vendor/clinics/${clinic.id}/domain`, {
        domain: `https://www.${domain.toUpperCase()}/`,
      });

      expect(saved.statusCode).toBe(204);

      const detail = (await call("GET", `/vendor/clinics/${clinic.id}`)).json<VendorClinicDetail>();
      const found = (await call("GET", `/vendor/clinics?search=${domain}`)).json<
        Paginated<VendorClinicSummary>
      >();

      expect(detail.domain).toBe(domain);
      expect(detail.events[0]).toMatchObject({
        action: SUBSCRIPTION_EVENT.DOMAIN_CHANGED,
        oldValue: { domain: null },
        newValue: { domain },
      });
      expect(found.items.map((item) => item.id)).toEqual([clinic.id]);
    });

    it("refuses a domain another clinic already has", async () => {
      const first = await context.createClinic({ modules: [] });
      const second = await context.createClinic({ modules: [] });
      const domain = `taken-${randomUUID().slice(0, 8)}.example.ps`;

      await call("PUT", `/vendor/clinics/${first.id}/domain`, { domain });
      const taken = await call("PUT", `/vendor/clinics/${second.id}/domain`, { domain });

      expect(taken.statusCode).toBe(409);
      expect(taken.json()).toMatchObject({ message: VENDOR_DOMAIN_TAKEN });
    });

    it("refuses something that is not a domain, and clears one with null", async () => {
      const clinic = await context.createClinic({ modules: [] });

      await call("PUT", `/vendor/clinics/${clinic.id}/domain`, {
        domain: `clear-${randomUUID().slice(0, 8)}.example.ps`,
      });

      expect(
        (await call("PUT", `/vendor/clinics/${clinic.id}/domain`, { domain: "not a domain" }))
          .statusCode,
      ).toBe(400);
      expect(
        (await call("PUT", `/vendor/clinics/${clinic.id}/domain`, { domain: null })).statusCode,
      ).toBe(204);
      expect(
        (await call("GET", `/vendor/clinics/${clinic.id}`)).json<VendorClinicDetail>().domain,
      ).toBeNull();
    });
  });

  describe("creating and removing a clinic", () => {
    const newClinic = (planId: string) => {
      const suffix = randomUUID().slice(0, 8);

      return {
        name: { ar: `عيادة ${suffix}`, en: `Clinic ${suffix}` },
        slug: `new-${suffix}`,
        country: "PS",
        domain: `new-${suffix}.example.ps`,
        specialties: ["orthopedic"],
        planId,
        trialDays: 30,
        admin: {
          firstName: "سامر",
          lastName: "نصار",
          phone: `+97059${String(Date.now()).slice(-7)}`,
          email: null,
        },
      };
    };

    it("creates the clinic, its admin, its specialty and a trial on the plan", async () => {
      const plan = await createPlan([CLINIC_MODULE.APPOINTMENTS, CLINIC_MODULE.LABS]);
      const input = newClinic(plan.id);

      const created = await call("POST", "/vendor/clinics", input);

      expect(created.statusCode).toBe(201);

      const id = created.json<{ id: string }>().id;
      const detail = (await call("GET", `/vendor/clinics/${id}`)).json<VendorClinicDetail>();
      const [admin] = await context.db
        .select({ role: users.role, phone: users.phone })
        .from(users)
        .where(eq(users.clinicId, id));

      expect(detail).toMatchObject({
        slug: input.slug,
        domain: input.domain,
        modules: [CLINIC_MODULE.APPOINTMENTS, CLINIC_MODULE.LABS],
        specialties: ["orthopedic"],
        users: 1,
        subscription: {
          planId: plan.id,
          status: SUBSCRIPTION_STATUS.TRIAL,
          startsOn: today(),
          endsOn: addDays(today(), 30),
        },
      });
      expect(admin).toMatchObject({ role: USER_ROLE.ADMIN, phone: input.admin.phone });
      expect(detail.events[0]?.action).toBe(SUBSCRIPTION_EVENT.CLINIC_CREATED);
    });

    it("refuses a slug another clinic has", async () => {
      const plan = await createPlan([]);
      const first = newClinic(plan.id);

      await call("POST", "/vendor/clinics", first);
      const again = await call("POST", "/vendor/clinics", {
        ...newClinic(plan.id),
        slug: first.slug,
      });

      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ message: VENDOR_SLUG_TAKEN });
    });

    it("signs a removed clinic's staff out and keeps them out, until it is restored", async () => {
      const clinic = await context.createClinic({ modules: [] });
      const token = await context.login(clinic.phones[USER_ROLE.ADMIN]);
      const signIn = () =>
        context.app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { identifier: clinic.phones[USER_ROLE.ADMIN], password: TEST_PASSWORD },
        });

      const removed = await context.app.inject({
        method: "DELETE",
        url: `/vendor/clinics/${clinic.id}`,
        headers: { cookie },
      });

      expect(removed.statusCode).toBe(204);
      expect(
        (await context.app.inject({ method: "GET", url: "/patients", headers: auth(token) }))
          .statusCode,
      ).toBe(401);
      context.resetThrottle();
      expect((await signIn()).statusCode).toBe(401);

      const listed = (
        await call("GET", `/vendor/clinics?status=removed&search=${clinic.slug}`)
      ).json<Paginated<VendorClinicSummary>>();
      const live = (await call("GET", `/vendor/clinics?search=${clinic.slug}`)).json<
        Paginated<VendorClinicSummary>
      >();

      expect(listed.items[0]?.removedAt).toEqual(expect.any(String));
      expect(live.items).toEqual([]);

      expect((await call("POST", `/vendor/clinics/${clinic.id}/restore`)).statusCode).toBe(204);
      context.resetThrottle();
      expect((await signIn()).statusCode).toBe(200);

      const history = (
        await call("GET", `/vendor/clinics/${clinic.id}`)
      ).json<VendorClinicDetail>();

      expect(history.events.slice(0, 2).map((event) => event.action)).toEqual([
        SUBSCRIPTION_EVENT.CLINIC_RESTORED,
        SUBSCRIPTION_EVENT.CLINIC_REMOVED,
      ]);
    });
  });

  it("keeps the change history append-only", async () => {
    await expect(
      context.db.update(subscriptionEvents).set({ action: "rewritten" }),
    ).rejects.toThrow();
  });
});
