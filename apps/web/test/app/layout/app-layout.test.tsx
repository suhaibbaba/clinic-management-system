import { USER_ROLE, type UserRole } from "@clinic/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const ITEM_ID = "44444444-4444-4444-8444-444444444444";

function handlers(
  role: UserRole,
  capabilities: readonly string[] = SHIPPED_CAPABILITIES[role],
  overrides: Record<string, MockResponse> = {},
) {
  return {
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
    "GET /doctors": { status: 200, body: paginated([]) },
    "GET /users": { status: 200, body: paginated([]) },
    "GET /audit-log": { status: 200, body: paginated([]) },
    "GET /appointments/pending-confirmation": { status: 200, body: paginated([], { total: 4 }) },
    "GET /appointments/calendar": { status: 200, body: makeCalendarFeed() },
    "GET /notes": { status: 200, body: paginated([]) },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderAs(
  role: UserRole,
  route = "/dashboard",
  capabilities: readonly string[] = SHIPPED_CAPABILITIES[role],
): Promise<void> {
  authTokens.clear();
  mockApi(handlers(role, capabilities));

  renderWithProviders(<AppRoutes />, { route });
  await screen.findAllByText(`مستخدم ${role}`);
}

const nav = (): HTMLElement => screen.getByRole("navigation", { name: ar.nav.menu });

const linkNames = (): string[] =>
  within(nav())
    .getAllByRole("link")
    .map((link) => link.textContent?.trim() ?? "");

describe("Sidebar navigation", () => {
  it("gives an admin every section, settings included", async () => {
    await renderAs(USER_ROLE.ADMIN);

    expect(linkNames()).toEqual([
      ar.nav.dashboard,
      ar.nav.assistant,
      ar.nav.patients,
      ar.nav.appointments,
      ar.nav.labs,
      ar.nav.inventory,
      ar.nav.clinic,
      ar.nav.users,
      ar.nav.payroll,
      ar.nav.lists,
      ar.nav.settingsPage,
    ]);
  });

  it.each([
    [
      USER_ROLE.DOCTOR,
      [
        ar.nav.dashboard,
        ar.nav.assistant,
        ar.nav.patients,
        ar.nav.appointments,
        ar.nav.labs,
        ar.nav.inventory,
      ],
    ],
    [USER_ROLE.VISITING_DOCTOR, [ar.nav.dashboard, ar.nav.patients, ar.nav.appointments]],
    [
      USER_ROLE.TECHNICIAN,
      [
        ar.nav.dashboard,
        ar.nav.assistant,
        ar.nav.patients,
        ar.nav.appointments,
        ar.nav.labs,
        ar.nav.inventory,
      ],
    ],
    [
      USER_ROLE.RECEPTIONIST,
      [ar.nav.dashboard, ar.nav.assistant, ar.nav.patients, ar.nav.appointments],
    ],
  ])("gives %s exactly their sections and no settings rows", async (role, expected) => {
    await renderAs(role);

    expect(linkNames()).toEqual(expected);
    expect(within(nav()).queryByRole("link", { name: ar.nav.users })).not.toBeInTheDocument();
  });

  it("adds a section the moment its capability is granted", async () => {
    await renderAs(USER_ROLE.DOCTOR, "/dashboard", [
      ...SHIPPED_CAPABILITIES[USER_ROLE.DOCTOR],
      "users.list",
      "clinics.update",
    ]);

    expect(linkNames()).toEqual([
      ar.nav.dashboard,
      ar.nav.assistant,
      ar.nav.patients,
      ar.nav.appointments,
      ar.nav.labs,
      ar.nav.inventory,
      ar.nav.clinic,
      ar.nav.users,
    ]);
  });

  it("drops a section the moment its capability is withdrawn", async () => {
    await renderAs(
      USER_ROLE.DOCTOR,
      "/dashboard",
      SHIPPED_CAPABILITIES[USER_ROLE.DOCTOR].filter(
        (capability) => capability !== "inventory.list" && capability !== "ai.chat",
      ),
    );

    expect(linkNames()).toEqual([
      ar.nav.dashboard,
      ar.nav.patients,
      ar.nav.appointments,
      ar.nav.labs,
    ]);
  });

  it("keeps the account out of the nav and behind the avatar", async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    expect(within(nav()).queryByRole("link", { name: ar.nav.profile })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: new RegExp(ar.roles.receptionist) }));

    expect(await screen.findByRole("menuitem", { name: ar.nav.profile })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "العربية" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: ar.nav.logout })).toBeInTheDocument();
  });

  it("shows the signed-in user with their translated role", async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    expect(screen.getByText(ar.roles.receptionist)).toBeInTheDocument();
  });

  it("counts the unanswered online bookings beside the appointments row", async () => {
    await renderAs(USER_ROLE.RECEPTIONIST);

    const badge = await within(nav()).findByLabelText(
      ar.nav.waitingCount.replace("{{count}}", "4"),
    );

    expect(badge).toHaveTextContent("4");
    expect(badge.closest("a")).toHaveAttribute("href", "/appointments");
  });

  it("leaves the badge off for a doctor, who does not answer bookings", async () => {
    await renderAs(USER_ROLE.DOCTOR);

    expect(
      within(nav()).queryByLabelText(ar.nav.waitingCount.replace("{{count}}", "4")),
    ).not.toBeInTheDocument();
  });
});

