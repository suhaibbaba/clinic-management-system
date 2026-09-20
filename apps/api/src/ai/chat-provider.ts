import { Injectable } from "@nestjs/common";

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
    };

// One method, because a completion with tools is all any provider has to offer here. A provider
// throws `ChatProviderError` to fail; nothing else may escape it.
export interface ChatProvider {
  readonly name: string;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}

export const CHAT_PROVIDER = Symbol("CHAT_PROVIDER");

/** What every provider failure becomes. The cause is logged; the caller only learns that it failed. */
export class ChatProviderError extends Error {
  constructor(cause: unknown) {
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
