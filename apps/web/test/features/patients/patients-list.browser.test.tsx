import { USER_ROLE } from "@clinic/shared";
import { screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makePatient, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

// On a phone the "profile incomplete" badge sat beside the name and cut it to "مصعب عصام…".
describe("the patients list on a phone", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it("keeps a name whole beside the incomplete badge", async () => {
    await page.viewport(390, 800);
    authTokens.clear();
    mockApi({
      "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
      "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      "GET /clinic": { status: 200, body: makeClinic() },
      "GET /patients": {
        status: 200,
        body: paginated([
          makePatient({
            fullName: "مصعب عصام قبلاوي",
            fileNumber: "00080",
            profileIncomplete: true,
          }),
        ]),
      },
    });
    renderWithProviders(<AppRoutes />, { route: "/patients" });

    const name = await screen.findByTestId("patient-name");
    expect(await screen.findByTestId("patient-incomplete")).toBeVisible();

    // Truncated text is wider than the box that shows it.
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
  });
});
