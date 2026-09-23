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
} from "@api/ai/chat-provider";
import { ChatProviderResolver } from "@api/ai/chat-provider.resolver";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { SYSTEM_PROMPT_VERSION, systemPrompt, type SystemPromptInput } from "@api/ai/system-prompt";
import { TOOL_GROUP_NAMES } from "@api/ai/tools/tool-groups";
import { isAiToolName, ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import { z } from "zod";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, doctors, users } from "@api/database/schema";
import type { Env } from "@api/config/env.schema";

// The loop: ask, run whatever the model asked for, ask again with the answers, until it stops
// asking. The actor rides along untouched — nothing the model returns can change who is calling.
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

    // A turn ends in `done` or `error`, never in silence: the page reports a stream that closes
    // without either as a lost connection, which would be the wrong thing to tell the user.
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
    // Per turn, preloaded from the conversation: a follow-up does not pay the load step again.
    const loaded = new Set(await this.conversations.loadedGroups(conversationId));
    let loads = 0;

    for (let step = 0; step < steps; step += 1) {
      let completed: { text: string; toolCalls: readonly ChatToolCall[] } | undefined;

      try {
        const stream = provider.stream({ messages, tools: this.tools.definitions(loaded) });

        for await (const chunk of stream) {
          if (chunk.type === "delta") {
            yield { type: AI_STREAM_EVENT.DELTA, text: chunk.text };
            continue;
          }

          add(spent, chunk.usage);
          completed = { text: chunk.text, toolCalls: chunk.toolCalls };
        }
      } catch (error) {
        // Already logged with its cause by the provider; the user is told only what kind it was.
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

      // Set by the `completed` chunk every provider ends with; a stream without one answered
      // nothing, and an empty answer ends the turn rather than looping.
      const answer = completed ?? { text: "", toolCalls: [] };

      if (answer.toolCalls.length === 0) {
        const { id } = await this.record(actor, conversationId, answer.text, spent);

        yield { type: AI_STREAM_EVENT.DONE, messageId: id };

        return;
      }

      messages.push({ role: "assistant", content: answer.text, toolCalls: [...answer.toolCalls] });

      // Loading tools is bookkeeping, not work: a step that only loaded does not count, up to a few.
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
          yield { type: AI_STREAM_EVENT.VIEW, toolCallId: call.id, view: run.view };
        }

        if (run.proposal) {
          yield { type: AI_STREAM_EVENT.PROPOSAL, proposal: run.proposal };
        }
      }
    }

    // The model kept asking for tools and never answered. Better a said-so than a silent stop.
    await this.record(actor, conversationId, "", spent);
    yield { type: AI_STREAM_EVENT.ERROR, code: AI_ERROR_CODE.STEP_LIMIT };
  }

  // The schemas reach the model through the next request's `tools`; the result only names them.
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

  // Recorded even for a turn that failed: the tokens were spent, and the clinic's daily budget is
  // a sum over these rows.
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

  /** Who is asking, from the database and never from the request or the model. */
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
      // A doctor's name is their user's name; the row only says that they are one.
      doctor: doctor ? { id: doctor.id, name } : null,
      today: localDate(new Date(), timeZone),
      ...clock(timeZone),
    };
  }
}

function add(total: { inputTokens: number; outputTokens: number }, usage: ChatUsage): void {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
}

function clock(timeZone: string): { now: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return { now: `${read("hour")}:${read("minute")}`, weekday: read("weekday") };
}

/** How many steps that only loaded tools are free in one turn. */
const MAX_LOADS = 3;

const loadToolsSchema = z.object({ groups: z.array(z.enum(TOOL_GROUP_NAMES)).min(1) });

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
