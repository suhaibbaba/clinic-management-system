import { USER_ROLE } from "@clinic/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makePatient, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

const PATIENT = makePatient({ fullName: "أحمد خالد الحسن", fileNumber: "00001" });

const handlers = () =>
  ({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.RECEPTIONIST }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /dashboard/summary": { status: 200, body: { date: "2026-09-15", schedule: [] } },
    "GET /appointments/pending-confirmation": { status: 200, body: paginated([]) },
    "GET /appointments/calendar": {
      status: 200,
      body: { from: "2026-09-15", to: "2026-09-15", appointments: [] },
    },
    "GET /notes": { status: 200, body: paginated([]) },
    "GET /patients": { status: 200, body: paginated([PATIENT], { total: 18 }) },
  }) as Record<string, MockResponse>;

describe("The bar’s search, off the patients list", () => {
  beforeEach(() => {
    authTokens.clear();
  });

  it("answers with the first few files and a way to the rest", async () => {
    const api = mockApi(handlers());
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    await userEvent.type(await screen.findByRole("combobox", { name: ar.nav.search }), "أحمد");

    expect(await screen.findByText(PATIENT.fullName)).toBeVisible();
    expect(
      screen.getByRole("button", { name: ar.nav.searchAll.replace("{{count}}", "18") }),
    ).toBeVisible();
    // Five at a time: the panel answers, the list is where the rest are.
    await waitFor(() => {
      expect(api.calls.some((call) => call.url.includes("limit=5"))).toBe(true);
    });
  });

  it("empties the field and takes the panel with it", async () => {
    mockApi(handlers());
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    const field = await screen.findByRole("combobox", { name: ar.nav.search });

    await userEvent.type(field, "أحمد");
    expect(await screen.findByText(PATIENT.fullName)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: ar.common.clear }));

    expect(field).toHaveValue("");
    await waitFor(() => {
      expect(screen.queryByText(PATIENT.fullName)).not.toBeInTheDocument();
    });
  });

  it("opens the file a result names", async () => {
    const api = mockApi(handlers());
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    await userEvent.type(await screen.findByRole("combobox", { name: ar.nav.search }), "أحمد");
    await userEvent.click(await screen.findByText(PATIENT.fullName));

    await waitFor(() => {
      expect(api.calls.some((call) => call.url.endsWith(`/patients/${PATIENT.id}`))).toBe(true);
    });
  });
});
