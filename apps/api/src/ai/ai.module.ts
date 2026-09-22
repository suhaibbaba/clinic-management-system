import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentService } from "@api/ai/agent.service";
import { AiBudgetService } from "@api/ai/ai-budget.service";
import { AiController } from "@api/ai/ai.controller";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { CHAT_PROVIDER, LogChatProvider, type ChatProvider } from "@api/ai/chat-provider";
import { OpenAiChatProvider } from "@api/ai/openai-chat.provider";
import { AiToolsService } from "@api/ai/tools/ai-tools.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import { AppointmentsModule } from "@api/appointments/appointments.module";
import { BillingModule } from "@api/billing/billing.module";
import { AppConfigModule } from "@api/config/config.module";
import type { Env } from "@api/config/env.schema";
import { DatabaseModule } from "@api/database/database.module";
import { InventoryModule } from "@api/inventory/inventory.module";
import { LabsModule } from "@api/labs/labs.module";
import { PatientsModule } from "@api/patients/patients.module";
import { PermissionsModule } from "@api/permissions/permissions.module";

// Owns no domain table beyond its own transcript: every tool answers through the service that
// already answers the same question for a screen, so the assistant and the screen cannot disagree
// about what a role may read.
@Module({
  imports: [
    DatabaseModule,
    AppConfigModule,
    PermissionsModule,
    AppointmentsModule,
    PatientsModule,
    BillingModule,
    LabsModule,
    InventoryModule,
  ],
  controllers: [AiController],
  providers: [
    LogChatProvider,
    OpenAiChatProvider,
    {
      provide: CHAT_PROVIDER,
      inject: [ConfigService, LogChatProvider, OpenAiChatProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        log: LogChatProvider,
        openai: OpenAiChatProvider,
      ): ChatProvider => {
        // `log` is the silent default, and its echo reads like a broken model rather than a
        // provider that was never configured. Say which one answered, once, at boot.
        const provider = config.get("AI_PROVIDER", { infer: true }) === "openai" ? openai : log;

        new Logger("Assistant").log(
          provider.name === "openai"
            ? `Chat provider: openai, model ${config.get("AI_MODEL", { infer: true })}.`
            : "Chat provider: log — every answer is an echo and no tool is called. Set AI_PROVIDER=openai to reach a model.",
        );

        return provider;
      },
    },
    AiToolsService,
    ToolRunnerService,
    AiConversationsService,
    AiBudgetService,
    AgentService,
  ],
})
export class AiModule {}
