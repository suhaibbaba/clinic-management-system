import { LEDGER_ENTRY_KIND, USER_ROLE } from "@clinic/shared";
import { screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import {
  makeBalance,
  makeClinic,
  makePatient,
  makeProfile,
  makeStatement,
  makeStatementEntry,
  paginated,
  PATIENT_ID,
} from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

// The patient's header: on a phone the "due today" badge lost the first digits of its amount, and
// the allergy badge read "Penicillin :Allergies".
describe("the patient header", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  const renderHeader = async (): Promise<void> => {
    authTokens.clear();
    mockApi({
      "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
      "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      "GET /clinic": { status: 200, body: makeClinic() },
      "GET /doctors": { status: 200, body: paginated([]) },
      "GET /patients": { status: 200, body: paginated([]) },
      "GET /procedure-catalog": { status: 200, body: paginated([]) },
      "GET /performed-procedures": { status: 200, body: paginated([]) },
      [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
      [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
        status: 200,
        body: { patientId: PATIENT_ID, hasAllergies: true, allergies: ["Penicillin", "Latex"] },
      },
      [`GET /patients/${PATIENT_ID}/balance`]: {
        status: 200,
        body: makeBalance({ balance: "3377.00" }),
      },
      [`GET /patients/${PATIENT_ID}/statement`]: {
        status: 200,
        body: makeStatement({
          entries: [makeStatementEntry({ kind: LEDGER_ENTRY_KIND.CHARGE, amount: "1700.00" })],
        }),
      },
    });
    renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });
  };

  it.each([390, 1025])("shows today's due amount whole at %ipx", async (width) => {
    await page.viewport(width, 900);
    await renderHeader();

    const due = await screen.findByTestId("patient-due-today");

    expect(due).toHaveTextContent("1700");
    // Cut text is wider than the box that shows it.
    expect(due.scrollWidth).toBeLessThanOrEqual(due.clientWidth);
  });

  it("names allergies in Arabic, and lists English ones in their own order", async () => {
    await page.viewport(390, 900);
    await renderHeader();

    const banner = await screen.findByTestId("allergy-banner");
    expect(banner).toHaveTextContent(ar.patients.allergies);
    expect(screen.getByTestId("allergy-banner-list")).toHaveAttribute("dir", "auto");
  });
});
