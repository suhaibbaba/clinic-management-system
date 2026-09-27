import { MOVEMENT_TYPE, USER_ROLE, type MovementType } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { subMonths } from "date-fns";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@web/i18n/locales/ar.json";
import { toIsoDate } from "@web/features/appointments/calendar-time";
import { ItemPage } from "@web/features/inventory/item-page";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";
import { choose } from "@test/select";

const ITEM_ID = "44444444-4444-4444-8444-444444444444";

const batch = (
  batchNo: string,
  expiryDate: string,
  remaining: string,
  quantity: string,
  flags: { isExpired?: boolean; isExpiring?: boolean } = {},
) => ({
  batchNo,
  expiryDate,
  receivedAt: "2026-01-01T09:00:00.000Z",
  quantity,
  remaining,
  isExpired: flags.isExpired ?? false,
  isExpiring: flags.isExpiring ?? false,
});

const movement = (id: string, type: MovementType, quantity: string, runningQuantity: string) => ({
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

function render(
  route = `/inventory/items/${ITEM_ID}?tab=movements`,
  overrides: Record<string, Record<string, unknown>> = {},
) {
  authTokens.clear();
  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    [`GET /inventory/items/${ITEM_ID}`]: {
      status: 200,
      body: {
        id: ITEM_ID,
        clinicId: "clinic",
        name: "Latex gloves",
        category: "consumable",
        unit: "box",
        quantity: "123",
        minQuantity: "10",
        isLow: false,
        isExpiring: false,
        isExpired: false,
        nearestExpiry: null,
        supplierName: null,
        notes: null,
      },
    },
    [`GET /inventory/items/${ITEM_ID}/batches`]: {
      status: 200,
      body: {
        itemId: ITEM_ID,
        quantity: "123",
        unbatched: "3",
        batches: [
          batch("LATE", "2028-01-01", "40", "40"),
          batch("GONE", "2026-01-01", "80", "100", { isExpired: true }),
          batch("USED", "2027-01-01", "0", "20"),
        ],
      },
    },
    [`GET /inventory/items/${ITEM_ID}/movements`]: {
      status: 200,
      body: paginated(
        [
          { ...movement("m2", MOVEMENT_TYPE.CONSUME, "-2", "123"), ...overrides["m2"] },
          { ...movement("m1", MOVEMENT_TYPE.PURCHASE, "5", "125"), ...overrides["m1"] },
        ],
        { total: 2 },
      ),
    },
    "GET /suppliers": { status: 200, body: paginated([]) },
  });

  renderWithProviders(
    <Routes>
      <Route path="/inventory/items/:id" element={<ItemPage />} />
    </Routes>,
    { route },
  );

  return api;
}

const lastMovements = (api: ReturnType<typeof render>): string =>
  api.calls.filter((call) => call.url.includes("/movements")).at(-1)?.url ?? "";

const rowFor = async (amount: string): Promise<HTMLElement> =>
  (await screen.findByText(amount)).closest("tr, [data-part='table-card']") as HTMLElement;

