import OpenAI from "openai";
import {
  type ChatMessage,
  type ChatRequest,
  type ChatProviderFailure,
} from "@api/ai/lib/chat-provider";
import { AI_ERROR_CODE } from "@clinic/shared";

export type OpenAiMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export type OpenAiTool = OpenAI.Chat.Completions.ChatCompletionFunctionTool;

export interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}

export function toOpenAiMessage(message: ChatMessage): OpenAiMessage {
  switch (message.role) {
    case "system":
      return { role: "system", content: message.content };
    case "user":
      return { role: "user", content: message.content };
    case "tool":
      return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
    case "assistant":
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls?.length && {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }),
      };
  }
}

export const toOpenAiTool = (tool: ChatRequest["tools"][number]): OpenAiTool => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
});

export function classify(error: unknown): ChatProviderFailure {
  if (!(error instanceof OpenAI.APIError)) {
    return AI_ERROR_CODE.PROVIDER_UNAVAILABLE;
  }

  if (error.status === 401 || error.status === 403) {
    return AI_ERROR_CODE.PROVIDER_REJECTED;
  }

  if (error.status === 429 || error.code === "insufficient_quota") {
    return AI_ERROR_CODE.PROVIDER_QUOTA;
  }

  return AI_ERROR_CODE.PROVIDER_UNAVAILABLE;
}

export function describe(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const detail = [
      `status=${error.status ?? "none"}`,
      `type=${error.type ?? "none"}`,
      `code=${error.code ?? "none"}`,
      ...(error.param ? [`param=${error.param}`] : []),
    ].join(" ");

    return redactKeys(`${error.name} (${detail}): ${error.message}`);
  }

  return redactKeys(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

export const redactKeys = (text: string): string =>
  text.replace(/sk-[A-Za-z0-9_*.-]{4,}/g, "sk-<redacted>");
