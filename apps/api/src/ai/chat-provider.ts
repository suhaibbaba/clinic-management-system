import { Injectable } from "@nestjs/common";
import { AI_ERROR_CODE } from "@clinic/shared";

export interface ChatToolCall {
  readonly id: string;
  readonly name: string;
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
      readonly truncated?: boolean;
    };

export interface ChatProvider {
  readonly name: string;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
}

export const CHAT_PROVIDER = Symbol("CHAT_PROVIDER");

export type ChatProviderFailure =
  | typeof AI_ERROR_CODE.PROVIDER_UNAVAILABLE
  | typeof AI_ERROR_CODE.PROVIDER_REJECTED
  | typeof AI_ERROR_CODE.PROVIDER_QUOTA;

export class ChatProviderError extends Error {
  constructor(
    cause: unknown,
    readonly code: ChatProviderFailure = AI_ERROR_CODE.PROVIDER_UNAVAILABLE,
  ) {
    super("The chat provider failed", { cause });
    this.name = "ChatProviderError";
  }
}

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
