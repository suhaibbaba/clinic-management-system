import {
  AI_ERROR_CODE,
  AI_OUTBOUND_TARGET,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_STREAM_EVENT,
  AI_TOOL,
  type AiProposal,
  type AiStreamEvent,
} from "@clinic/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@web/i18n";
import { errorMessageKey } from "@web/features/assistant/messages";
import {
  AI_STREAM_IDLE_MS,
  parseFrames,
  useAssistantStream,
  type AssistantStreamOptions,
} from "@web/features/assistant/use-assistant-stream";
import { authTokens } from "@web/lib/auth-tokens";

const CONVERSATION = "7f1d2f2e-1111-4111-8111-111111111111";

const frame = (event: AiStreamEvent): string => `data: ${JSON.stringify(event)}\n\n`;

/** A body that hands over one piece at a time, the way a real stream arrives. */
function streamOf(pieces: readonly string[], close = true): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) {
        controller.enqueue(encoder.encode(piece));
      }

      // Left open where the test is about a turn still in flight: a closed body is a finished
      // turn, and the live one is dropped the moment it finishes.
      if (close) {
        controller.close();
      }
    },
  });
}

function mockChat(pieces: readonly string[], close = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(streamOf(pieces, close), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    ),
  );
}

function harness(overrides: Partial<AssistantStreamOptions> = {}) {
  const onConversationStarted = vi.fn();
  const onFinished = vi.fn();

  const rendered = renderHook(() =>
    useAssistantStream({
      conversationId: undefined,
      onConversationStarted,
      onFinished,
      ...overrides,
    }),
  );

  return { ...rendered, onConversationStarted, onFinished };
}

afterEach(() => {
  vi.unstubAllGlobals();
  authTokens.clear();
});

describe("Reading the assistant's stream", () => {
  it("keeps a frame that arrived in two pieces", () => {
    const whole = frame({ type: AI_STREAM_EVENT.DELTA, text: "مرحبا" });
    const cut = Math.floor(whole.length / 2);

    const first = parseFrames(whole.slice(0, cut));
    expect(first.events).toEqual([]);

    const second = parseFrames(first.rest + whole.slice(cut));
    expect(second.events).toEqual([{ type: AI_STREAM_EVENT.DELTA, text: "مرحبا" }]);
    expect(second.rest).toBe("");
  });

  // An older page against a newer API: the frames it knows still stream.
  it("skips a frame it does not understand rather than failing the turn", () => {
    const { events } = parseFrames(
      `data: {"type":"invented","payload":1}\n\n${frame({ type: AI_STREAM_EVENT.DELTA, text: "ب" })}`,
    );

    expect(events).toEqual([{ type: AI_STREAM_EVENT.DELTA, text: "ب" }]);
  });
});

