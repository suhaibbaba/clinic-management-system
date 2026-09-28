import {
  AI_ERROR_CODE,
  AI_STREAM_EVENT,
  aiStreamEventSchema,
  type AiErrorCode,
  type AiProposal,
  type AiProposalStatusEvent,
  type AiStreamEvent,
  type AiToolName,
  type AiView,
} from "@clinic/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { assistantApi } from "@web/api/assistant";
import { isAiErrorCode } from "@web/lib/assistant/messages";
import { ApiError } from "@web/lib/api-error";

export interface LiveTurn {
  readonly question: string;
  readonly answer: string;
  readonly tool: AiToolName | null;
  readonly error: AiErrorCode | null;
  readonly streaming: boolean;
  readonly proposals: readonly AiProposal[];
  readonly views: readonly LiveView[];
}

export interface LiveView {
  readonly toolCallId: string;
  readonly view: AiView;
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
  readonly onConversationStarted: (id: string) => void;
  readonly onFinished: (conversationId: string) => Promise<unknown> | unknown;
  readonly onProposal?: ((proposal: AiProposal) => void) | undefined;
  readonly onProposalStatus?: ((event: AiProposalStatusEvent) => void) | undefined;
}

export const AI_STREAM_IDLE_MS = 45_000;

const FRAME_SEPARATOR = "\n\n";
const DATA_PREFIX = "data: ";

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

      if (parsed.success) {
        events.push(parsed.data);
      }
    } catch {
      continue;
    }
  }

  return { events, rest };
}

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
  proposals: [],
  views: [],
});

export function useAssistantStream({
  conversationId,
  onConversationStarted,
  onFinished,
  onProposal,
  onProposalStatus,
}: AssistantStreamOptions): AssistantStream {
  const [turn, setTurn] = useState<LiveTurn | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const lastQuestion = useRef<string>("");
  const stopped = useRef(false);

  const activeConversation = useRef<string | undefined>(conversationId);
  activeConversation.current = conversationId;

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

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
      stopped.current = false;
      setTurn(idle(message));

      const fail = (code: AiErrorCode): void => {
        if (inFlight.current !== null && inFlight.current !== controller) {
          return;
        }

        setTurn((current) =>
          current ? { ...current, tool: null, error: code, streaming: false } : current,
        );
      };

      if (!navigator.onLine) {
        inFlight.current = null;
        fail(AI_ERROR_CODE.OFFLINE);

        return;
      }

      let opened = activeConversation.current;
      let lost: AiErrorCode | null = null;
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

      const abortAs = (code: AiErrorCode): void => {
        lost ??= code;
        controller.abort();
        void reader?.cancel().catch(() => undefined);
      };
      const feed = (): void => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => abortAs(AI_ERROR_CODE.CONNECTION_LOST), AI_STREAM_IDLE_MS);
      };
      const onOffline = (): void => abortAs(AI_ERROR_CODE.OFFLINE);

      window.addEventListener("offline", onOffline);
      feed();

      try {
        const response = await assistantApi.chat(
          { message, ...(opened !== undefined && { conversationId: opened }) },
          controller.signal,
        );

        reader = response.body?.getReader();

        if (!reader) {
          throw new Error("The assistant answered with no body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let failed: AiErrorCode | null = null;
        let terminal = false;

        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          feed();
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
                terminal = true;
                failed = event.code;
                break;

              case AI_STREAM_EVENT.PROPOSAL: {
                const { proposal } = event;

                onProposal?.(proposal);
                setTurn((current) =>
                  current
                    ? { ...current, tool: null, proposals: [...current.proposals, proposal] }
                    : current,
                );
                break;
              }

              case AI_STREAM_EVENT.PROPOSAL_STATUS:
                onProposalStatus?.(event);
                break;

              case AI_STREAM_EVENT.VIEW: {
                const { toolCallId, view } = event;

                setTurn((current) =>
                  current
                    ? { ...current, views: [...current.views, { toolCallId, view }] }
                    : current,
                );
                break;
              }

              case AI_STREAM_EVENT.DONE:
                terminal = true;
                break;
            }
          }
        }

        if (!terminal) {
          failed = lost ?? AI_ERROR_CODE.CONNECTION_LOST;
        }

        if (failed) {
          fail(failed);

          return;
        }

        if (opened !== undefined) {
          await onFinished(opened);
        }

        setTurn(null);
      } catch (error) {
        if (stopped.current) {
          if (opened !== undefined) {
            await onFinished(opened);
          }

          setTurn(null);

          return;
        }

        if (controller.signal.aborted && lost === null) {
          return;
        }

        fail(
          lost ??
            (error instanceof ApiError ? codeFromError(error) : AI_ERROR_CODE.CONNECTION_LOST),
        );
      } finally {
        clearTimeout(watchdog);
        window.removeEventListener("offline", onOffline);

        if (inFlight.current === controller) {
          inFlight.current = null;
        }
      }
    },
    [onConversationStarted, onFinished, onProposal, onProposalStatus],
  );

  const send = useCallback(
    (message: string) => {
      void run(message);
    },
    [run],
  );

  const stop = useCallback(() => {
    stopped.current = true;
    inFlight.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (lastQuestion.current) {
      void run(lastQuestion.current);
    }
  }, [run]);

  return { turn, streaming: turn?.streaming ?? false, send, stop, retry };
}