function setViewport(isMobile: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isMobile && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const openActions = async (): Promise<HTMLElement> => {
  await userEvent.click(await screen.findByRole("button", { name: ar.inventory.itemPage.actions }));
  return screen.findByRole("menu");
};

describe("an item's page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps buying and using as buttons, and the rarer acts behind the three dots", async () => {
    setViewport(false);
    render(`/inventory/items/${ITEM_ID}`);

    const header = await screen.findByTestId("item-header");
    expect(
      await within(header).findByRole("button", { name: ar.inventory.movement.action.purchase }),
    ).toBeVisible();
    expect(
      within(header).getByRole("button", { name: ar.inventory.movement.action.consume }),
    ).toBeVisible();

    const menu = await openActions();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([ar.inventory.movement.action.adjust, ar.inventory.editItem]);
  });

  it("puts every act behind the three dots on a phone, on the heading's row", async () => {
    setViewport(true);
    render(`/inventory/items/${ITEM_ID}`);

    const header = await screen.findByTestId("item-header");
    await within(header).findByRole("button", { name: ar.inventory.itemPage.actions });
    expect(
      within(header).queryByRole("button", { name: ar.inventory.movement.action.purchase }),
    ).toBeNull();

    const menu = await openActions();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      ar.inventory.movement.action.purchase,
      ar.inventory.movement.action.consume,
      ar.inventory.movement.action.adjust,
      ar.inventory.editItem,
    ]);
  });

  it("opens on the overview, with the stock and the batches", async () => {
    render(`/inventory/items/${ITEM_ID}`);

    expect(await screen.findByTestId("item-name")).toHaveTextContent("Latex gloves");
    expect(screen.getByTestId("item-kpi-quantity")).toHaveTextContent("123");
    expect(await screen.findByTestId("item-batches")).toBeInTheDocument();
    expect(screen.queryByTestId("item-movements")).toBeNull();
  });

  it("lists what is left on the shelf, soonest to expire first, with what it came from", async () => {
    render(`/inventory/items/${ITEM_ID}`);

    const table = await screen.findByTestId("item-batches-table");
    await within(table).findByText("GONE");
    const rows = within(table).getAllByRole("row").slice(1);

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("GONE"),
      expect.stringContaining("LATE"),
      expect.stringContaining(ar.inventory.batches.unbatched),
    ]);
    expect(rows[0]).toHaveTextContent(ar.inventory.flags.expired);
    expect(rows[0]).toHaveTextContent(ar.inventory.batches.of.replace("{{quantity}}", "100"));
    expect(within(table).queryByText("USED")).toBeNull();
  });

  describe("movements", () => {
    it("asks for the last three months by default, one page at a time", async () => {
      const api = render();

      await screen.findByText("+5");
      const url = new URL(lastMovements(api), "http://x");
      const from = new Date(url.searchParams.get("from") ?? "");

      expect(toIsoDate(from)).toBe(toIsoDate(subMonths(new Date(), 3)));
      expect(url.searchParams.get("to")).toBeNull();
      expect(url.searchParams.get("limit")).toBe("10");
      expect(await screen.findByTestId("item-movements-count")).toHaveTextContent("2");
    });

    it("drops the window when the address says the whole history", async () => {
      const api = render(`/inventory/items/${ITEM_ID}?tab=movements&from=&to=`);

      await screen.findByText("+5");
      expect(lastMovements(api)).not.toContain("from=");
    });

    it("filters by type on the server and starts again at the first page", async () => {
      const api = render(`/inventory/items/${ITEM_ID}?tab=movements&page=2`);
      await screen.findByText("+5");

      await choose(screen.getByTestId("item-movements-type"), ar.inventory.movements.consume);

      await waitFor(() => expect(lastMovements(api)).toContain("type=consume"));
      expect(lastMovements(api)).toContain("page=1");
    });

    // The sign, not the colour: what a class is called is not what a reader sees, and the colour
    // itself is asserted where a browser can resolve it — see `stock-history.browser.test.tsx`.
    it("reads a purchase as a rise and a use as a fall, with a real minus sign", async () => {
      render();

      expect(within(await rowFor("+5")).getByTestId("item-movement-quantity")).toHaveTextContent(
        "+5",
      );
      expect(within(await rowFor("−2")).getByTestId("item-movement-quantity")).toHaveTextContent(
        "−2",
      );
    });

    it("says what each movement left on the shelf", async () => {
      render();

      expect(within(await rowFor("+5")).getByTestId("item-movement-after")).toHaveTextContent(
        "125",
      );
      expect(within(await rowFor("−2")).getByTestId("item-movement-after")).toHaveTextContent(
        "123",
      );
    });

    it("names the batch and the unit price instead of leaving bare figures", async () => {
      render(undefined, {
        m1: { batchNo: "B1021", unitPrice: "6.00", supplierName: "Birzeit Pharmaceuticals" },
      });

      const bought = await rowFor("+5");
      expect(bought).toHaveTextContent(ar.inventory.history.batch.replace("{{batch}}", "B1021"));
      expect(bought).toHaveTextContent("Birzeit Pharmaceuticals");
      expect(bought).toHaveTextContent(
        ar.inventory.history.unitPrice.split("{{price}}")[1]!.trim(),
      );
    });

    it("keeps the reversal in the row's menu rather than a button on every row", async () => {
      render();

      const row = await rowFor("+5");
      expect(within(row).queryByRole("button", { name: ar.inventory.history.reverse })).toBeNull();
      expect(within(row).getByRole("button", { name: ar.inventory.history.menu })).toBeVisible();
    });
  });
});
