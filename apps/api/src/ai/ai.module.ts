import { Module } from "@nestjs/common";
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
        config: ConfigService<{ AI_PROVIDER: "log" | "openai" }, true>,
        log: LogChatProvider,
        openai: OpenAiChatProvider,
      ): ChatProvider => (config.get("AI_PROVIDER", { infer: true }) === "openai" ? openai : log),
    },
    AiToolsService,
    ToolRunnerService,
    AiConversationsService,
    AiBudgetService,
    AgentService,
  ],
})
export class AiModule {}
