import { USER_ROLE, type InventoryItemRow } from "@clinic/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ar from "@web/i18n/locales/ar.json";
import { InventoryAlertCards } from "@web/features/inventory/alert-cards";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const lowItem = (index: number): InventoryItemRow => ({
  id: `44444444-4444-4444-8444-44444444444${index}`,
  clinicId: "55555555-5555-4555-8555-555555555555",
  name: `Low item ${index}`,
  category: "consumable",
  unit: "box",
  minQuantity: "10",
  defaultSupplierId: null,
  notes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  quantity: "1",
  supplierName: null,
  isLow: true,
  isExpiring: false,
  isExpired: false,
  nearestExpiry: null,
});

const LOW = [lowItem(1), lowItem(2), lowItem(3)];

function renderCards(low: InventoryItemRow[] = LOW) {
  authTokens.clear();
  mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.TECHNICIAN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /inventory/alerts": {
      status: 200,
      body: { expiryWarningDays: 30, low, expiring: [], expired: [] },
    },
  });
  const onSelectItem = vi.fn();
  const onShowLow = vi.fn();
  renderWithProviders(
    <InventoryAlertCards
      onSelectItem={onSelectItem}
      onShowLow={onShowLow}
      onShowExpiring={() => undefined}
    />,
  );
  return { onSelectItem, onShowLow };
}

describe("the inventory alert cards", () => {
  it("names two items, and offers the rest in a dialog", async () => {
    renderCards();
    const card = await screen.findByTestId("inventory-alert-low");

    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    await userEvent.click(within(card).getByTestId("inventory-alert-low-show-more"));

    const dialog = await screen.findByTestId("inventory-alert-low-modal");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
  });

  it("offers no more when two is all there is", async () => {
    renderCards(LOW.slice(0, 2));

    await screen.findByTestId("inventory-alert-low");
    expect(screen.queryByTestId("inventory-alert-low-show-more")).toBeNull();
  });

  it("closes the dialog on the item picked, and opens that item", async () => {
    const { onSelectItem } = renderCards();
    await userEvent.click(await screen.findByTestId("inventory-alert-low-show-more"));

    const dialog = await screen.findByTestId("inventory-alert-low-modal");
    await userEvent.click(within(dialog).getByText("Low item 3"));

    expect(onSelectItem).toHaveBeenCalledWith(LOW[2]!.id);
    expect(screen.queryByTestId("inventory-alert-low-modal")).toBeNull();
  });

  it("can still filter the table to the whole set", async () => {
    const { onShowLow } = renderCards();
    await userEvent.click(await screen.findByTestId("inventory-alert-low-show-more"));

    await userEvent.click(
      within(await screen.findByTestId("inventory-alert-low-modal")).getByRole("button", {
        name: ar.inventory.alerts.showInTable,
      }),
    );

    expect(onShowLow).toHaveBeenCalled();
  });
});
