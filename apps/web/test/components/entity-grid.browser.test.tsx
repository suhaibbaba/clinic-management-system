import { USER_ROLE, type LabSummary } from "@clinic/shared";
import { screen } from "@testing-library/react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { LabsPage } from "@web/features/labs/labs-page";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const LAB: LabSummary = {
  id: "84206a5e-e344-4a49-9062-c3d2e1d245b4",
  clinicId: "55555555-5555-4555-8555-555555555555",
  name: "Palestine Prosthetics Laboratory and Digital Dental Studio",
  phone: "+97092380022",
  address: "Nablus, Rafidia",
  contactPerson: "Mr. Haitham",
  notes: null,
  isActive: true,
  createdAt: "2026-09-27T17:13:04.372Z",
  updatedAt: "2026-09-27T17:13:04.372Z",
  balance: "5616.00",
  openOrders: 0,
};

function renderDirectory(): void {
  authTokens.clear();
  mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.ADMIN }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /labs": { status: 200, body: paginated([LAB]) },
  });
  renderWithProviders(
    <div data-testid="page" className="px-4">
      <LabsPage />
    </div>,
    { route: "/labs?tab=directory" },
  );
}

// On a phone the cards ran past the screen's edge, a gutter on one side only, and a long name was
// cut short beside its badge.
describe("a grid of cards on a phone", () => {
  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it("keeps every card inside the page's gutter", async () => {
    await page.viewport(375, 800);
    renderDirectory();

    const card = await screen.findByTestId(`lab-card-${LAB.id}`);
    const pageBox = screen.getByTestId("page");
    const edge =
      pageBox.getBoundingClientRect().right - parseFloat(getComputedStyle(pageBox).paddingRight);

    expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(edge + 0.5);
  });

  it("shows a long name whole, with its status under it", async () => {
    await page.viewport(375, 800);
    renderDirectory();

    const title = await screen.findByRole("button", { name: LAB.name });
    const status = screen.getByTestId(`lab-card-${LAB.id}-status`);

    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    expect(status.getBoundingClientRect().top).toBeGreaterThan(
      title.getBoundingClientRect().bottom,
    );
  });
});
