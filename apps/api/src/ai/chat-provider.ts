import { Injectable } from "@nestjs/common";
import { AI_ERROR_CODE } from "@clinic/shared";

export interface ChatToolCall {
  readonly id: string;
  readonly name: string;
  /** Raw JSON as the model wrote it — parsed and validated by the runner, never trusted here. */
  readonly arguments: string;
}

export type ChatMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string; readonly toolCalls?: ChatToolCall[] }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

export interface ChatToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface ChatRequest {
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ChatToolDefinition[];
  /** A lower budget for this step; never above `AI_MAX_OUTPUT_TOKENS`. */
  readonly maxOutputTokens?: number;
}

export interface ChatUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type ChatChunk =
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "completed";
      readonly text: string;
      readonly toolCalls: readonly ChatToolCall[];
      readonly usage: ChatUsage;
      /** The budget ran out before the model finished: a tool call's arguments may be cut. */
      readonly truncated?: boolean;
    };

// One method, because a completion with tools is all any provider has to offer here. A provider
// throws `ChatProviderError` to fail; nothing else may escape it.
export interface ChatProvider {
  readonly name: string;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}

export const CHAT_PROVIDER = Symbol("CHAT_PROVIDER");

/** How a provider failed, as far as the person reading the error can act on it. */
export type ChatProviderFailure =
  | typeof AI_ERROR_CODE.PROVIDER_UNAVAILABLE
  | typeof AI_ERROR_CODE.PROVIDER_REJECTED
  | typeof AI_ERROR_CODE.PROVIDER_QUOTA;

/** What every provider failure becomes. The cause is logged; the caller learns only its kind. */
export class ChatProviderError extends Error {
  constructor(
    cause: unknown,
    readonly code: ChatProviderFailure = AI_ERROR_CODE.PROVIDER_UNAVAILABLE,
  ) {
    super("The chat provider failed", { cause });
    this.name = "ChatProviderError";
  }
}

// Development only, and the default: the assistant boots with no account and the whole route —
// auth, persistence, SSE framing — works end to end. It answers, and never calls a tool.
@Injectable()
export class LogChatProvider implements ChatProvider {
  readonly name = "log";

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const last = [...request.messages].reverse().find((message) => message.role === "user");
    const text = `[ai:log] ${last && "content" in last ? last.content : ""}`;

    yield await Promise.resolve({ type: "delta" as const, text });
    yield {
      type: "completed",
      text,
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
