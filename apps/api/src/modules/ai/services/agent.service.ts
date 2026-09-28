import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AI_ERROR_CODE,
  AI_MESSAGE_ROLE,
  AI_STREAM_EVENT,
  AI_TOOL,
  AI_TOOL_ERROR,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  type AiChatRequest,
  type AiStreamEvent,
  type PersonName,
} from "@clinic/shared";
import { and, eq, isNull } from "drizzle-orm";
import {
  ChatProviderError,
  type ChatMessage,
  type ChatToolCall,
  type ChatUsage,
} from "@api/modules/ai/lib/chat-provider";
import { ChatProviderResolver } from "@api/modules/ai/services/chat-provider.resolver";
import { AiConversationsService } from "@api/modules/ai/services/ai-conversations.service";
import {
  SYSTEM_PROMPT_VERSION,
  systemPrompt,
  type SystemPromptInput,
} from "@api/modules/ai/lib/system-prompt";
import { TOOL_GROUP_NAMES } from "@api/modules/ai/tools/tool-groups";
import { isAiToolName, ToolRunnerService } from "@api/modules/ai/tools/tool-runner.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, doctors, users } from "@api/database/schema";
import { type Env } from "@api/config/env.schema";
import { VIEW_REPLY_TOKENS, MAX_LOADS } from "@api/modules/ai/constants";
import { add, loadToolsSchema, parseJson, clock } from "@api/modules/ai/lib/agent";

@Injectable()
export class AgentService {
  private readonly logger = new Logger("Assistant");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly providers: ChatProviderResolver,
    private readonly conversations: AiConversationsService,
    private readonly tools: ToolRunnerService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async *run(actor: AuthenticatedUser, request: AiChatRequest): AsyncGenerator<AiStreamEvent> {
    const conversation = request.conversationId
      ? await this.conversations.requireOwn(actor, request.conversationId)
      : await this.conversations.start(actor, request.message);

    yield { type: AI_STREAM_EVENT.CONVERSATION, conversationId: conversation.id };

    const spent = { inputTokens: 0, outputTokens: 0 };

    try {
      yield* this.turn(actor, conversation.id, request.message, spent);
    } catch (error) {
      this.logger.error(`The agent loop failed: ${String(error)}`);
      await this.record(actor, conversation.id, "", spent).catch(() => undefined);
      yield { type: AI_STREAM_EVENT.ERROR, code: AI_ERROR_CODE.FAILED };
    }
  }

