import { USER_ROLE } from "@clinic/shared";
import { screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import { authTokens } from "@web/lib/auth-tokens";
import {
  makeCalendarFeed,
  makeClinic,
  makeDashboardSummary,
  makeProfile,
  paginated,
} from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const element = (testId: string): HTMLElement => {
  const found = document.querySelector(`[data-testid="${testId}"]`);

  if (!(found instanceof HTMLElement)) {
    throw new Error(`${testId} did not render`);
  }

  return found;
};

// On Windows the rail's scrollbar sat inside its padding, over the rows' inline-end edge. Measured
// on a window short enough that the list overflows.
describe("the rail's scrollbar", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it("runs along the rail's edge, with the rows inside the logo's width", async () => {
    await page.viewport(1280, 520);
    authTokens.clear();
    mockApi({
      "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
      "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      "GET /clinic": { status: 200, body: makeClinic() },
      "GET /dashboard/summary": { status: 200, body: makeDashboardSummary() },
      "GET /appointments/pending-confirmation": { status: 200, body: paginated([]) },
      "GET /appointments/calendar": { status: 200, body: makeCalendarFeed() },
      "GET /notes": { status: 200, body: paginated([]) },
    });
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });
    await screen.findByTestId("nav-menu");

    const rail = element("app-rail").getBoundingClientRect();
    const brand = element("app-rail-brand").getBoundingClientRect();
    const lane = element("nav-menu").parentElement;

    if (!lane) {
      throw new Error("the nav has no scroll container");
    }

    expect(lane.scrollHeight).toBeGreaterThan(lane.clientHeight);

    const box = lane.getBoundingClientRect();
    const barWidth = lane.offsetWidth - lane.clientWidth;
    // Right to left, the bar is on the left.
    const barEnd = box.left + barWidth;

    expect(box.left).toBeLessThanOrEqual(rail.left + 1);

    for (const row of lane.querySelectorAll("a")) {
      const { left, right } = row.getBoundingClientRect();

      expect(left).toBeGreaterThanOrEqual(barEnd + 18);
      expect(left).toBeGreaterThanOrEqual(brand.left);
      expect(right).toBe(brand.right);
    }
  });
});

// Tablets get the phone's chrome, a 1024px landscape one included: the rail only from 1025px.
describe("where the rail gives way to the drawer", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  const renderDashboard = async (): Promise<void> => {
    authTokens.clear();
    mockApi({
      "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
      "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      "GET /clinic": { status: 200, body: makeClinic() },
      "GET /dashboard/summary": { status: 200, body: makeDashboardSummary() },
      "GET /appointments/pending-confirmation": { status: 200, body: paginated([]) },
      "GET /appointments/calendar": { status: 200, body: makeCalendarFeed() },
      "GET /notes": { status: 200, body: paginated([]) },
    });
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });
    await screen.findByTestId("app-topbar");
  };

  const shown = (testId: string): boolean => element(testId).getBoundingClientRect().width > 0;

  it.each([390, 820, 1024])("is a menu button and a drawer at %ipx", async (width) => {
    await page.viewport(width, 800);
    await renderDashboard();

    expect(shown("app-rail")).toBe(false);
    expect(shown("app-nav-toggle")).toBe(true);
  });

  it.each([1025, 1280])("is the rail from %ipx", async (width) => {
    await page.viewport(width, 800);
    await renderDashboard();

    expect(shown("app-rail")).toBe(true);
    expect(shown("app-nav-toggle")).toBe(false);
  });
});
