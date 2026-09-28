import { USER_ROLE, type InventoryItemRow } from "@clinic/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ar from "@web/i18n/locales/ar.json";
import { InventoryPage } from "@web/pages/inventory/inventory-page";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type RouteHandler } from "@test/helpers/render";

const item = (id: string, name: string): InventoryItemRow => ({
  id,
  clinicId: "55555555-5555-4555-8555-555555555555",
  name,
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
});

const PAGE_ONE = item("44444444-4444-4444-8444-444444444441", "Anaesthetic needles 27G");
const PAGE_TWO = item("44444444-4444-4444-8444-444444444442", "Suction tips");

function renderPage(route = "/inventory") {
  authTokens.clear();
  const items: RouteHandler = ({ url }) =>
    url.includes("page=2")
      ? { status: 200, body: paginated([PAGE_TWO], { page: 2, total: 2, totalPages: 2 }) }
      : { status: 200, body: paginated([PAGE_ONE], { total: 2, totalPages: 2 }) };
  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /inventory/items": items,
    "GET /inventory/alerts": {
      status: 200,
      body: { expiryWarningDays: 30, low: [], expiring: [], expired: [] },
    },
  });
  renderWithProviders(
    <Routes>
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/inventory/items/:id" element={<p data-testid="item-page-stub" />} />
    </Routes>,
    { route },
  );
  return api;
}

describe("the inventory page", () => {
  const lastList = (api: ReturnType<typeof renderPage>): string =>
    api.calls.filter((call) => call.url.includes("/inventory/items")).at(-1)?.url ?? "";

  it("asks the server for one page at a time and moves to the next", async () => {
    const api = renderPage();

    expect(await screen.findByText(PAGE_ONE.name)).toBeInTheDocument();
    expect(lastList(api)).toContain("page=1");
    expect(lastList(api)).toContain("limit=10");

    await userEvent.click(screen.getByRole("button", { name: ar.pagination.next }));

    expect(await screen.findByText(PAGE_TWO.name)).toBeInTheDocument();
    expect(lastList(api)).toContain("page=2");
  });

  it("counts every matching item beside the filters, not only this page", async () => {
    renderPage();

    const count = await screen.findByTestId("inventory-count");
    expect(count).toHaveTextContent("2");
    expect(count.closest("div")).toContainElement(screen.getByTestId("inventory-search"));
  });

  it("opens on the page and filter the address names", async () => {
    const api = renderPage("/inventory?page=2&low=1");

    expect(await screen.findByText(PAGE_TWO.name)).toBeInTheDocument();
    expect(lastList(api)).toContain("page=2");
    expect(lastList(api)).toContain("low=true");
  });

  it("opens an item's own page from its row", async () => {
    renderPage();

    await userEvent.click(await screen.findByText(PAGE_ONE.name));

    expect(await screen.findByTestId("item-page-stub")).toBeInTheDocument();
  });

  it("goes back to the first page when a filter narrows the list", async () => {
    const api = renderPage("/inventory?page=2");
    await screen.findByText(PAGE_TWO.name);

    await userEvent.click(screen.getByTestId("inventory-filter-low"));

    await waitFor(() => expect(lastList(api)).toContain("low=true"));
    expect(lastList(api)).toContain("page=1");
  });
});
