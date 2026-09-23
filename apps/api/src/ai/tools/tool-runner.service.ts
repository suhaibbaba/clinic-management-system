import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import {
  AI_TOOL,
  AI_TOOL_ERROR,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  type AiOutboundError,
  type AiProposal,
  type AiToolError,
  type AiToolName,
  type AiView,
} from "@clinic/shared";
import type { ChatToolCall, ChatToolDefinition } from "@api/ai/chat-provider";
import { OutboundError } from "@api/ai/outbound/proposals.service";
import { AiToolsService } from "@api/ai/tools/ai-tools.service";
import { isVisible, TOOL_GROUP_NAMES } from "@api/ai/tools/tool-groups";
import {
  localizeInstants,
  ToolRefusal,
  type AiTool,
  type ToolAuditTarget,
  type ToolContext,
} from "@api/ai/tools/ai-tool";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiAuditLog, clinics } from "@api/database/schema";
import { eq } from "drizzle-orm";
import { CapabilityRegistry } from "@api/permissions/capability-registry.service";
import { PermissionsService } from "@api/permissions/permissions.service";

/** Outside a conversation — a test, a script — every group counts as loaded. */
const ALL_GROUPS: ReadonlySet<string> = new Set(TOOL_GROUP_NAMES);

const LOAD_TOOLS_DEFINITION: ChatToolDefinition = {
  name: AI_TOOL.LOAD_TOOLS,
  description:
    "Load one or more tool groups (listed in the system prompt) so their tools can be called " +
    "for the rest of this conversation. Load before calling a tool you do not have; never to " +
    "read — the core tools and query_data need no loading. Returns the names now available.",
  parameters: {
    type: "object",
    properties: {
      groups: {
        type: "array",
        items: { type: "string", enum: [...TOOL_GROUP_NAMES] },
        minItems: 1,
      },
    },
    required: ["groups"],
    additionalProperties: false,
  },
};

export interface ToolRun {
  /** As the model asked for it, which is not necessarily a tool that exists. */
  readonly name: string;
  /** The JSON handed back to the model, envelope and all. */
  readonly content: string;
  /** Set when the tool drafted a proposal: the stream sends it to the card, never to the model. */
  readonly proposal?: AiProposal;
  /** Set when the page draws the result: the stream sends it as its own frame. */
  readonly view?: AiView;
}

interface Envelope {
  readonly tool: string;
  /** Read by the model together with the system prompt's rule about what that means. */
  readonly untrusted_clinic_data?: true;
  readonly result?: unknown;
  readonly error?: AiToolError | AiOutboundError;
  readonly details?: string[];
}

interface Executed {
  readonly envelope: Envelope;
  readonly proposal?: AiProposal;
  readonly audit?: ToolAuditTarget;
  readonly view?: AiView;
}

