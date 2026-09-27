import { LAB_ORDER_STATUS, USER_ROLE, type LabOrderRow } from "@clinic/shared";
import { screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { LabOrdersPage } from "@web/features/labs/lab-orders-page";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

// The widest card line is two badges and a step; on the narrowest phone it has to wrap, never
// squeeze a button or run past the card.
const RETURNED: LabOrderRow = {
  id: "44444444-4444-4444-8444-444444444441",
  clinicId: "55555555-5555-4555-8555-555555555555",
  labId: "66666666-6666-4666-8666-666666666666",
  patientId: "77777777-7777-4777-8777-777777777777",
  doctorId: "88888888-8888-4888-8888-888888888888",
  performedProcedureId: null,
  workTypeId: null,
  material: null,
  shade: null,
  teeth: [35],
  instructions: null,
  price: "100.00",
  status: LAB_ORDER_STATUS.RETURNED,
  sentAt: null,
  expectedAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
  receivedAt: null,
  fittedAt: null,
  returnReason: "Shade",
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
  patientName: "مصعب ماهر المصري",
  patientFileNumber: "00055",
  doctorName: { ar: "د. سامر", en: "Dr Samer" },
  labName: "Palestine Prosthetics Lab",
  workTypeName: "3-unit bridge",
  isOverdue: false,
};

async function renderList(): Promise<void> {
  authTokens.clear();
  mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /labs": { status: 200, body: paginated([]) },
    "GET /lab-orders": { status: 200, body: paginated([RETURNED]) },
    "GET /lab-orders/stages": {
      status: 200,
      body: { stages: { to_send: 0, at_lab: 1, ready: 0, to_fit: 0 }, overdue: 0 },
    },
  });
  // The page's own 16px gutter on each side, as the app layout draws it.
  renderWithProviders(
    <div className="px-4">
      <LabOrdersPage />
    </div>,
    { route: "/labs" },
  );
}

describe("a lab order card on the narrowest phone", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it("keeps every part inside the card, and the step button whole", async () => {
    await page.viewport(320, 800);
    await renderList();

    const step = await screen.findByTestId("lab-order-step-send");
    const card = step.closest("[data-part='table-card']");

    if (!(card instanceof HTMLElement)) {
      throw new Error("the order did not render as a card");
    }

    const bounds = card.getBoundingClientRect();

    for (const part of card.querySelectorAll("span, bdi, button, dd")) {
      const box = part.getBoundingClientRect();

      if (box.width === 0) {
        continue;
      }

      expect(box.left).toBeGreaterThanOrEqual(bounds.left - 0.5);
      expect(box.right).toBeLessThanOrEqual(bounds.right + 0.5);
    }

    expect(step.scrollWidth).toBeLessThanOrEqual(step.clientWidth);
  });
});

// Two fields side by side need a phone of at least `xs`; below it each takes the full width.
describe("the lab and sort fields on a phone", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  const fields = async (): Promise<[DOMRect, DOMRect]> => {
    await renderList();
    const sort = await screen.findByTestId("lab-orders-sort");

    return [
      screen.getByTestId("lab-orders-filter-lab").getBoundingClientRect(),
      sort.getBoundingClientRect(),
    ];
  };

  it("stacks them below 420px", async () => {
    await page.viewport(400, 800);
    const [lab, sort] = await fields();

    expect(sort.top).toBeGreaterThan(lab.bottom);
    expect(sort.width).toBe(lab.width);
  });

  it("sets them side by side from 420px", async () => {
    await page.viewport(440, 800);
    const [lab, sort] = await fields();

    expect(sort.top).toBe(lab.top);
  });
});
