import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type { Env } from "@api/config/env.schema";
import {
  ChatProviderError,
  type ChatChunk,
  type ChatMessage,
  type ChatProvider,
  type ChatRequest,
  type ChatToolCall,
} from "@api/ai/chat-provider";

type OpenAiMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type OpenAiTool = OpenAI.Chat.Completions.ChatCompletionFunctionTool;

// A partial call as it streams: the id and name arrive once, the arguments in fragments.
interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}

@Injectable()
export class OpenAiChatProvider implements ChatProvider {
  readonly name = "openai";

  private readonly logger = new Logger("Assistant");
  private client: OpenAI | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const text: string[] = [];
    const calls = new Map<number, PartialToolCall>();
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      // Inside the try: an unconfigured key is the likeliest failure of all, and thrown from
      // outside it reached the user as `provider_unavailable` having logged nothing at all.
      const client = this.openai();
      const stream = await client.chat.completions.create({
        model: this.config.get("AI_MODEL", { infer: true }),
        max_completion_tokens: this.config.get("AI_MAX_OUTPUT_TOKENS", { infer: true }),
        messages: request.messages.map(toOpenAiMessage),
        ...(request.tools.length > 0 && { tools: request.tools.map(toOpenAiTool) }),
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          text.push(delta.content);
          yield { type: "delta", text: delta.content };
        }

        for (const call of delta?.tool_calls ?? []) {
          const partial = calls.get(call.index) ?? { id: "", name: "", arguments: "" };

          calls.set(call.index, {
            id: call.id ?? partial.id,
            name: call.function?.name ?? partial.name,
            arguments: partial.arguments + (call.function?.arguments ?? ""),
          });
        }

        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
        }
      }
    } catch (error) {
      // The provider's own words stay in the log: they quote the prompt back, which here is
      // patient data.
      this.logger.error(
        `OpenAI request failed (model ${this.config.get("AI_MODEL", { infer: true })}): ${describe(error)}`,
      );
      throw new ChatProviderError(error);
    }

    yield {
      type: "completed",
      text: text.join(""),
      toolCalls: [...calls.values()].filter((call): call is ChatToolCall => call.id !== ""),
      usage,
    };
  }

  private openai(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.get("OPENAI_API_KEY", { infer: true });

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      this.client = new OpenAI({
        apiKey,
        timeout: this.config.get("AI_REQUEST_TIMEOUT_MS", { infer: true }),
        maxRetries: 1,
      });
    }

    return this.client;
  }
}

function toOpenAiMessage(message: ChatMessage): OpenAiMessage {
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

const toOpenAiTool = (tool: ChatRequest["tools"][number]): OpenAiTool => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
});

// Status, type and code name the failure — a rejected key, an unknown model, an exhausted quota —
// which the message alone does not always do.
function describe(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const detail = [
      `status=${error.status ?? "none"}`,
      `type=${error.type ?? "none"}`,
      `code=${error.code ?? "none"}`,
      ...(error.param ? [`param=${error.param}`] : []),
    ].join(" ");

    return `${error.name} (${detail}): ${error.message}`;
  }

  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
