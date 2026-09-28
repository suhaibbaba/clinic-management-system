import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CHAT_PROVIDER } from "@api/modules/ai/constants";
import { type ChatProvider } from "@api/modules/ai/lib/chat-provider";
import { OpenAiChatProvider } from "@api/modules/ai/services/openai-chat.provider";
import { type Env } from "@api/config/env.schema";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";

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
