import { MOVEMENT_TYPE, USER_ROLE, type InventoryItemRow } from "@clinic/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ar from "@web/i18n/locales/ar.json";
import { MovementModal } from "@web/features/inventory/movement-modal";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const ITEM: InventoryItemRow = {
  id: "44444444-4444-4444-8444-444444444444",
  clinicId: "55555555-5555-4555-8555-555555555555",
  name: "Anaesthetic needles 27G",
  category: "consumable",
  unit: "box",
  minQuantity: "2",
  defaultSupplierId: null,
  notes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  quantity: "5",
  supplierName: null,
  isLow: false,
  isExpiring: false,
  isExpired: false,
  nearestExpiry: null,
};

function renderCorrection(): void {
  authTokens.clear();
  mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /suppliers": { status: 200, body: paginated([]) },
  });
  renderWithProviders(
    <MovementModal type={MOVEMENT_TYPE.ADJUST} item={ITEM} onClose={() => undefined} />,
  );
}

// Taking stock off in a correction: a whole unit at least, and no more than the shelf holds.
describe("correcting a quantity by taking stock off", () => {
  it("refuses nothing, and more than is in stock, and takes what is there", async () => {
    renderCorrection();

    await screen.findByTestId("movement-field-quantity");
    const quantity = document.getElementById("movement-quantity") as HTMLInputElement;
    await userEvent.type(screen.getByTestId("movement-field-reason"), "كسر عبوة");
    const save = screen.getByTestId("movement-modal-save");

    await userEvent.type(quantity, "0");
    expect(await screen.findByText(ar.inventory.movement.atLeastOne)).toBeVisible();
    expect(save).toBeDisabled();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "6");
    expect(await screen.findByText(ar.inventory.movement.overStock)).toBeVisible();
    expect(save).toBeDisabled();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "3");
    expect(save).toBeEnabled();
  });
});