describe("A turn", () => {
  it("shows the question at once, then appends the answer as it arrives", async () => {
    mockChat([
      frame({ type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION }),
      frame({ type: AI_STREAM_EVENT.DELTA, text: "عندك " }),
      frame({ type: AI_STREAM_EVENT.DELTA, text: "٣ مواعيد" }),
      frame({ type: AI_STREAM_EVENT.DONE, messageId: CONVERSATION }),
    ]);

    const { result, onConversationStarted, onFinished } = harness();

    act(() => {
      result.current.send("كم موعد اليوم؟");
    });

    expect(result.current.turn?.question).toBe("كم موعد اليوم؟");
    expect(result.current.streaming).toBe(true);

    // The live turn is dropped only once the stored messages have been read back.
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(CONVERSATION));
    await waitFor(() => expect(result.current.turn).toBeNull());

    expect(onConversationStarted).toHaveBeenCalledWith(CONVERSATION);
  });

  it("names the tool the agent is running, and drops it once words arrive", async () => {
    mockChat(
      [
        frame({ type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION }),
        frame({ type: AI_STREAM_EVENT.TOOL, tool: AI_TOOL.GET_APPOINTMENTS }),
      ],
      false,
    );

    const { result } = harness();

    act(() => {
      result.current.send("مواعيد بكرا");
    });

    await waitFor(() => expect(result.current.turn?.tool).toBe(AI_TOOL.GET_APPOINTMENTS));
    expect(result.current.turn?.answer).toBe("");
  });

  it("stops on the error frame's code and leaves the question on screen to retry", async () => {
    mockChat([
      frame({ type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION }),
      frame({ type: AI_STREAM_EVENT.ERROR, code: AI_ERROR_CODE.PROVIDER_UNAVAILABLE }),
    ]);

    const { result, onFinished } = harness();

    act(() => {
      result.current.send("الوضع المالي");
    });

    await waitFor(() =>
      expect(result.current.turn?.error).toBe(AI_ERROR_CODE.PROVIDER_UNAVAILABLE),
    );

    expect(result.current.turn?.question).toBe("الوضع المالي");
    expect(result.current.streaming).toBe(false);
    expect(onFinished).not.toHaveBeenCalled();
  });

  // The budget and the hourly limit are refused before the stream exists, so they arrive as a 429
  // carrying the code rather than as a frame.
  it("reads the limit code off a refusal that never became a stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ statusCode: 429, message: "budget_exhausted" }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    const { result } = harness();

    act(() => {
      result.current.send("ملخص اليوم");
    });

    await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.BUDGET_EXHAUSTED));
  });

  it("falls back to a general failure when the refusal carries no code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ statusCode: 500 }), { status: 500 })),
      ),
    );

    const { result } = harness();

    act(() => {
      result.current.send("ملخص اليوم");
    });

    await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.FAILED));
  });

  it("sends the question again on retry", async () => {
    mockChat([frame({ type: AI_STREAM_EVENT.ERROR, code: AI_ERROR_CODE.FAILED })]);

    const { result } = harness({ conversationId: CONVERSATION });

    act(() => {
      result.current.send("مين ما راجع؟");
    });

    await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.FAILED));

    mockChat([
      frame({ type: AI_STREAM_EVENT.DELTA, text: "تمام" }),
      frame({ type: AI_STREAM_EVENT.DONE, messageId: CONVERSATION }),
    ]);

    act(() => {
      result.current.retry();
    });

    expect(result.current.turn?.question).toBe("مين ما راجع؟");
    await waitFor(() => expect(result.current.turn).toBeNull());
  });
});

describe("A turn that drafts a message", () => {
  const proposal: AiProposal = {
    id: "9a1d2f2e-2222-4222-8222-222222222222",
    kind: AI_PROPOSAL_KIND.MESSAGE,
    status: AI_PROPOSAL_STATUS.DRAFT,
    trigger: AI_OUTBOUND_TRIGGER.COMMAND,
    target: AI_OUTBOUND_TARGET.UNPAID_INVOICES,
    intent: "ذكّرهم بالرصيد",
    conversationId: CONVERSATION,
    createdBy: null,
    recipients: [
      { patientId: "9a1d2f2e-3333-4333-8333-333333333333", name: "سمير", text: "مرحباً سمير" },
    ],
    expiresAt: "2026-09-23T10:15:00.000Z",
    createdAt: "2026-09-23T10:00:00.000Z",
    sentAt: null,
    sentCount: 0,
    failedCount: 0,
    tier: null,
    typedPhrase: null,
    summary: null,
    result: null,
    error: null,
  };

  it("holds the proposal for its card and hands it to the page's cache", async () => {
    mockChat(
      [
        frame({ type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION }),
        frame({ type: AI_STREAM_EVENT.TOOL, tool: AI_TOOL.DRAFT_BULK_MESSAGE }),
        frame({ type: AI_STREAM_EVENT.PROPOSAL, proposal }),
      ],
      false,
    );

    const onProposal = vi.fn();
    const { result } = harness({ onProposal });

    act(() => {
      result.current.send("ابعت تذكير للي عليهم رصيد");
    });

    await waitFor(() => expect(result.current.turn?.proposals).toEqual([proposal]));
    expect(onProposal).toHaveBeenCalledWith(proposal);
    expect(result.current.turn?.tool).toBeNull();
  });

  it("passes a status frame on, the way the card's buttons do", async () => {
    const event = {
      type: AI_STREAM_EVENT.PROPOSAL_STATUS,
      proposalId: proposal.id,
      status: AI_PROPOSAL_STATUS.SENT,
      sentCount: 1,
      failedCount: 0,
    } as const;

    mockChat([
      frame({ type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION }),
      frame(event),
      frame({ type: AI_STREAM_EVENT.DONE, messageId: CONVERSATION }),
    ]);

    const onProposalStatus = vi.fn();
    const { result } = harness({ onProposalStatus });

    act(() => {
      result.current.send("شو صار بالرسالة؟");
    });

    await waitFor(() => expect(onProposalStatus).toHaveBeenCalledWith(event));
  });
});

