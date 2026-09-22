import {
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_RISK_TIER,
  AI_STREAM_EVENT,
  USER_ROLE,
  type AiProposal,
} from "@clinic/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionCard } from "@web/features/assistant/action-card";
import ar from "@web/i18n/locales/ar.json";
import { authTokens } from "@web/lib/auth-tokens";
import { makeClinic, makeProfile, PATIENT_ID } from "@test/helpers/fixtures";
import { mockApi, renderWithProviders, type MockResponse } from "@test/helpers/render";

const PROPOSAL_ID = "5b1d2f2e-4444-4444-8444-444444444444";
const PHRASE = "تأكيد تسجيل الدفعة";

function proposal(overrides: Partial<AiProposal> = {}): AiProposal {
  return {
    id: PROPOSAL_ID,
    kind: AI_PROPOSAL_KIND.PAYMENT_CREATE,
    status: AI_PROPOSAL_STATUS.DRAFT,
    trigger: AI_OUTBOUND_TRIGGER.COMMAND,
    target: null,
    intent: null,
    conversationId: null,
    createdBy: null,
    recipients: [],
    expiresAt: "2099-01-01T10:15:00.000Z",
    createdAt: "2099-01-01T10:00:00.000Z",
    sentAt: null,
    sentCount: 0,
    failedCount: 0,
    tier: AI_RISK_TIER.TYPED,
    typedPhrase: PHRASE,
    summary: {
      patient: { id: PATIENT_ID, fullName: "سمير خليل", fileNumber: "1042" },
      amount: "600.00",
      method: "cash",
    },
    result: null,
    error: null,
    ...overrides,
  };
}

function render(initial: AiProposal, handlers: Record<string, MockResponse> = {}) {
  authTokens.clear();

  const api = mockApi({
    "POST /auth/refresh": { status: 200, body: { accessToken: "access", expiresIn: 900 } },
    "GET /me": { status: 200, body: makeProfile({ role: USER_ROLE.RECEPTIONIST }) },
    "GET /clinic": { status: 200, body: makeClinic() },
    [`GET /ai/actions/${PROPOSAL_ID}`]: { status: 200, body: initial },
    ...handlers,
  });

  renderWithProviders(<ActionCard id={PROPOSAL_ID} initial={initial} />);

  return api;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("An action's confirmation card", () => {
  it("keeps confirm disabled until the exact phrase is typed, then sends it", async () => {
    const api = render(proposal(), {
      [`POST /ai/proposals/${PROPOSAL_ID}/confirm`]: {
        status: 200,
        body: {
          type: AI_STREAM_EVENT.PROPOSAL_STATUS,
          proposalId: PROPOSAL_ID,
          status: AI_PROPOSAL_STATUS.DONE,
          sentCount: 0,
          failedCount: 0,
          result: { entity: "payment", id: PROPOSAL_ID, patientId: PATIENT_ID },
          error: null,
        },
      },
    });

    const confirm = screen.getByRole("button", { name: ar.assistant.action.confirm });
    const field = screen.getByLabelText(
      ar.assistant.action.typeToConfirm.replace("{{phrase}}", PHRASE),
    );

    expect(confirm).toBeDisabled();

    await userEvent.type(field, "تأكيد");
    expect(confirm).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, PHRASE);
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);

    await waitFor(() =>
      expect(api.calls).toContainEqual(
        expect.objectContaining({
          method: "POST",
          url: `/api/ai/proposals/${PROPOSAL_ID}/confirm`,
          body: { typedPhrase: PHRASE },
        }),
      ),
    );
    expect(await screen.findByText(ar.assistant.action.done.payment_create)).toBeInTheDocument();
  });

  it("asks for no phrase at the confirm tier", () => {
    render(proposal({ tier: AI_RISK_TIER.CONFIRM, typedPhrase: null }));

    expect(screen.getByRole("button", { name: ar.assistant.action.confirm })).toBeEnabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("links a finished booking to the day it is on", () => {
    render(
      proposal({
        kind: AI_PROPOSAL_KIND.APPOINTMENT_CREATE,
        status: AI_PROPOSAL_STATUS.DONE,
        tier: AI_RISK_TIER.CONFIRM,
        typedPhrase: null,
        summary: { startsAt: "2099-03-02T08:00:00.000Z" },
        result: { entity: "appointment", id: PROPOSAL_ID, patientId: PATIENT_ID },
      }),
    );

    expect(screen.getByRole("link", { name: ar.assistant.action.open })).toHaveAttribute(
      "href",
      "/appointments?view=day&date=2099-03-02",
    );
  });

  it("links a new patient to their file", () => {
    render(
      proposal({
        kind: AI_PROPOSAL_KIND.PATIENT_CREATE,
        status: AI_PROPOSAL_STATUS.DONE,
        summary: null,
        result: { entity: "patient", id: PATIENT_ID, patientId: PATIENT_ID },
      }),
    );

    expect(screen.getByRole("link", { name: ar.assistant.action.open })).toHaveAttribute(
      "href",
      `/patients/${PATIENT_ID}`,
    );
  });
});
