import {
  AI_ERROR_CODE,
  AI_STREAM_EVENT,
  aiStreamEventSchema,
  type AiErrorCode,
  type AiStreamEvent,
  type AiToolName,
} from "@clinic/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { assistantApi } from "@web/features/assistant/api";
import { isAiErrorCode } from "@web/features/assistant/messages";
import { ApiError } from "@web/lib/api-error";

export interface LiveTurn {
  /** Echoed back immediately: the question is on screen before the server has answered it. */
  readonly question: string;
  readonly answer: string;
  /** What the agent is running right now, or null once it has started writing. */
  readonly tool: AiToolName | null;
  readonly error: AiErrorCode | null;
  readonly streaming: boolean;
}

export interface AssistantStream {
  readonly turn: LiveTurn | null;
  readonly streaming: boolean;
  send: (message: string) => void;
  stop: () => void;
  retry: () => void;
}

export interface AssistantStreamOptions {
  readonly conversationId: string | undefined;
  /** The first frame of a new conversation carries its id; the page puts it in the address. */
  readonly onConversationStarted: (id: string) => void;
  /** Ran before the live turn is dropped, so the stored messages are in hand when it goes. */
  readonly onFinished: (conversationId: string) => Promise<unknown> | unknown;
}

const FRAME_SEPARATOR = "\n\n";
const DATA_PREFIX = "data: ";

/**
 * Splits whatever has arrived into whole frames, keeping the partial tail for the next read — a
 * chunk boundary falls mid-frame often enough that ignoring it drops tokens.
 */
export function parseFrames(buffer: string): { events: AiStreamEvent[]; rest: string } {
  const pieces = buffer.split(FRAME_SEPARATOR);
  const rest = pieces.pop() ?? "";
  const events: AiStreamEvent[] = [];

  for (const piece of pieces) {
    const line = piece.trim();

    if (!line.startsWith(DATA_PREFIX)) {
      continue;
    }

    try {
      const parsed = aiStreamEventSchema.safeParse(JSON.parse(line.slice(DATA_PREFIX.length)));

      // A frame this build does not know is skipped rather than fatal: an older page against a
      // newer API keeps streaming the parts it understands.
      if (parsed.success) {
        events.push(parsed.data);
      }
    } catch {
      continue;
    }
  }

  return { events, rest };
}

/** The code behind a failure that never reached the stream — a 429 carries it as the message. */
function codeFromError(error: unknown): AiErrorCode {
  if (error instanceof ApiError) {
    const message = (error.payload as { message?: unknown } | undefined)?.message;

    if (isAiErrorCode(message)) {
      return message;
    }
  }

  return AI_ERROR_CODE.FAILED;
}

const idle = (question: string): LiveTurn => ({
  question,
  answer: "",
  tool: null,
  error: null,
  streaming: true,
});

// One turn at a time, held here rather than in the query cache: it is not the server's state yet.
// When it becomes the server's state the stored messages replace it, which is why the turn is only
// dropped once they have been read back.
export function useAssistantStream({
  conversationId,
  onConversationStarted,
  onFinished,
}: AssistantStreamOptions): AssistantStream {
  const [turn, setTurn] = useState<LiveTurn | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const lastQuestion = useRef<string>("");

  // The conversation in hand may be the one this turn just created, so the id is tracked here
  // rather than read from a prop that has not re-rendered yet.
  const activeConversation = useRef<string | undefined>(conversationId);
  activeConversation.current = conversationId;

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

  // Opening another conversation drops whatever the last turn left behind — an error bubble and
  // its retry belong to the thread they failed in. A turn still running keeps its own: the id
  // changed because that turn just created the conversation.
  useEffect(() => {
    if (inFlight.current === null) {
      setTurn(null);
    }
  }, [conversationId]);

  const run = useCallback(
    async (message: string): Promise<void> => {
      inFlight.current?.abort();

      const controller = new AbortController();
      inFlight.current = controller;
      lastQuestion.current = message;
      setTurn(idle(message));

      let opened = activeConversation.current;

      try {
        const response = await assistantApi.chat(
          { message, ...(opened !== undefined && { conversationId: opened }) },
          controller.signal,
        );

        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error("The assistant answered with no body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let failed: AiErrorCode | null = null;

        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const { events, rest } = parseFrames(buffer);
          buffer = rest;

          for (const event of events) {
            switch (event.type) {
              case AI_STREAM_EVENT.CONVERSATION:
                opened = event.conversationId;
                activeConversation.current = event.conversationId;
                onConversationStarted(event.conversationId);
                break;

              case AI_STREAM_EVENT.TOOL:
                setTurn((current) => (current ? { ...current, tool: event.tool } : current));
                break;

              case AI_STREAM_EVENT.DELTA:
                setTurn((current) =>
                  current
                    ? { ...current, answer: current.answer + event.text, tool: null }
                    : current,
                );
                break;

              case AI_STREAM_EVENT.ERROR:
                failed = event.code;
                break;

              case AI_STREAM_EVENT.DONE:
                break;
            }
          }
        }

        if (failed) {
          setTurn((current) =>
            current ? { ...current, tool: null, error: failed, streaming: false } : current,
          );

          return;
        }

        // The answer is the server's now. Read the stored messages back before the live turn goes,
        // or the thread blinks empty between the two.
        if (opened !== undefined) {
          await onFinished(opened);
        }

        setTurn(null);
      } catch (error) {
        if (controller.signal.aborted) {
          // Stopped on purpose. The question was recorded; the half-written answer was not, so the
          // stored thread is what the reader is left with.
          if (opened !== undefined) {
            await onFinished(opened);
          }

          setTurn(null);

          return;
        }

        const code = codeFromError(error);

        setTurn((current) =>
          current ? { ...current, tool: null, error: code, streaming: false } : current,
        );
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
        }
      }
    },
    [onConversationStarted, onFinished],
  );

  const send = useCallback(
    (message: string) => {
      void run(message);
    },
    [run],
  );

  const stop = useCallback(() => {
    inFlight.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (lastQuestion.current) {
      void run(lastQuestion.current);
    }
  }, [run]);

  return { turn, streaming: turn?.streaming ?? false, send, stop, retry };
}
