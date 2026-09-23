import { addDays, instantFromLocal, localDate, USER_ROLE, type Clinic } from "@clinic/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@web/app/router";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { resetClinicTimeZone, setClinicTimeZone } from "@web/lib/clinic-zone";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders } from "@test/helpers/render";

const ZONE = "Asia/Hebron";

const conversation = (id: string, title: string, updatedAt: Date) => ({
  id,
  title,
  createdAt: updatedAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
});

function render() {
  const today = localDate(new Date(), ZONE);
  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": {
      status: 200,
      body: makeProfile({ role: USER_ROLE.ADMIN, name: { ar: "سائد أبو عبيد", en: "Saed" } }),
    },
    "GET /clinic": { status: 200, body: makeClinic() },
    "GET /ai/proposals": { status: 200, body: paginated([]) },
    "GET /ai/conversations": {
      status: 200,
      body: paginated([
        conversation("7f1d2f2e-1111-4111-8111-000000000001", "مواعيد بكرا", new Date()),
        conversation(
          "7f1d2f2e-1111-4111-8111-000000000002",
          "ملخص أمس",
          instantFromLocal(addDays(today, -1), 12 * 60, ZONE),
        ),
        conversation(
          "7f1d2f2e-1111-4111-8111-000000000003",
          "قديمة",
          instantFromLocal(addDays(today, -4), 12 * 60, ZONE),
        ),
      ]),
    },
  });

  renderWithProviders(<AppRoutes />, { route: "/assistant" });

  return api;
}

beforeEach(() => {
  authTokens.clear();
  setClinicTimeZone({ settings: { timezone: ZONE } } as unknown as Clinic);
});

afterEach(() => {
  resetClinicTimeZone();
  vi.unstubAllGlobals();
});

describe("The assistant's empty conversation", () => {
  it("greets the signed-in user by name", async () => {
    render();

    expect(
      await screen.findByRole("heading", {
        name: ar.assistant.emptyTitleNamed.replace("{{name}}", "سائد أبو عبيد"),
      }),
    ).toBeInTheDocument();
  });

  it("asks a topic's own question when its card is pressed", async () => {
    const api = render();

    await userEvent.click(await screen.findByTestId("assistant-topic-finance"));

    await waitFor(() =>
      expect(api.calls).toContainEqual(
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ message: ar.assistant.topics.finance.prompt }),
        }),
      ),
    );
  });

  it("carries the shell's top bar in the chat column, beside a full-height list", async () => {
    render();

    const chat = await screen.findByRole("region", { name: ar.nav.assistant });

    expect(within(chat).getByTestId("app-topbar")).toHaveAttribute("data-variant", "flat");
    expect(screen.getAllByTestId("app-topbar")).toHaveLength(1);
  });

  it("groups the conversations under the clinic's own days", async () => {
    render();

    const today = await screen.findByTestId("assistant-group-today");
    const yesterday = screen.getByTestId("assistant-group-yesterday");
    const earlier = screen.getByTestId("assistant-group-earlier");

    expect(within(today).getByRole("heading")).toHaveTextContent(ar.assistant.groups.today);
    expect(
      within(today)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["مواعيد بكرا"]);
    expect(within(yesterday).getByText("ملخص أمس")).toBeInTheDocument();
    expect(within(earlier).getByText("قديمة")).toBeInTheDocument();
  });
});