describe("The settings group", () => {
  it("lists its rows without a control in front of them", async () => {
    await renderAs(USER_ROLE.ADMIN);

    expect(within(nav()).queryByRole("button")).not.toBeInTheDocument();

    for (const label of [ar.nav.clinic, ar.nav.users, ar.nav.lists, ar.nav.settingsPage]) {
      expect(within(nav()).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});

describe("The current row", () => {
  it("marks the deepest section a URL belongs to, and only that one", async () => {
    await renderAs(USER_ROLE.ADMIN, "/clinic/lists");

    const current = within(nav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent?.trim());

    expect(current).toEqual([ar.nav.lists]);
  });

  it("keeps inventory current on one item's page", async () => {
    await renderAs(USER_ROLE.TECHNICIAN, `/inventory/items/${ITEM_ID}`);

    const current = within(nav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent?.trim());

    expect(current).toEqual([ar.nav.inventory]);
  });

  it("keeps the section current on a page below it", async () => {
    await renderAs(USER_ROLE.ADMIN, "/clinic");

    const current = within(nav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent?.trim());

    expect(current).toEqual([ar.nav.clinic]);
  });
});

describe("Route guards", () => {
  it.each([
    [USER_ROLE.RECEPTIONIST, `/inventory/items/${ITEM_ID}`],
    [USER_ROLE.RECEPTIONIST, "/labs"],
    [USER_ROLE.RECEPTIONIST, "/users"],
    [USER_ROLE.DOCTOR, "/audit-log"],
    [USER_ROLE.RECEPTIONIST, "/assistant/settings"],
    [USER_ROLE.RECEPTIONIST, "/settings"],
    [USER_ROLE.DOCTOR, "/settings"],
    [USER_ROLE.VISITING_DOCTOR, "/assistant"],
    [USER_ROLE.VISITING_DOCTOR, "/labs"],
    [USER_ROLE.VISITING_DOCTOR, "/inventory"],
    [USER_ROLE.VISITING_DOCTOR, `/inventory/items/${ITEM_ID}`],
    [USER_ROLE.VISITING_DOCTOR, "/users"],
    [USER_ROLE.VISITING_DOCTOR, "/settings"],
    [USER_ROLE.DOCTOR, "/payroll"],
    [USER_ROLE.VISITING_DOCTOR, "/payroll"],
    [USER_ROLE.RECEPTIONIST, "/payroll"],
    [USER_ROLE.TECHNICIAN, "/payroll"],
  ])("redirects %s away from %s and onto the dashboard", async (role, route) => {
    await renderAs(role, route);

    expect(
      await screen.findByRole("region", { name: ar.dashboard.schedule.title }),
    ).toBeInTheDocument();
  });
});

describe("Route guards follow the grants", () => {
  it("opens a page for a role the clinic granted it to", async () => {
    await renderAs(USER_ROLE.DOCTOR, "/users", [
      ...SHIPPED_CAPABILITIES[USER_ROLE.DOCTOR],
      "users.list",
    ]);

    expect(
      screen.queryByRole("region", { name: ar.dashboard.schedule.title }),
    ).not.toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: ar.nav.users })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("Retired addresses", () => {
  it.each([
    ["/doctors", ar.nav.users, ar.nav.doctors],
    ["/clinic/translations", ar.nav.settingsPage, ar.nav.translations],
    ["/assistant/settings", ar.nav.settingsPage, ar.nav.assistant],
    ["/permissions", ar.nav.settingsPage, ar.nav.permissions],
    ["/audit-log", ar.nav.settingsPage, ar.nav.audit],
  ])("sends %s to %s, open on %s", async (route, section, view) => {
    await renderAs(USER_ROLE.ADMIN, route);

    expect(await screen.findByRole("tab", { name: view, selected: true })).toBeInTheDocument();

    const current = within(nav())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent?.trim());

    expect(current).toEqual([section]);
  });
});
