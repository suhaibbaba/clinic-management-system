import { USER_ROLE, type UserRole } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import {
  makeBalance,
  makeClinic,
  makePatient,
  makePayment,
  makeProfile,
  makeStatement,
  makeStatementEntry,
  paginated,
  PATIENT_ID,
} from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

function handlers(role: UserRole, overrides: Record<string, MockResponse> = {}) {
  return {
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /patients": { status: 200, body: paginated([]) },
    "GET /doctors": { status: 200, body: paginated([]) },
    "GET /performed-procedures": { status: 200, body: paginated([]) },
    "GET /procedure-catalog": { status: 200, body: paginated([]) },
    [`GET /patients/${PATIENT_ID}`]: { status: 200, body: makePatient() },
    [`GET /patients/${PATIENT_ID}/allergy-flags`]: {
      status: 200,
      body: { patientId: PATIENT_ID, hasAllergies: false, allergies: [] },
    },
    [`GET /patients/${PATIENT_ID}/balance`]: { status: 200, body: makeBalance() },
    [`GET /patients/${PATIENT_ID}/statement`]: { status: 200, body: makeStatement() },
    "POST /payments": { status: 201, body: makePayment() },
    ...overrides,
  } as Record<string, MockResponse>;
}

async function renderAccountTab(role: UserRole, overrides: Record<string, MockResponse> = {}) {
  authTokens.clear();
  const api = mockApi(handlers(role, overrides));
  renderWithProviders(<AppRoutes />, { route: `/patients/${PATIENT_ID}` });

  const tab = await screen.findByRole("tab", { name: ar.patients.tabs.billing });
  await userEvent.click(tab);

  return api;
}

const NBSP = "\u00A0";

