import { LAB_ORDER_STATUS, USER_ROLE, type LabOrderRow, type LabOrderStatus } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { subMonths } from "date-fns";
import type { JSX, ReactElement } from "react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@web/i18n/locales/ar.json";
import { toIsoDate } from "@web/lib/appointments/calendar-time";
import { LabOrdersDone } from "@web/pages/labs/lab-orders-done";
import { LabOrdersPage } from "@web/pages/labs/lab-orders-page";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";
import { choose } from "@test/select";

const DAY = 86_400_000;
const inDays = (days: number): string => new Date(Date.now() + days * DAY).toISOString();

const order = (
  id: string,
  status: LabOrderStatus,
  overrides: Partial<LabOrderRow> = {},
): LabOrderRow => ({
  id: `44444444-4444-4444-8444-44444444444${id}`,
  clinicId: "55555555-5555-4555-8555-555555555555",
  labId: "66666666-6666-4666-8666-666666666666",
  patientId: "77777777-7777-4777-8777-777777777777",
  doctorId: "88888888-8888-4888-8888-888888888888",
  performedProcedureId: null,
  workTypeId: null,
  material: null,
  shade: null,
  teeth: [26],
  instructions: null,
  price: "100.00",
  status,
  sentAt: null,
  expectedAt: null,
  receivedAt: null,
  fittedAt: null,
  returnReason: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
  patientName: `Patient ${id}`,
  patientFileNumber: `0000${id}`,
  doctorName: { ar: "د. سامر", en: "Dr Samer" },
  labName: "Elite Dental Lab",
  workTypeName: `Work ${id}`,
  isOverdue: false,
  ...overrides,
});

const ROWS = [
  order("1", LAB_ORDER_STATUS.DRAFT),
  order("2", LAB_ORDER_STATUS.SENT, { expectedAt: inDays(-2), isOverdue: true }),
  order("3", LAB_ORDER_STATUS.RETURNED, { expectedAt: inDays(3) }),
  order("4", LAB_ORDER_STATUS.RECEIVED, { receivedAt: "2026-09-20T09:00:00.000Z" }),
];

function render(ui: ReactElement, route = "/labs", extra: Record<string, MockResponse> = {}) {
  authTokens.clear();
  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /labs": { status: 200, body: paginated([]) },
    "GET /lab-orders": { status: 200, body: paginated(ROWS, { total: 4 }) },
    "GET /lab-orders/stages": {
      status: 200,
      body: { stages: { to_send: 1, at_lab: 2, ready: 0, to_fit: 1 }, overdue: 1 },
    },
    ...extra,
  });
  renderWithProviders(
    <>
      {ui}
      <Address />
    </>,
    { route },
  );
  return api;
}

function Address(): JSX.Element {
  const { search } = useLocation();
  return <output data-testid="address">{search}</output>;
}

const lastList = (api: ReturnType<typeof render>): URL =>
  new URL(
    api.calls.filter((call) => /\/lab-orders\?/.test(call.url)).at(-1)?.url ?? "/",
    "http://x",
  );

const row = (id: string): HTMLElement =>
  screen.getByTestId(`lab-orders-table-row-44444444-4444-4444-8444-44444444444${id}`);