  private async *turn(
    actor: AuthenticatedUser,
    conversationId: string,
    question: string,
    spent: { inputTokens: number; outputTokens: number },
  ): AsyncGenerator<AiStreamEvent> {
    const history = await this.conversations.history(
      conversationId,
      this.config.get("AI_HISTORY_MESSAGES", { infer: true }),
    );

    await this.conversations.append(actor, conversationId, {
      role: AI_MESSAGE_ROLE.USER,
      content: question,
    });

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(await this.context(actor)) },
      ...history,
      { role: "user", content: question },
    ];

    const provider = await this.providers.for(actor.clinicId);
    const steps = this.config.get("AI_MAX_TOOL_STEPS", { infer: true });
    const loaded = new Set(await this.conversations.loadedGroups(conversationId));
    let loads = 0;
    let viewShown = false;
    let fullBudget = false;

    for (let step = 0; step < steps; step += 1) {
      let completed:
        { text: string; toolCalls: readonly ChatToolCall[]; truncated?: boolean } | undefined;
      const reduced = viewShown && !fullBudget;

      try {
        const stream = provider.stream({
          messages,
          tools: this.tools.definitions(loaded),
          ...(reduced && { maxOutputTokens: VIEW_REPLY_TOKENS }),
        });

        for await (const chunk of stream) {
          if (chunk.type === "delta") {
            yield { type: AI_STREAM_EVENT.DELTA, text: chunk.text };
            continue;
          }

          add(spent, chunk.usage);
          completed = {
            text: chunk.text,
            toolCalls: chunk.toolCalls,
            ...(chunk.truncated && { truncated: true }),
          };
        }
      } catch (error) {
        if (!(error instanceof ChatProviderError)) {
          this.logger.error(`The agent loop failed: ${String(error)}`);
        }

        await this.record(actor, conversationId, "", spent);
        yield {
          type: AI_STREAM_EVENT.ERROR,
          code:
            error instanceof ChatProviderError ? error.code : AI_ERROR_CODE.PROVIDER_UNAVAILABLE,
        };

        return;
      }

      const answer = completed ?? { text: "", toolCalls: [] };

      if (reduced && answer.truncated && answer.toolCalls.length > 0) {
        fullBudget = true;
        step -= 1;
        continue;
      }

      fullBudget = false;

      if (answer.toolCalls.length === 0) {
        const { id } = await this.record(actor, conversationId, answer.text, spent);

        yield { type: AI_STREAM_EVENT.DONE, messageId: id };

        return;
      }

      messages.push({ role: "assistant", content: answer.text, toolCalls: [...answer.toolCalls] });

      if (answer.toolCalls.every((call) => call.name === AI_TOOL.LOAD_TOOLS) && loads < MAX_LOADS) {
        loads += 1;
        step -= 1;
      }

      for (const call of answer.toolCalls) {
        if (call.name === AI_TOOL.LOAD_TOOLS) {
          const content = await this.loadTools(conversationId, call.arguments, loaded);

          messages.push({ role: "tool", toolCallId: call.id, content });
          await this.conversations.append(actor, conversationId, {
            role: AI_MESSAGE_ROLE.TOOL,
            content,
            toolName: AI_TOOL.LOAD_TOOLS,
          });
          continue;
        }

        if (isAiToolName(call.name)) {
          yield { type: AI_STREAM_EVENT.TOOL, tool: call.name };
        }

        const run = await this.tools.run(actor, conversationId, call, loaded);

        messages.push({ role: "tool", toolCallId: call.id, content: run.content });
        await this.conversations.append(actor, conversationId, {
          role: AI_MESSAGE_ROLE.TOOL,
          content: run.content,
          toolName: run.name,
          ...(run.proposal && { proposalId: run.proposal.id }),
          ...(run.view && { view: run.view }),
        });

        if (run.view) {
          viewShown = true;
          yield { type: AI_STREAM_EVENT.VIEW, toolCallId: call.id, view: run.view };
        }

        if (run.proposal) {
          yield { type: AI_STREAM_EVENT.PROPOSAL, proposal: run.proposal };
        }
      }
    }

    await this.record(actor, conversationId, "", spent);
    yield { type: AI_STREAM_EVENT.ERROR, code: AI_ERROR_CODE.STEP_LIMIT };
  }

  private async loadTools(
    conversationId: string,
    raw: string,
    loaded: Set<string>,
  ): Promise<string> {
    const parsed = loadToolsSchema.safeParse(parseJson(raw));

    if (!parsed.success) {
      return JSON.stringify({
        tool: AI_TOOL.LOAD_TOOLS,
        error: AI_TOOL_ERROR.INVALID_ARGUMENTS,
        details: [`groups: one or more of ${TOOL_GROUP_NAMES.join(", ")}`],
      });
    }

    for (const group of await this.conversations.loadGroups(conversationId, parsed.data.groups)) {
      loaded.add(group);
    }

    return JSON.stringify({
      tool: AI_TOOL.LOAD_TOOLS,
      result: { loaded: this.tools.toolsIn(parsed.data.groups) },
    });
  }

  private record(
    actor: AuthenticatedUser,
    conversationId: string,
    content: string,
    usage: ChatUsage,
  ): Promise<{ id: string }> {
    return this.conversations.append(actor, conversationId, {
      role: AI_MESSAGE_ROLE.ASSISTANT,
      content,
      usage,
      promptVersion: SYSTEM_PROMPT_VERSION,
    });
  }

  async context(actor: AuthenticatedUser): Promise<SystemPromptInput> {
    const [[clinic], [user], [doctor]] = await Promise.all([
      this.db
        .select({ nameAr: clinics.nameAr, nameEn: clinics.nameEn, settings: clinics.settings })
        .from(clinics)
        .where(eq(clinics.id, actor.clinicId))
        .limit(1),
      this.db
        .select({ nameAr: users.nameAr, nameEn: users.nameEn })
        .from(users)
        .where(and(eq(users.id, actor.id), eq(users.clinicId, actor.clinicId)))
        .limit(1),
      this.db
        .select({ id: doctors.id })
        .from(doctors)
        .where(
          and(
            eq(doctors.userId, actor.id),
            eq(doctors.clinicId, actor.clinicId),
            isNull(doctors.deletedAt),
          ),
        )
        .limit(1),
    ]);

    const timeZone = clinicScheduleSettings(clinic?.settings).timezone || DEFAULT_TIME_ZONE;
    const name: PersonName = { ar: user?.nameAr ?? "", en: user?.nameEn ?? "" };

    return {
      clinicName: { ar: clinic?.nameAr ?? "", en: clinic?.nameEn ?? "" },
      user: { name, role: actor.role },
      doctor: doctor ? { id: doctor.id, name } : null,
      today: localDate(new Date(), timeZone),
      ...clock(timeZone),
    };
  }
}
