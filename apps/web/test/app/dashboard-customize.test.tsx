import {
  DEFAULT_DASHBOARD_LAYOUT,
  USER_ROLE,
  USER_ROLES,
  type DashboardLayouts,
  type UserRole,
} from "@clinic/shared";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/shared/lib/auth-tokens";
import {
  makeCalendarFeed,
  makeClinic,
  makeDashboardSummary,
  makeProfile,
  paginated,
  SHIPPED_CAPABILITIES,
} from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

const layouts: DashboardLayouts = {
  roles: USER_ROLES.map((role) => ({
    role,
    layout: DEFAULT_DASHBOARD_LAYOUT,
    keyNumberOptions: DEFAULT_DASHBOARD_LAYOUT.keyNumbers,
    customized: false,
    updatedAt: null,
  })),
};

async function renderAs(
  role: UserRole,
  route: string,
  capabilities: readonly string[] = SHIPPED_CAPABILITIES[role],
): Promise<void> {
  authTokens.clear();
  mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": {
      status: 200,
      body: makeProfile({
        role,
        name: { ar: `مستخدم ${role}`, en: `User ${role}` },
        capabilities: [...capabilities],
      }),
    },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /dashboard/summary": { status: 200, body: makeDashboardSummary() },
    "GET /dashboard/layout": { status: 200, body: DEFAULT_DASHBOARD_LAYOUT },
    "GET /dashboard/layouts": { status: 200, body: layouts },
    "GET /dashboard/visits-today": { status: 200, body: { items: [], total: 0 } },
    "GET /billing/overdue": { status: 200, body: paginated([]) },
    "GET /doctors": { status: 200, body: paginated([]) },
    "GET /patients": { status: 200, body: paginated([]) },
    "GET /notes": { status: 200, body: paginated([]) },
    "GET /appointments/calendar": { status: 200, body: makeCalendarFeed() },
    "GET /appointments/pending-confirmation": { status: 200, body: paginated([]) },
    "GET /permissions": { status: 200, body: { capabilities: [], roles: [] } },
  } as Record<string, MockResponse>);

  renderWithProviders(<AppRoutes />, { route });
  await screen.findAllByText(`مستخدم ${role}`);
}

const settingsTabs = async (): Promise<string[]> =>
  within(await screen.findByRole("tablist", { name: ar.nav.settingsPage }))
    .getAllByRole("tab")
    .map((tab) => tab.textContent?.trim() ?? "");

describe("Customizing the dashboard", () => {
  it("opens the editor for the admin on the role the address names", async () => {
    await renderAs(USER_ROLE.ADMIN, "/dashboard?customize=receptionist");

    const roles = await screen.findByRole("radiogroup", { name: ar.dashboard.customize.role });

    expect(within(roles).getByRole("radio", { checked: true })).toHaveTextContent(
      ar.roles.receptionist,
    );
  });

  it.each([
    USER_ROLE.DOCTOR,
    USER_ROLE.VISITING_DOCTOR,
    USER_ROLE.TECHNICIAN,
    USER_ROLE.RECEPTIONIST,
  ])("shows the %s their own dashboard, never the editor", async (role) => {
    await renderAs(role, `/dashboard?customize=${role}`);

    expect(await screen.findByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-customize")).not.toBeInTheDocument();
  });

  it("keeps the editor closed to a role that may read the layouts but not save them", async () => {
    await renderAs(USER_ROLE.RECEPTIONIST, "/dashboard?customize=receptionist", [
      ...SHIPPED_CAPABILITIES[USER_ROLE.RECEPTIONIST],
      "dashboard.layoutsByRole",
    ]);

    expect(await screen.findByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-customize")).not.toBeInTheDocument();
  });
});

describe("The dashboard settings tab", () => {
  it("lists the admin's settings views with the dashboard among them", async () => {
    await renderAs(USER_ROLE.ADMIN, "/settings?view=dashboard");

    expect(await settingsTabs()).toContain(ar.nav.dashboard);
    expect(await screen.findByTestId("dashboard-layouts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-layouts-receptionist-customize")).toHaveAttribute(
      "href",
      "/dashboard?customize=receptionist",
    );
  });

  it("leaves the dashboard out of the settings of a role granted only the permissions page", async () => {
    await renderAs(USER_ROLE.RECEPTIONIST, "/settings?view=dashboard", [
      ...SHIPPED_CAPABILITIES[USER_ROLE.RECEPTIONIST],
      "permissions.list",
    ]);

    expect(await settingsTabs()).toEqual([ar.nav.website, ar.nav.permissions]);
    expect(screen.queryByTestId("dashboard-layouts")).not.toBeInTheDocument();
  });

  it("shows the layouts without the editor link to a role that may only read them", async () => {
    await renderAs(USER_ROLE.RECEPTIONIST, "/settings?view=dashboard", [
      ...SHIPPED_CAPABILITIES[USER_ROLE.RECEPTIONIST],
      "dashboard.layoutsByRole",
    ]);

    expect(await screen.findByTestId("dashboard-layouts")).toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-layouts-receptionist-customize"),
    ).not.toBeInTheDocument();
  });
});