// A turn ends in `done`, `error` or the user's own stop. Anything else is a failure the user sees.
describe("A turn that never finished", () => {
  it("reports a stream that closed without a terminal frame, and keeps what was written", async () => {
    mockChat([
      frame({ type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION }),
      frame({ type: AI_STREAM_EVENT.DELTA, text: "عندك ٣ مواعيد، أولها" }),
    ]);

    const { result, onFinished } = harness();

    act(() => {
      result.current.send("مواعيد اليوم");
    });

    await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.CONNECTION_LOST));
    expect(result.current.turn?.answer).toBe("عندك ٣ مواعيد، أولها");
    expect(result.current.streaming).toBe(false);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("gives up on a stream that goes quiet for three missed heartbeats", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      mockChat([frame({ type: AI_STREAM_EVENT.DELTA, text: "لحظة" })], false);

      const { result } = harness({ conversationId: CONVERSATION });

      act(() => {
        result.current.send("الوضع المالي");
      });

      await waitFor(() => expect(result.current.turn?.answer).toBe("لحظة"));
      expect(result.current.turn?.error).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(AI_STREAM_IDLE_MS + 1);
      });

      await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.CONNECTION_LOST));
      expect(result.current.turn?.answer).toBe("لحظة");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not mistake the user's own stop for a lost connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const { result, onFinished } = harness({ conversationId: CONVERSATION });

    act(() => {
      result.current.send("ملخص اليوم");
    });

    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(result.current.turn).toBeNull());
    expect(onFinished).toHaveBeenCalledWith(CONVERSATION);
  });

  it("says there is no connection rather than trying, when the browser is offline", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    try {
      const { result } = harness();

      act(() => {
        result.current.send("ملخص اليوم");
      });

      await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.OFFLINE));
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("stops at once when the network drops mid-answer", async () => {
    mockChat([frame({ type: AI_STREAM_EVENT.DELTA, text: "أول" })], false);

    const { result } = harness({ conversationId: CONVERSATION });

    act(() => {
      result.current.send("مواعيد بكرا");
    });

    await waitFor(() => expect(result.current.turn?.answer).toBe("أول"));

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => expect(result.current.turn?.error).toBe(AI_ERROR_CODE.OFFLINE));
  });
});

describe("The words for a failure", () => {
  it.each([
    [AI_ERROR_CODE.CONNECTION_LOST, "انقطع الاتصال قبل اكتمال الرد"],
    [AI_ERROR_CODE.OFFLINE, "لا يوجد اتصال بالإنترنت"],
    [AI_ERROR_CODE.PROVIDER_REJECTED, "مفتاح الخدمة مرفوض — راجع الإعدادات"],
    [AI_ERROR_CODE.PROVIDER_QUOTA, "تم تجاوز حصة الخدمة"],
  ] as const)("reads %s in Arabic", async (code, arabic) => {
    await i18n.changeLanguage("ar");

    expect(i18n.t(errorMessageKey(code))).toBe(arabic);
  });
});
