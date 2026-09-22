import {
  AI_MESSAGE_ROLE,
  AI_TOOL,
  USER_ROLE,
  type AiMessage,
  type AiView,
  type Clinic,
} from "@clinic/shared";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@web/app/router";
import { AssistantView } from "@web/features/assistant/assistant-view";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { resetClinicTimeZone, setClinicTimeZone } from "@web/lib/clinic-zone";
import { makeClinic, makeProfile, paginated } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

const CONVERSATION = "7f1d2f2e-1111-4111-8111-111111111111";
const PATIENT = "7f1d2f2e-2222-4222-8222-222222222222";

const appointments = (overrides: Partial<Extract<AiView, { type: "table" }>> = {}): AiView => ({
  type: "table",
  columns: [
    { key: "date", label: "assistant.view.columns.date", kind: "date" },
    { key: "time", label: "assistant.view.columns.time", kind: "time" },
    { key: "patient", label: "assistant.view.columns.patient", kind: "link" },
    { key: "balance", label: "assistant.view.columns.balance", kind: "money" },
  ],
  rows: [
    {
      id: "a1",
      // 21:30 UTC is half past midnight the next day in the clinic's own zone.
      date: "2026-09-22T21:30:00.000Z",
      time: "2026-09-22T21:30:00.000Z",
      patient: { href: `/patients/${PATIENT}`, label: "سمير خليل" },
      balance: "1250.00",
    },
  ],
  truncated: false,
  ...overrides,
});

function handlers(overrides: Record<string, MockResponse> = {}): Record<string, MockResponse> {
  return {
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.RECEPTIONIST }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    ...overrides,
  };
}

beforeEach(() => {
  authTokens.clear();
  setClinicTimeZone({ settings: { timezone: "Asia/Hebron" } } as unknown as Clinic);
});

afterEach(() => {
  resetClinicTimeZone();
  vi.unstubAllGlobals();
});

describe("A tool's table in the thread", () => {
  it("formats money with the clinic's symbol and no decimals, and dates in its own zone", async () => {
    mockApi(handlers());
    renderWithProviders(<AssistantView view={appointments()} data-testid="view" />);

    const row = await screen.findByTestId("view-table-row-a1");

    expect(within(row).getByTestId("view-table-row-a1-date")).toHaveTextContent("23/09/2026");
    expect(within(row).getByTestId("view-table-row-a1-time")).toHaveTextContent("00:30");

    const money = within(row).getByTestId("view-table-row-a1-balance");

    expect(money).toHaveTextContent("$");
    expect(money).toHaveTextContent("1250");
    expect(money).not.toHaveTextContent(".00");
    expect(await within(row).findByRole("link", { name: "سمير خليل" })).toHaveAttribute(
      "href",
      `/patients/${PATIENT}`,
    );
  });

  it("says there is nothing in one quiet line rather than drawing an empty table", () => {
    mockApi(handlers());
    renderWithProviders(<AssistantView view={appointments({ rows: [] })} data-testid="view" />);

    expect(screen.getByText(ar.assistant.view.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says how much of a longer list it shows, and links to the whole of it", async () => {
    mockApi(handlers());
    renderWithProviders(
      <AssistantView
        view={appointments({
          truncated: true,
          total: 213,
          href: "/appointments?view=day&date=2026-09-23",
        })}
        data-testid="view"
      />,
    );

    expect(screen.getByText("عرض 1 من 213")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: ar.assistant.view.openFull })).toHaveAttribute(
      "href",
      "/appointments?view=day&date=2026-09-23",
    );
  });

  it("draws counts as tiles", () => {
    mockApi(handlers());
    renderWithProviders(
      <AssistantView
        view={{
          type: "stats",
          tiles: [
            { label: "assistant.view.stats.total", value: "12", kind: "number" },
            { label: "assistant.view.stats.cancelled", value: "3", kind: "number" },
          ],
        }}
      />,
    );

    expect(screen.getByText(ar.assistant.view.stats.total)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("A reloaded conversation", () => {
  it("redraws the table where the tool ran", async () => {
    const messages: AiMessage[] = [
      {
        id: "7f1d2f2e-3333-4333-8333-333333333333",
        role: AI_MESSAGE_ROLE.USER,
        content: "مواعيد بكرا",
        toolName: null,
        proposalId: null,
        view: null,
        createdAt: "2026-09-22T10:00:00.000Z",
      },
      {
        id: "7f1d2f2e-4444-4444-8444-444444444444",
        role: AI_MESSAGE_ROLE.TOOL,
        content: "",
        toolName: AI_TOOL.GET_APPOINTMENTS,
        proposalId: null,
        view: appointments(),
        createdAt: "2026-09-22T10:00:01.000Z",
      },
    ];

    mockApi(
      handlers({
        "GET /ai/conversations": { status: 200, body: paginated([]) },
        [`GET /ai/conversations/${CONVERSATION}`]: { status: 200, body: messages },
      }),
    );
    renderWithProviders(<AppRoutes />, { route: `/assistant/${CONVERSATION}` });

    expect(
      await screen.findByTestId("assistant-view-7f1d2f2e-4444-4444-8444-444444444444"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "سمير خليل" })).toBeInTheDocument();
  });
});
