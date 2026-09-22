import { createHash } from "node:crypto";
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

const MAX_CLINIC_CLIENTS = 50;

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
  /** One client per clinic key, found by its digest so the map never holds a key as its index. */
  private readonly clinicClients = new Map<string, OpenAI>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    return this.streamWith(() => this.openai(), request);
  }

  /** The same provider on a clinic's own key, entered in its settings. */
  withKey(apiKey: string): ChatProvider {
    return {
      name: this.name,
      stream: (request) => this.streamWith(() => this.clientFor(apiKey), request),
    };
  }

  private async *streamWith(client: () => OpenAI, request: ChatRequest): AsyncIterable<ChatChunk> {
    const text: string[] = [];
    const calls = new Map<number, PartialToolCall>();
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      // Inside the try: an unconfigured key is the likeliest failure of all, and thrown from
      // outside it reached the user as `provider_unavailable` having logged nothing at all.
      const stream = await client().chat.completions.create({
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

      this.client = this.create(apiKey);
    }

    return this.client;
  }

  private clientFor(apiKey: string): OpenAI {
    const digest = createHash("sha256").update(apiKey).digest("hex");
    const cached = this.clinicClients.get(digest);

    if (cached) {
      return cached;
    }

    // A replaced key leaves its client behind; the cap keeps that from growing without end.
    if (this.clinicClients.size >= MAX_CLINIC_CLIENTS) {
      const oldest = this.clinicClients.keys().next().value;

      if (oldest !== undefined) {
        this.clinicClients.delete(oldest);
      }
    }

    const client = this.create(apiKey);
    this.clinicClients.set(digest, client);

    return client;
  }

  private create(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      timeout: this.config.get("AI_REQUEST_TIMEOUT_MS", { infer: true }),
      maxRetries: 1,
    });
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

    return redactKeys(`${error.name} (${detail}): ${error.message}`);
  }

  return redactKeys(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

/** A rejected key is quoted back in the error, and a clinic's key must not reach the log. */
export const redactKeys = (text: string): string =>
  text.replace(/sk-[A-Za-z0-9_*.-]{4,}/g, "sk-<redacted>");
