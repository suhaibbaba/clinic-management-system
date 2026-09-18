import { USER_ROLE, type UserRole } from "@clinic/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

const base = (overrides: Record<string, unknown> = {}, role: UserRole = USER_ROLE.RECEPTIONIST) =>
  ({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /dashboard/summary": { status: 200, body: { date: "2026-09-15", schedule: [] } },
    "GET /appointments/calendar": {
      status: 200,
      body: { from: "2026-09-15", to: "2026-09-15", appointments: [] },
    },
    "GET /notes": { status: 200, body: paginated([]) },
    "GET /appointments/pending-confirmation": { status: 200, body: paginated([], { total: 0 }) },
    "GET /waiting-list": { status: 200, body: paginated([], { total: 0 }) },
    "GET /patients": { status: 200, body: paginated([], { total: 0 }) },
    ...overrides,
  }) as Record<string, MockResponse>;

describe("The bell", () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it("counts what is waiting and leads to the screen that answers it", async () => {
    mockApi(
      base({
        "GET /appointments/pending-confirmation": {
          status: 200,
          body: paginated([], { total: 2 }),
        },
        "GET /patients": { status: 200, body: paginated([], { total: 3 }) },
      }),
    );
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    const bell = await screen.findByRole("button", {
      name: ar.nav.notifications.replace("{{count}}", "5"),
    });

    await userEvent.click(bell);

    expect(
      await screen.findByRole("menuitem", { name: /حجوزات إلكترونية بانتظار الرد/ }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("menuitem", { name: /رصيد متأخر/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: ar.patients.title })).toBeVisible();
    });
  });

  it("says so plainly when nothing is waiting", async () => {
    mockApi(base());
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    await userEvent.click(await screen.findByRole("button", { name: ar.nav.notificationsEmpty }));

    expect(await screen.findByText(ar.nav.notificationsEmpty)).toBeVisible();
  });

  it("tells a role only about the rooms it may enter", async () => {
    mockApi(
      base(
        {
          "GET /appointments/pending-confirmation": {
            status: 200,
            body: paginated([], { total: 2 }),
          },
        },
        USER_ROLE.TECHNICIAN,
      ),
    );
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    // A technician has neither `pending-bookings.list` nor a balance in any response.
    await userEvent.click(await screen.findByRole("button", { name: ar.nav.notificationsEmpty }));

    expect(screen.queryByRole("menuitem", { name: /حجوزات إلكترونية/ })).not.toBeInTheDocument();
  });
});
