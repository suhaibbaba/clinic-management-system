import {
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_RISK_TIER,
  AI_SCHEDULE_CONFLICT_CHOICE,
  AI_STREAM_EVENT,
  LAB_ORDER_STATUS,
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

  it("names the doctor's time off and the patients it cancels", () => {
    const appointmentId = "7c2e3f3a-5555-4555-8555-555555555555";

    render(
      proposal({
        kind: AI_PROPOSAL_KIND.TIME_OFF_CREATE,
        typedPhrase: "تأكيد إجازة الطبيب",
        summary: {
          doctor: { id: PATIENT_ID, name: { ar: "باسل حداد", en: "Basel Haddad" } },
          startsAt: "2099-01-05T07:00:00.000Z",
          endsAt: "2099-01-06T07:00:00.000Z",
          reason: "إجازة",
          onConflict: AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
          appointments: [
            {
              id: appointmentId,
              startsAt: "2099-01-05T08:00:00.000Z",
              patientName: "سمير خليل",
              patientFileNumber: "1042",
              doctorName: { ar: "باسل حداد", en: "Basel Haddad" },
            },
          ],
        },
      }),
    );

    expect(
      screen.getByRole("region", { name: ar.assistant.action.kinds.time_off_create }),
    ).toBeInTheDocument();
    expect(screen.getByText(ar.assistant.action.fields.period)).toBeInTheDocument();
    expect(
      screen.getByText(ar.assistant.action.onConflict.cancel_appointments),
    ).toBeInTheDocument();
    expect(screen.getByTestId(`action-appointment-${appointmentId}`)).toHaveTextContent(
      "سمير خليل",
    );
  });

  it("shows a lab order's move from its current status to the new one", () => {
    render(
      proposal({
        kind: AI_PROPOSAL_KIND.LAB_ORDER_STATUS,
        tier: AI_RISK_TIER.CONFIRM,
        typedPhrase: null,
        summary: {
          patient: { id: PATIENT_ID, fullName: "ليلى ناصر", fileNumber: "1043" },
          labOrder: {
            id: PROPOSAL_ID,
            labName: "مخبر النور",
            workTypeName: "تاج زيركون",
            status: LAB_ORDER_STATUS.DRAFT,
          },
          labStatus: LAB_ORDER_STATUS.SENT,
        },
      }),
    );

    expect(screen.getByText("مخبر النور")).toBeInTheDocument();
    expect(screen.getByText(ar.labs.status.draft)).toBeInTheDocument();
    expect(screen.getByText(ar.labs.status.sent)).toBeInTheDocument();
  });

  it("draws each changed weekday's hours before and after", () => {
    render(
      proposal({
        kind: AI_PROPOSAL_KIND.DOCTOR_SCHEDULE,
        tier: AI_RISK_TIER.CONFIRM,
        typedPhrase: null,
        summary: {
          doctor: { id: PATIENT_ID, name: { ar: "باسل حداد", en: "Basel Haddad" } },
          scheduleChanges: [{ weekday: 4, before: [{ start: "09:00", end: "17:00" }], after: [] }],
        },
      }),
    );

    const thursday = screen.getByTestId("action-schedule-4");

    expect(screen.getByText(ar.schedule.weekday["4"])).toBeInTheDocument();
    expect(thursday).toHaveTextContent("09:00–17:00");
    expect(thursday).toHaveTextContent(ar.assistant.action.fields.dayOff);
  });

  it("numbers a plan's steps and draws each the way its own card would", () => {
    render(
      proposal({
        kind: AI_PROPOSAL_KIND.PLAN,
        tier: AI_RISK_TIER.CONFIRM,
        typedPhrase: null,
        summary: {
          steps: [
            {
              kind: AI_PROPOSAL_KIND.EXTRA_HOURS_CREATE,
              summary: {
                doctor: { id: PATIENT_ID, name: { ar: "د. رشا", en: "Dr. Rasha" } },
                extraHours: { date: "2099-01-08", ranges: [{ start: "09:00", end: "17:00" }] },
              },
            },
            {
              kind: AI_PROPOSAL_KIND.TIME_OFF_CREATE,
              summary: {
                doctor: { id: PATIENT_ID, name: { ar: "د. باسل", en: "Dr. Basel" } },
                startsAt: "2099-01-07T22:00:00.000Z",
                endsAt: "2099-01-08T22:00:00.000Z",
              },
            },
          ],
        },
      }),
    );

    const first = screen.getByTestId("action-step-0");

    expect(first).toHaveTextContent(ar.assistant.action.step.replace("{{number}}", "1"));
    expect(first).toHaveTextContent(ar.assistant.action.kinds.extra_hours_create);
    expect(first).toHaveTextContent("09:00–17:00");
    expect(screen.getByTestId("action-step-1")).toHaveTextContent(
      ar.assistant.action.kinds.time_off_create,
    );
  });
});