// Everything between the model asking for a tool and the model being handed an answer: the
// capability check, the argument check, the call itself, and the audit row. The model supplies the
// arguments and nothing else — the actor comes from the token, one frame up.
@Injectable()
export class ToolRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger("Assistant");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly tools: AiToolsService,
    private readonly permissions: PermissionsService,
    private readonly registry: CapabilityRegistry,
  ) {}

  // A renamed controller silently turns its capability key into one nobody holds, which would lock
  // the assistant out of a tool without anybody noticing. Refuse to boot instead.
  onApplicationBootstrap(): void {
    const missing = this.tools
      .list()
      .flatMap((tool) =>
        tool.capability && !this.registry.get(tool.capability)
          ? [`${tool.name} → ${tool.capability}`]
          : [],
      );

    if (missing.length > 0) {
      throw new Error(
        `Assistant tools name capabilities that no endpoint declares: ${missing.join(", ")}`,
      );
    }
  }

  /** The core set, the groups this turn has loaded, and `load_tools` to load more. */
  definitions(loaded: ReadonlySet<string> = ALL_GROUPS): ChatToolDefinition[] {
    return [
      ...this.tools
        .list()
        .filter((tool) => isVisible(tool, loaded))
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      LOAD_TOOLS_DEFINITION,
    ];
  }

  /** The tools a group holds, as `load_tools` reports them to the model. */
  toolsIn(groups: readonly string[]): string[] {
    return this.tools
      .list()
      .filter((tool) => groups.includes(tool.group))
      .map((tool) => tool.name);
  }

  async run(
    actor: AuthenticatedUser,
    conversationId: string,
    call: ChatToolCall,
    loaded: ReadonlySet<string> = ALL_GROUPS,
  ): Promise<ToolRun> {
    const started = Date.now();
    const tool = this.tools.list().find((candidate) => candidate.name === call.name);

    if (!tool) {
      // The model invented a name. It hears about it and picks again.
      return this.finish(actor, conversationId, call.name, null, started, {
        tool: call.name,
        error: AI_TOOL_ERROR.NOT_FOUND,
      });
    }

    const args = parseArguments(call.arguments);

    // A tool the model was never shown this turn: it loads the group, then calls it.
    if (!isVisible(tool, loaded)) {
      return this.finish(actor, conversationId, tool.name, args, started, {
        tool: tool.name,
        error: AI_TOOL_ERROR.NOT_LOADED,
        details: [`call load_tools with groups ["${tool.group}"] first`],
      });
    }

    if (!(await this.permitted(actor, tool))) {
      return this.finish(actor, conversationId, tool.name, args, started, {
        tool: tool.name,
        error: AI_TOOL_ERROR.NOT_PERMITTED,
      });
    }

    const executed = await this.execute(actor, tool, args, { conversationId });
    const run = await this.finish(
      actor,
      conversationId,
      tool.name,
      args,
      started,
      executed.envelope,
      executed.audit,
    );

    return {
      ...run,
      ...(executed.proposal && { proposal: executed.proposal }),
      ...(executed.view && { view: executed.view }),
    };
  }

  private async execute(
    actor: AuthenticatedUser,
    tool: AiTool,
    args: unknown,
    context: ToolContext,
  ): Promise<Executed> {
    try {
      const outcome = await tool.execute(actor, args, context);

      if (!outcome.ok) {
        return {
          envelope: { tool: tool.name, error: outcome.error, details: outcome.details },
        };
      }

      return {
        envelope: {
          tool: tool.name,
          untrusted_clinic_data: true,
          result: localizeInstants(outcome.data, await this.timeZone(actor.clinicId)),
        },
        ...(outcome.proposal && { proposal: outcome.proposal }),
        ...(outcome.audit && { audit: outcome.audit }),
        ...(outcome.view && { view: outcome.view }),
      };
    } catch (error) {
      if (error instanceof ToolRefusal) {
        return {
          envelope: {
            tool: tool.name,
            error: error.code,
            ...(error.details && { details: error.details }),
          },
        };
      }

      if (error instanceof NotFoundException) {
        return { envelope: { tool: tool.name, error: AI_TOOL_ERROR.NOT_FOUND } };
      }

      if (error instanceof ForbiddenException) {
        return { envelope: { tool: tool.name, error: AI_TOOL_ERROR.NOT_PERMITTED } };
      }

      // A cap or an empty list: the model hears the code and explains it to the user.
      if (error instanceof OutboundError) {
        return { envelope: { tool: tool.name, error: error.code } };
      }

      // The message stays here: it names tables and ids, and the model's context is quoted back
      // to the user.
      this.logger.error(`Tool ${tool.name} failed: ${describe(error)}`);

      return { envelope: { tool: tool.name, error: AI_TOOL_ERROR.FAILED } };
    }
  }

  private async timeZone(clinicId: string): Promise<string> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE;
  }

  private permitted(actor: AuthenticatedUser, tool: AiTool): Promise<boolean> {
    if (!tool.capability) {
      return Promise.resolve(true);
    }

    return this.permissions.allows(actor.clinicId, actor.role, tool.capability);
  }

  private async finish(
    actor: AuthenticatedUser,
    conversationId: string,
    name: string,
    args: unknown,
    started: number,
    envelope: Envelope,
    audit?: ToolAuditTarget,
  ): Promise<ToolRun> {
    const content = JSON.stringify(envelope);

    await this.db.insert(aiAuditLog).values({
      clinicId: actor.clinicId,
      userId: actor.id,
      conversationId,
      toolName: name,
      argsJson: redact(args),
      outcome: envelope.error ?? "ok",
      resultSize: content.length,
      durationMs: Date.now() - started,
      ...(audit && { entity: audit.entity, entityId: audit.entityId }),
    });

    return { name, content };
  }
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    // Not an error yet: the schema will reject it and tell the model what it wanted.
    return {};
  }
}

// The ids and dates are kept — they are what makes a row worth reading. Free text typed about a
// patient — a search, a note, a new patient's name and number — is recorded as given, not what.
const REDACTED_ARGS = new Set(["query", "note", "full_name", "phone"]);

function redact(args: unknown): unknown {
  if (!args || typeof args !== "object") {
    return args;
  }

  const entries = Object.entries(args as Record<string, unknown>).map(([key, value]) =>
    REDACTED_ARGS.has(key) ? [key, "<redacted>"] : [key, value],
  );

  return Object.fromEntries(entries);
}

/** Whether the model named a tool that exists — a `tool` frame is only sent for one that does. */
export const isAiToolName = (name: string): name is AiToolName =>
  (Object.values(AI_TOOL) as string[]).includes(name);

const describe = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);
