import { USER_ROLE, type SupplierSummary, type UserRole } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ar from "@web/i18n/locales/ar.json";
import { capitalizeWords } from "@web/features/inventory/supplier-form-modal";
import { SuppliersPage } from "@web/features/inventory/suppliers-page";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const SUPPLIER: SupplierSummary = {
  id: "66666666-6666-4666-8666-666666666666",
  clinicId: "55555555-5555-4555-8555-555555555555",
  name: "Al-Quds Dental Supplies",
  phone: "+97092390011",
  contactPerson: "Mr. Wael",
  notes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  purchased: "43852.00",
  itemCount: 15,
};

function renderPage(role: UserRole) {
  authTokens.clear();
  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /suppliers": { status: 200, body: paginated([SUPPLIER]) },
    [`DELETE /suppliers/${SUPPLIER.id}`]: { status: 204 },
  });
  renderWithProviders(<SuppliersPage />);
  return api;
}

const openMenu = async (): Promise<void> => {
  await userEvent.click(await screen.findByRole("button", { name: ar.inventory.suppliers.menu }));
};

describe("the suppliers page", () => {
  it("counts the records beside the search, not in the page header", async () => {
    renderPage(USER_ROLE.ADMIN);

    const count = await screen.findByTestId("suppliers-count");
    expect(count.parentElement).toContainElement(screen.getByTestId("suppliers-search"));
    expect(
      within(screen.getByTestId("suppliers-header")).queryByTestId("suppliers-count"),
    ).toBeNull();
  });

  it("offers an admin edit and delete, and deletes only after the confirmation", async () => {
    const api = renderPage(USER_ROLE.ADMIN);
    await openMenu();

    expect(await screen.findByRole("menuitem", { name: ar.common.edit })).toBeVisible();
    await userEvent.click(screen.getByRole("menuitem", { name: ar.common.delete }));

    const dialog = await screen.findByTestId("supplier-confirm-delete");
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: ar.common.deleteForever }));

    await waitFor(() =>
      expect(
        api.calls.some(
          (call) => call.method === "DELETE" && call.url.endsWith(`/suppliers/${SUPPLIER.id}`),
        ),
      ).toBe(true),
    );
  });

  it("opens the edit form from the menu without also opening the supplier's purchases", async () => {
    renderPage(USER_ROLE.ADMIN);
    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: ar.common.edit }));

    expect(await screen.findByTestId("supplier-edit-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("supplier-statement")).toBeNull();
  });

  it("gives a technician edit but not delete — archiving is the admin's", async () => {
    renderPage(USER_ROLE.TECHNICIAN);
    await openMenu();

    expect(await screen.findByRole("menuitem", { name: ar.common.edit })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: ar.common.delete })).toBeNull();
  });
});

describe("a supplier's name as typed", () => {
  it("capitalises each word and leaves the rest as written", () => {
    expect(capitalizeWords("birzeit pharmaceuticals")).toBe("Birzeit Pharmaceuticals");
    expect(capitalizeWords("al-quds dental (east)")).toBe("Al-Quds Dental (East)");
    expect(capitalizeWords("mr. wael")).toBe("Mr. Wael");
    expect(capitalizeWords("مستودع القدس")).toBe("مستودع القدس");
  });
});
