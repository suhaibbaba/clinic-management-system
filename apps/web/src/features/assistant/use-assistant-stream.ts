import {
  AI_ERROR_CODE,
  AI_STREAM_EVENT,
  aiStreamEventSchema,
  type AiErrorCode,
  type AiProposal,
  type AiProposalStatusEvent,
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
  /** Drafts this turn made, drawn as confirmation cards until the stored thread takes over. */
  readonly proposals: readonly AiProposal[];
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
  /** A drafted proposal, for the page to seed its card's cache with. */
  readonly onProposal?: ((proposal: AiProposal) => void) | undefined;
  readonly onProposalStatus?: ((event: AiProposalStatusEvent) => void) | undefined;
}

/** Three missed heartbeats: the server pings every 15 s while a turn runs. */
export const AI_STREAM_IDLE_MS = 45_000;

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
  proposals: [],
});

// One turn at a time, held here rather than in the query cache: it is not the server's state yet.
// When it becomes the server's state the stored messages replace it, which is why the turn is only
// dropped once they have been read back.
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
      stopped.current = false;
      setTurn(idle(message));

      const fail = (code: AiErrorCode): void => {
        // A turn another one replaced has nothing left on screen to mark.
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
      // Why the fetch was aborted when the user did not press stop: the watchdog, or the network.
      let lost: AiErrorCode | null = null;
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

      // The reader is cancelled as well: a read already waiting is not always released by the
      // abort alone, and a stalled line is exactly when nothing else would release it.
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
        // A turn ends in `done` or `error`. A body that closes on neither was cut off — the API
        // died, a proxy timed out — and saying nothing would pass half an answer off as whole.
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

        // The answer is the server's now. Read the stored messages back before the live turn goes,
        // or the thread blinks empty between the two.
        if (opened !== undefined) {
          await onFinished(opened);
        }

        setTurn(null);
      } catch (error) {
        if (stopped.current) {
          // Stopped on purpose. The question was recorded; the half-written answer was not, so the
          // stored thread is what the reader is left with.
          if (opened !== undefined) {
            await onFinished(opened);
          }

          setTurn(null);

          return;
        }

        // Replaced by a newer turn, or the page went away: nobody is waiting on this one.
        if (controller.signal.aborted && lost === null) {
          return;
        }

        // What was streamed stays on screen under the error: hiding it is worse than showing half.
        // A refusal with a status carries its code; a read that died mid-body is a lost line.
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

  // Flagged before the abort, so the user's own stop is never reported as a lost connection.
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
