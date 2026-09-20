import { AI_ERROR_CODE, AI_STREAM_EVENT, AI_TOOL, type AiStreamEvent } from "@clinic/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
