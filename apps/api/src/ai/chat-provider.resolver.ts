import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CHAT_PROVIDER, type ChatProvider } from "@api/ai/chat-provider";
import { OpenAiChatProvider } from "@api/ai/openai-chat.provider";
import type { Env } from "@api/config/env.schema";
import { SecretsService } from "@api/secrets/secrets.service";

// A clinic that entered its own OpenAI key is answered on it, and billed for it; every other clinic
// gets the provider the environment chose. Tests never leave that one, whatever a row says.
@Injectable()
export class ChatProviderResolver {
  constructor(
    @Inject(CHAT_PROVIDER) private readonly fallback: ChatProvider,
    private readonly openai: OpenAiChatProvider,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async for(clinicId: string): Promise<ChatProvider> {
    if (this.config.get("NODE_ENV", { infer: true }) === "test") {
      return this.fallback;
    }

    const key = await this.secrets.openAiKey(clinicId);

    return key ? this.openai.withKey(key) : this.fallback;
  }
}
