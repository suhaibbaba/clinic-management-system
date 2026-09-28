import OpenAI from "openai";
import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Env } from "@api/config/env.schema";
import {
  ChatProviderError,
  type ChatChunk,
  type ChatProvider,
  type ChatRequest,
  type ChatToolCall,
} from "@api/ai/lib/chat-provider";
import {
  PartialToolCall,
  toOpenAiMessage,
  toOpenAiTool,
  describe,
  classify,
} from "@api/ai/lib/openai-chat.provider";
import { MAX_CLINIC_CLIENTS } from "@api/ai/constants";

@Injectable()
export class OpenAiChatProvider implements ChatProvider {
  readonly name = "openai";

  private readonly logger = new Logger("Assistant");
  private client: OpenAI | undefined;
  private readonly clinicClients = new Map<string, OpenAI>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    return this.streamWith(() => this.openai(), request);
  }

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
    let truncated = false;
    const ceiling = this.config.get("AI_MAX_OUTPUT_TOKENS", { infer: true });

    try {
      const stream = await client().chat.completions.create({
        model: this.config.get("AI_MODEL", { infer: true }),
        max_completion_tokens: Math.min(request.maxOutputTokens ?? ceiling, ceiling),
        reasoning_effort: this.config.get("AI_REASONING_EFFORT", { infer: true }),
        messages: request.messages.map(toOpenAiMessage),
        ...(request.tools.length > 0 && { tools: request.tools.map(toOpenAiTool) }),
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        truncated ||= chunk.choices[0]?.finish_reason === "length";

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
      this.logger.error(
        `OpenAI request failed (model ${this.config.get("AI_MODEL", { infer: true })}): ${describe(error)}`,
      );
      throw new ChatProviderError(error, classify(error));
    }

    yield {
      type: "completed",
      text: text.join(""),
      toolCalls: [...calls.values()].filter((call): call is ChatToolCall => call.id !== ""),
      usage,
      ...(truncated && { truncated }),
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
