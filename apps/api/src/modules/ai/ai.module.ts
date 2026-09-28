import { Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AiActionsController } from "@api/modules/ai/actions/ai-actions.controller";
import { AiActionsService } from "@api/modules/ai/actions/ai-actions.service";
import { AgentService } from "@api/modules/ai/services/agent.service";
import { AiBudgetService } from "@api/modules/ai/services/ai-budget.service";
import { AiController } from "@api/modules/ai/controllers/ai.controller";
import { AiConversationsService } from "@api/modules/ai/services/ai-conversations.service";
import { CHAT_PROVIDER } from "@api/modules/ai/constants";
import { LogChatProvider } from "@api/modules/ai/services/chat-provider";
import { type ChatProvider } from "@api/modules/ai/lib/chat-provider";
import { ChatProviderResolver } from "@api/modules/ai/services/chat-provider.resolver";
import { OpenAiChatProvider } from "@api/modules/ai/services/openai-chat.provider";
import { AutomationService } from "@api/modules/ai/outbound/automation.service";
import { MessageDrafterService } from "@api/modules/ai/outbound/message-drafter.service";
import { OutboundController } from "@api/modules/ai/outbound/outbound.controller";
import { OutboundLogService } from "@api/modules/ai/outbound/outbound-log.service";
import { OutboundRecipientsService } from "@api/modules/ai/outbound/outbound-recipients.service";
import { ProposalsService } from "@api/modules/ai/outbound/proposals.service";
import { AI_READ_CLIENT, QueryDataService } from "@api/modules/ai/query/query-data.service";
import { AiToolsService } from "@api/modules/ai/tools/ai-tools.service";
import { RouteToolRegistry } from "@api/modules/ai/tools/route-tools";
import postgres, { type Sql } from "postgres";
import { ToolRunnerService } from "@api/modules/ai/tools/tool-runner.service";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { BillingModule } from "@api/modules/billing/billing.module";
import { AppConfigModule } from "@api/config/config.module";
import type { Env } from "@api/config/env.schema";
import { DatabaseModule } from "@api/database/database.module";
import { DoctorsModule } from "@api/modules/doctors/doctors.module";
import { InventoryModule } from "@api/modules/inventory/inventory.module";
import { LabsModule } from "@api/modules/labs/labs.module";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { PatientsModule } from "@api/modules/patients/patients.module";
import { PermissionsModule } from "@api/modules/permissions/permissions.module";
import { ClinicScheduleModule } from "@api/modules/schedule/clinic-schedule.module";
import { SecretsModule } from "@api/modules/secrets/secrets.module";

@Module({
  imports: [
    DatabaseModule,
    AppConfigModule,
    PermissionsModule,
    AppointmentsModule,
    ClinicScheduleModule,
    DoctorsModule,
    PatientsModule,
    BillingModule,
    LabsModule,
    InventoryModule,
    NotificationsModule,
    SecretsModule,
    DiscoveryModule,
  ],
  controllers: [AiController, OutboundController, AiActionsController],
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
        const provider = config.get("AI_PROVIDER", { infer: true }) === "openai" ? openai : log;

        new Logger("Assistant").log(
          provider.name === "openai"
            ? `Chat provider: openai, model ${config.get("AI_MODEL", { infer: true })}.`
            : "Chat provider: log — every answer is an echo and no tool is called. Set AI_PROVIDER=openai to reach a model.",
        );

        return provider;
      },
    },
    ChatProviderResolver,
    AiToolsService,
    ToolRunnerService,
    AiConversationsService,
    AiBudgetService,
    AgentService,
    OutboundRecipientsService,
    MessageDrafterService,
    ProposalsService,
    AutomationService,
    OutboundLogService,
    AiActionsService,
    {
      provide: AI_READ_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Sql =>
        postgres(config.get("DATABASE_URL", { infer: true }), { max: 2, connect_timeout: 10 }),
    },
    QueryDataService,
    RouteToolRegistry,
  ],
})
export class AiModule {}
