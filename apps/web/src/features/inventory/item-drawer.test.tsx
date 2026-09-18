import { MOVEMENT_TYPE, USER_ROLE } from "@clinic/shared";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ar from "@web/i18n/locales/ar.json";
import { ItemDrawer } from "@web/features/inventory/item-drawer";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const ITEM_ID = "44444444-4444-4444-8444-444444444444";

const movement = (
  id: string,
  type: (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE],
  quantity: string,
  runningQuantity: string,
) => ({
  id,
  clinicId: "clinic",
  itemId: ITEM_ID,
  type,
  quantity,
  runningQuantity,
  unitPrice: null,
  supplierId: null,
  supplierName: null,
  patientId: null,
  patientName: null,
  performedProcedureId: null,
  procedureName: null,
  batchNo: null,
  expiryDate: null,
  reason: null,
  reversesId: null,
  reversedAt: null,
  createdByName: null,
  createdAt: "2026-09-18T09:00:00.000Z",
});

function render() {
  authTokens.clear();
  mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    [`GET /inventory/items/${ITEM_ID}`]: {
      status: 200,
      body: {
        id: ITEM_ID,
        clinicId: "clinic",
        nameAr: "قفازات",
        category: "consumable",
        unit: "box",
        quantity: "123",
        minQuantity: "10",
        isLow: false,
        isExpired: false,
        nearestExpiry: null,
        supplierName: null,
        notes: null,
      },
    },
    [`GET /inventory/items/${ITEM_ID}/batches`]: {
      status: 200,
      body: { batches: [], unbatched: "0" },
    },
    [`GET /inventory/items/${ITEM_ID}/movements`]: {
      status: 200,
      body: paginated([
        movement("m2", MOVEMENT_TYPE.CONSUME, "-2", "123"),
        movement("m1", MOVEMENT_TYPE.PURCHASE, "5", "125"),
      ]),
    },
  });

  renderWithProviders(<ItemDrawer itemId={ITEM_ID} onClose={() => {}} />);
}

const rowFor = async (amount: string): Promise<HTMLElement> =>
  (await screen.findByText(amount)).closest("li") as HTMLElement;

describe("stock movement history", () => {
  it("reads a purchase as a rise and a withdrawal as a fall", async () => {
    render();

    const bought = await rowFor("+5");
    const used = await rowFor("-2");

    expect(within(bought).getByText("+5").className).toContain("text-success-900");
    expect(within(used).getByText("-2").className).toContain("text-danger-600");
  });

  it("says what the stock was before the movement and what it left behind", async () => {
    render();

    // 120 -> 125 on a purchase of 5; 125 -> 123 on a withdrawal of 2. The figure the row shows is
    // the stock that movement left, which for an older row is not the stock now.
    const bought = within(await rowFor("+5"));
    expect(bought.getByText(ar.inventory.history.balance)).toBeInTheDocument();
    expect(bought.getByText("120")).toBeInTheDocument();
    expect(bought.getByText("125")).toBeInTheDocument();

    const used = within(await rowFor("-2"));
    expect(used.getByText("125")).toBeInTheDocument();
    expect(used.getByText("123")).toBeInTheDocument();
  });

  it("names every fact it prints", async () => {
    render();

    expect(await screen.findAllByText(ar.inventory.history.when)).not.toHaveLength(0);
    expect(screen.getAllByText(ar.inventory.history.balance)).not.toHaveLength(0);
  });
});
