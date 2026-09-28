import { Injectable } from "@nestjs/common";
import { ChatProvider, ChatRequest, ChatChunk } from "@api/ai/lib/chat-provider";

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