describe("Billing", () => {
  beforeEach(() => {
    authTokens.clear();
    // The receipt opens in a new tab from a blob; jsdom has neither.
    vi.stubGlobal("open", vi.fn());
    URL.createObjectURL = vi.fn(() => "blob:receipt");
    URL.revokeObjectURL = vi.fn();
  });

  describe("account tab", () => {
    it("runs the balance down the statement", async () => {
      await renderAccountTab(USER_ROLE.DOCTOR);

      const table = await screen.findByRole("table");
      const rows = within(table).getAllByRole("row").slice(1);

      const cells = (row: HTMLElement): string[] =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent?.trim() ?? "");

      expect(rows).toHaveLength(2);
      // Newest first, each row with the balance after it. Whole numbers and the clinic's symbol;
      // the space between figure and symbol is non-breaking, so a narrow column cannot split them.
      expect(cells(rows[0]!).slice(1, 6)).toEqual([
        `${ar.billing.kinds.payment}#000012`,
        "دفعة على الحساب",
        "",
        `50${NBSP}$`,
        `100${NBSP}$`,
      ]);
      expect(cells(rows[1]!).slice(1, 6)).toEqual([
        "حشوة تجميلية",
        "—",
        `150${NBSP}$`,
        "",
        `150${NBSP}$`,
      ]);
    });

    it("names the procedure and nothing clinical beside it", async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      expect(await screen.findByText("حشوة تجميلية")).toBeInTheDocument();
      expect(screen.queryByText(/تشخيص/)).not.toBeInTheDocument();
    });

    it("records a payment and prints its receipt", async () => {
      const api = await renderAccountTab(USER_ROLE.RECEPTIONIST, {
        [`GET /payments/${makePayment().id}/receipt`]: { status: 200, body: {} },
      });

      await userEvent.click(await screen.findByRole("button", { name: ar.billing.recordPayment }));

      const amount = await screen.findByLabelText(new RegExp(ar.billing.amount));
      await userEvent.clear(amount);
      await userEvent.type(amount, "40");
      await userEvent.click(screen.getByTestId("account-payment-modal-save"));

      // Nothing is sent until the summary is confirmed.
      const summary = await screen.findByTestId("account-payment-modal-confirm");
      expect(summary).toHaveTextContent(/40/);
      expect(
        api.calls.some((entry) => entry.method === "POST" && entry.url.endsWith("/payments")),
      ).toBe(false);
      await userEvent.click(within(summary).getByTestId("account-payment-modal-confirm-confirm"));

      const posted = await vi.waitFor(() => {
        const call = api.calls.find(
          (entry) => entry.method === "POST" && entry.url.endsWith("/payments"),
        );
        expect(call).toBeDefined();
        return call!;
      });

      expect(posted.body).toMatchObject({ patientId: PATIENT_ID, amount: "40.00", method: "cash" });

      // The receipt is the point of taking the payment, so it is fetched too.
      await vi.waitFor(() => {
        expect(
          api.calls.some((entry) => entry.url.includes(`/payments/${makePayment().id}/receipt`)),
        ).toBe(true);
      });
    });

    it("is read-only for a doctor", async () => {
      await renderAccountTab(USER_ROLE.DOCTOR);

      await screen.findByRole("table");
      expect(
        screen.queryByRole("button", { name: ar.billing.recordPayment }),
      ).not.toBeInTheDocument();
    });

    const openEntryMenu = async (): Promise<void> => {
      await screen.findByRole("table");
      await userEvent.click(screen.getByRole("button", { name: ar.billing.entryMenu }));
    };

    it("offers the reversal and the deletion to an admin, in the row's menu", async () => {
      await renderAccountTab(USER_ROLE.ADMIN);
      await openEntryMenu();

      expect(await screen.findByRole("menuitem", { name: ar.billing.reverse })).toBeVisible();
      expect(screen.getByRole("menuitem", { name: ar.common.delete })).toBeVisible();
    });

    it("offers a receptionist the receipt only — only an admin may correct a payment", async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);
      await openEntryMenu();

      expect(await screen.findByRole("menuitem", { name: ar.billing.receipt })).toBeVisible();
      expect(screen.queryByRole("menuitem", { name: ar.billing.reverse })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: ar.common.delete })).not.toBeInTheDocument();
    });

    it("deletes a payment only after the confirmation", async () => {
      const api = await renderAccountTab(USER_ROLE.ADMIN, {
        [`DELETE /payments/${makePayment().id}`]: { status: 204 },
      });
      await openEntryMenu();
      await userEvent.click(await screen.findByRole("menuitem", { name: ar.common.delete }));

      const dialog = await screen.findByTestId("statement-confirm-delete");
      expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
      await userEvent.click(within(dialog).getByRole("button", { name: ar.common.deleteForever }));

      await waitFor(() =>
        expect(
          api.calls.some(
            (call) =>
              call.method === "DELETE" && call.url.endsWith(`/payments/${makePayment().id}`),
          ),
        ).toBe(true),
      );
    });

    it("keeps a deleted payment on an admin's statement, named, and outside the balance", async () => {
      await renderAccountTab(USER_ROLE.ADMIN, {
        [`GET /patients/${PATIENT_ID}/statement`]: {
          status: 200,
          body: makeStatement({
            entries: [
              makeStatementEntry({
                id: makePayment().id,
                kind: "payment",
                amount: "-30.00",
                runningBalance: "150.00",
                receiptNumber: 13,
                deletedAt: "2026-09-20T10:00:00.000Z",
                deletedBy: { ar: "سائد أبو عبيد", en: "Saed Abu Obeid" },
              }),
            ],
          }),
        },
      });

      const row = (await screen.findByTestId("statement-deleted")).closest("tr") as HTMLElement;
      expect(within(row).getByTestId("statement-deleted-by")).toHaveTextContent("سائد أبو عبيد");
      expect(within(row).getByTestId("statement-deleted-by")).toHaveTextContent("20 Sep 2026");
      expect(within(row).queryByRole("button", { name: ar.billing.entryMenu })).toBeNull();
      expect(row).toHaveTextContent("—");
    });

    it("refuses a payment above what the patient owes", async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      await userEvent.click(await screen.findByRole("button", { name: ar.billing.recordPayment }));
      const amount = await screen.findByLabelText(new RegExp(ar.billing.amount));
      await userEvent.clear(amount);
      await userEvent.type(amount, "500");

      expect(await screen.findByText(ar.errors.payment.exceedsBalance)).toBeVisible();
      expect(screen.getByTestId("account-payment-modal-save")).toBeDisabled();
    });

    it("says what the balance will be as the amount is typed, and continues to a summary", async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      await userEvent.click(await screen.findByRole("button", { name: ar.billing.recordPayment }));
      const amount = await screen.findByLabelText(new RegExp(ar.billing.amount));
      await userEvent.clear(amount);
      await userEvent.type(amount, "30");

      // Owed 100, paying 30.
      expect(await screen.findByText(/70/)).toHaveTextContent(
        ar.billing.balanceAfter.split(":")[0]!,
      );

      // The form's button moves on; only the summary's records, so the two never read alike.
      const save = screen.getByTestId("account-payment-modal-save");
      expect(save).toHaveTextContent(ar.common.continue);
      await userEvent.click(save);
      const summary = await screen.findByTestId("account-payment-modal-confirm");
      expect(
        within(summary).getByRole("button", { name: ar.billing.recordAndPrint }),
      ).toBeVisible();
    });

    it("takes the note in a multi-line field", async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      await userEvent.click(await screen.findByRole("button", { name: ar.billing.recordPayment }));
      expect((await screen.findByTestId("payment-field-note")).tagName).toBe("TEXTAREA");
    });

    it("starts with no amount, and says what the patient owes", async () => {
      await renderAccountTab(USER_ROLE.RECEPTIONIST);

      await userEvent.click(await screen.findByRole("button", { name: ar.billing.recordPayment }));

      expect(await screen.findByLabelText(new RegExp(ar.billing.amount))).toHaveValue("");
      // With nothing typed, the balance after is what is owed now.
      expect(
        within(screen.getByTestId("account-payment-modal")).getByText(
          new RegExp(`${ar.billing.balanceAfter.split(":")[0]!}.*100`),
        ),
      ).toBeVisible();
    });
  });

  // The standalone overdue screen is gone; the address is not — it lands on the patients-list
  // filter that replaced it.
  describe("the retired overdue screen", () => {
    it("carries its old address to the patients list, already filtered", async () => {
      authTokens.clear();
      const api = mockApi(handlers(USER_ROLE.RECEPTIONIST));
      renderWithProviders(<AppRoutes />, { route: "/billing/overdue" });

      expect(await screen.findByRole("heading", { name: ar.patients.title })).toBeVisible();
      expect(screen.getByRole("radio", { name: new RegExp(ar.patients.owing) })).toBeChecked();

      await waitFor(() =>
        expect(
          api.calls.some(
            (call) => call.url.includes("/patients?") && call.url.includes("hasBalance=true"),
          ),
        ).toBe(true),
      );
    });

    it("sends a doctor there too — they read balances, just not that page", async () => {
      authTokens.clear();
      mockApi(handlers(USER_ROLE.DOCTOR));
      renderWithProviders(<AppRoutes />, { route: "/billing/overdue" });

      expect(await screen.findByRole("heading", { name: ar.patients.title })).toBeVisible();
    });
  });
});
