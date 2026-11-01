import {
  CLINIC_MODULE,
  USER_ROLE,
  type AuthenticatedUserProfile,
  type ClinicModule,
  type DashboardSummary,
  type Permissions,
} from "@clinic/shared";
import { CapabilityRegistry } from "@api/modules/permissions/services/capability-registry.service";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const CORE_SCOPES = [
  "attachments",
  "audit",
  "billing",
  "clinics",
  "dashboard",
  "doctors",
  "lookups",
  "medical-histories",
  "notes",
  "patient-attachments",
  "patient-billing",
  "patient-documents",
  "patients",
  "payments",
  "permissions",
  "prescriptions",
  "procedure-catalog",
  "procedures",
  "specialties",
  "timeline",
  "tooth-history",
  "translations",
  "users",
  "visits",
  "whats-app-checks",
];

const MODULE_SCOPES: Readonly<Record<ClinicModule, readonly string[]>> = {
  [CLINIC_MODULE.APPOINTMENTS]: [
    "appointments",
    "clinic-closures",
    "doctor-extra-hours",
    "doctor-time-off",
    "waiting-list",
  ],
  [CLINIC_MODULE.BOOKING]: ["pending-bookings"],
  [CLINIC_MODULE.LABS]: ["lab-ledger", "lab-orders", "lab-payments", "labs"],
  [CLINIC_MODULE.INVENTORY]: [
    "inventory",
    "purchase-requests",
    "purchases",
    "purchasing",
    "stock-counts",
    "supplier-payments",
    "suppliers",
  ],
  [CLINIC_MODULE.EXPENSES]: ["expenses"],
  [CLINIC_MODULE.PAYROLL]: [
    "doctor-settlements",
    "my-settlement",
    "patient-settlement-status",
    "payroll",
    "payroll-adjustments",
    "settlement-treatments",
    "staff-payments",
  ],
  [CLINIC_MODULE.WEBSITE]: ["website", "website-messages"],
  [CLINIC_MODULE.ASSISTANT]: [
    "ai",
    "ai-actions",
    "ai-automation",
    "ai-outbound",
    "ai-secrets",
    "reports",
  ],
};

const MODULE_OF_CAPABILITY: Readonly<Record<string, ClinicModule>> = {
  "doctors.updateSchedule": CLINIC_MODULE.APPOINTMENTS,
  "doctors.allSchedules": CLINIC_MODULE.APPOINTMENTS,
};

const expectedModule = (key: string): ClinicModule | "core" | "unfiled" => {
  const scope = key.split(".")[0] ?? "";
  const module = (Object.keys(MODULE_SCOPES) as ClinicModule[]).find((candidate) =>
    MODULE_SCOPES[candidate].includes(scope),
  );

  return MODULE_OF_CAPABILITY[key] ?? module ?? (CORE_SCOPES.includes(scope) ? "core" : "unfiled");
};

describe("Paid modules (e2e)", () => {
  let context: TestContext;
  let without: TestClinic;
  let withAssistant: TestClinic;

  beforeAll(async () => {
    context = await createTestContext();
    without = await context.createClinic({ modules: [] });
    withAssistant = await context.createClinic();
    context.resetThrottle();
  });

  afterAll(async () => {
    await context.close();
  });

  const as = async (clinic: TestClinic) =>
    auth(await context.login(clinic.phones[USER_ROLE.ADMIN]));

  it("closes the assistant's routes, even to the admin, while the module is off", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/ai/conversations",
      headers: await as(without),
    });

    expect(response.statusCode).toBe(403);
  });

  it("opens them once the clinic has the module", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/ai/conversations",
      headers: await as(withAssistant),
    });

    expect(response.statusCode).toBe(200);
  });

  it("leaves the assistant out of the session and the permissions page while it is off", async () => {
    const headers = await as(without);
    const me = await context.app.inject({ method: "GET", url: "/me", headers });
    const permissions = await context.app.inject({ method: "GET", url: "/permissions", headers });

    expect(me.json<AuthenticatedUserProfile>().capabilities).not.toContain("ai.chat");
    expect(
      permissions.json<Permissions>().capabilities.map((capability) => capability.key),
    ).not.toContain("ai.chat");
  });

  it("lists the assistant for a clinic that has it", async () => {
    const me = await context.app.inject({
      method: "GET",
      url: "/me",
      headers: await as(withAssistant),
    });

    expect(me.json<AuthenticatedUserProfile>().capabilities).toContain("ai.chat");
  });

  it("files every capability under core or the module the table expects", () => {
    const capabilities = context.app.get(CapabilityRegistry).all();

    expect(capabilities.map(({ key, module }) => [key, module ?? "core"])).toEqual(
      capabilities.map(({ key }) => [key, expectedModule(key)]),
    );
  });

  it.each([
    "/appointments",
    "/appointments/calendar?date=2026-11-02&range=week",
    "/waiting-list",
    "/clinic-closures",
    "/labs",
    "/lab-orders",
    "/inventory/reports/valuation",
    "/suppliers",
    "/expenses",
    "/payroll/pay-rules",
    "/appointments/pending-confirmation",
  ])("refuses %s, even to the admin, to a clinic without its module", async (url) => {
    const response = await context.app.inject({ method: "GET", url, headers: await as(without) });

    expect(response.statusCode).toBe(403);
  });

  it("keeps core open to a clinic without any module", async () => {
    const headers = await as(without);

    for (const url of ["/patients", "/visits", "/doctors", "/users"]) {
      const response = await context.app.inject({ method: "GET", url, headers });

      expect([url, response.statusCode]).toEqual([url, 200]);
    }
  });

  it("drops the day's appointments from the dashboard without the appointments module", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: await as(without),
    });
    const body = response.json<DashboardSummary>();

    expect(response.statusCode).toBe(200);
    expect(body).not.toHaveProperty("appointmentsToday");
    expect(body).not.toHaveProperty("schedule");
  });

  it("keeps them on the dashboard of a clinic that has it", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: await as(withAssistant),
    });

    expect(response.json<DashboardSummary>()).toMatchObject({
      appointmentsToday: expect.any(Number),
      schedule: expect.any(Array),
    });
  });

  it("hides the public booking page of a clinic without the booking module", async () => {
    const closed = await context.app.inject({
      method: "GET",
      url: `/public/booking/${without.slug}`,
    });
    const open = await context.app.inject({
      method: "GET",
      url: `/public/booking/${withAssistant.slug}`,
    });

    expect(closed.statusCode).toBe(404);
    expect(open.statusCode).toBe(200);
  });

  it("leaves every module's capabilities out of a core-only clinic's session", async () => {
    const me = await context.app.inject({ method: "GET", url: "/me", headers: await as(without) });
    const capabilities = me.json<AuthenticatedUserProfile>().capabilities;

    expect(capabilities).toContain("patients.list");
    expect(
      capabilities.filter((key) =>
        ["appointments.", "labs.", "inventory.", "expenses.", "payroll."].some((prefix) =>
          key.startsWith(prefix),
        ),
      ),
    ).toEqual([]);
  });
});
