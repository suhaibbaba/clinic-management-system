import { LEDGER_ENTRY_KIND, USER_ROLE } from "@clinic/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const LONG_NOTE = "Paid in cash at the front desk. ".repeat(12).trim();

// A one-line note in a statement row, however long, must not widen the phone card past the screen.
describe("the statement on a phone", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it("keeps a long note inside a 365px screen", async () => {
    await page.viewport(365, 800);
    authTokens.clear();
    mockApi({
      "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
      "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
      "GET /clinic": { status: 200, body: makeClinic() },
      "GET /patients": { status: 200, body: paginated([]) },
      "GET /doctors": { status: 200, body: paginated([]) },
      [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
      [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
        status: 200,
        body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
      },
      [`GET /patients/${PATIENT_ID}/balance`]: { status: 200, body: makeBalance() },
      [`GET /patients/${PATIENT_ID}/statement`]: {
        status: 200,
        body: makeStatement({
          entries: [
            makeStatementEntry({
              kind: LEDGER_ENTRY_KIND.PAYMENT,
              amount: "-50.00",
              runningBalance: "100.00",
              receiptNumber: 12,
              description: LONG_NOTE,
              note: LONG_NOTE,
            }),
          ],
        }),
      },
    });
    renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });

    await userEvent.click(await screen.findByRole("tab", { name: ar.patients.tabs.billing }));
    const note = await screen.findByText(LONG_NOTE, { selector: "p" });

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    expect(note.getBoundingClientRect().right).toBeLessThanOrEqual(root.clientWidth);
    expect(screen.getByRole("button", { name: ar.common.showMore })).toBeVisible();
  });
});