describe("the lab work in progress", () => {
  it("asks for open work only, in one table that names each order's stage", async () => {
    const api = render(<LabOrdersPage />);

    await screen.findByText("Work 1");
    expect(lastList(api).searchParams.get("view")).toBe("open");
    expect(screen.getAllByRole("table")).toHaveLength(1);

    expect(row("1")).toHaveTextContent(ar.labs.orders.stages.to_send);
    expect(row("2")).toHaveTextContent(ar.labs.orders.stages.at_lab);
    expect(within(row("3")).getByTestId("lab-order-returned")).toBeInTheDocument();
    expect(row("4")).toHaveTextContent(ar.labs.orders.stages.to_fit);
  });

  it("counts each stage and the overdue from the server, not from the page", async () => {
    render(<LabOrdersPage />);

    expect(await screen.findByTestId("lab-orders-stages-at_lab-count")).toHaveTextContent("2");
    expect(screen.getByTestId("lab-orders-filter-overdue")).toHaveTextContent("1");
  });

  it("says how late or how soon, and that work in the clinic is received", async () => {
    render(<LabOrdersPage />);

    await screen.findByText("Work 2");
    expect(row("2")).toHaveTextContent(ar.labs.orders.when.late_two);
    expect(row("4")).toHaveTextContent(ar.labs.orders.when.received);
  });

  it("offers the next step on the row itself", async () => {
    render(<LabOrdersPage />);

    await screen.findByText("Work 1");
    expect(within(row("1")).getByRole("button", { name: ar.labs.actions.send })).toBeVisible();
  });

  it("narrows to one stage through the address, from the first page", async () => {
    const api = render(<LabOrdersPage />, "/labs?page=2");
    await screen.findByText("Work 1");

    await userEvent.click(screen.getByTestId("lab-orders-stages-at_lab"));

    await waitFor(() => expect(lastList(api).searchParams.get("stage")).toBe("at_lab"));
    expect(lastList(api).searchParams.get("page")).toBe("1");
  });

  it("sorts the whole list on the server, across every stage", async () => {
    const api = render(<LabOrdersPage />);
    await screen.findByText("Work 1");
    expect(lastList(api).searchParams.get("sort")).toBeNull();

    await choose(screen.getByTestId("lab-orders-sort"), ar.labs.orders.sort.patientAsc);

    await waitFor(() => expect(lastList(api).searchParams.get("sort")).toBe("patient"));
    expect(lastList(api).searchParams.get("dir")).toBe("asc");
    expect(lastList(api).searchParams.get("stage")).toBeNull();
  });
});

describe("an order's drawer", () => {
  it("opens from its row and puts the order in the address", async () => {
    const opened = ROWS[1]!;
    render(<LabOrdersPage />, "/labs", {
      [`GET /lab-orders/${opened.id}`]: { status: 200, body: opened },
    });

    await userEvent.click(await screen.findByText("Work 2"));

    expect(await screen.findByTestId("lab-order-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("address")).toHaveTextContent(`order=${opened.id}`);
  });

  it("opens from the address alone, for an order the list does not hold", async () => {
    const elsewhere = order("9", LAB_ORDER_STATUS.FITTED, { workTypeName: "Night guard" });
    const api = render(<LabOrdersPage />, `/labs?order=${elsewhere.id}`, {
      [`GET /lab-orders/${elsewhere.id}`]: { status: 200, body: elsewhere },
    });

    const drawer = await screen.findByTestId("lab-order-drawer");
    expect(drawer).toHaveTextContent("Night guard");
    expect(api.calls.some((call) => call.url.endsWith(`/lab-orders/${elsewhere.id}`))).toBe(true);
  });
});

describe("the lab work in progress on a phone", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chooses the stage from one field with the counts in it, and keeps the total", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const api = render(<LabOrdersPage />);

    const field = await screen.findByTestId("lab-orders-stage-select");
    expect(screen.queryByTestId("lab-orders-stages")).toBeNull();
    expect(await screen.findByTestId("lab-orders-count")).toBeInTheDocument();

    await choose(field, `${ar.labs.orders.stages.at_lab} (2)`);

    await waitFor(() => expect(lastList(api).searchParams.get("stage")).toBe("at_lab"));
  });
});

describe("the finished lab orders", () => {
  it("asks for the last three months of finished work by default", async () => {
    const api = render(<LabOrdersDone />, "/labs?tab=done");

    await screen.findByTestId("lab-orders-done-table");
    const url = lastList(api);

    expect(url.searchParams.get("view")).toBe("done");
    expect(toIsoDate(new Date(url.searchParams.get("finishedFrom") ?? ""))).toBe(
      toIsoDate(subMonths(new Date(), 3)),
    );
  });

  it("drops the window when the address asks for all of it", async () => {
    const api = render(<LabOrdersDone />, "/labs?tab=done&from=&to=");

    await screen.findByTestId("lab-orders-done-table");
    expect(lastList(api).searchParams.get("finishedFrom")).toBeNull();
  });
});
