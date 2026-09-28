import { z } from "zod";
import {
  AI_TOOL_ERROR,
  type AiProposal,
  type AiRiskTier,
  type AiToolError,
  type AiToolName,
  type AiView,
} from "@clinic/shared";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { TOOL_GROUP } from "@api/modules/ai/tools/tool-groups";

export const TOOL_ROW_LIMIT = 50;

export interface ToolRejection {
  readonly ok: false;
  readonly error: typeof AI_TOOL_ERROR.INVALID_ARGUMENTS;
  readonly details: string[];
}

export interface ToolAuditTarget {
  readonly entity: string;
  readonly entityId: string;
}

export type ToolOutcome =
  | {
      readonly ok: true;
      readonly data: unknown;
      readonly proposal?: AiProposal;
      readonly audit?: ToolAuditTarget;
      readonly view?: AiView;
    }
  | ToolRejection;

export class ToolRefusal extends Error {
  constructor(
    readonly code: AiToolError,
    readonly details?: string[],
  ) {
    super(code);
    this.name = "ToolRefusal";
  }
}

export interface ToolContext {
  readonly conversationId: string;
}

export class ProposalResult {
  constructor(
    readonly proposal: AiProposal,
    readonly forModel: unknown,
  ) {}
}

export class Viewed {
  constructor(
    readonly result: unknown,
    readonly view: AiView,
  ) {}
}

export class ActionDone {
  constructor(
    readonly forModel: unknown,
    readonly audit: ToolAuditTarget,
  ) {}
}

export interface AiTool {
  readonly name: string;
  readonly group: string;
  readonly description: string;
  readonly capability: string | null;
  readonly risk: AiRiskTier | null;
  readonly parameters: Record<string, unknown>;
  execute(actor: AuthenticatedUser, raw: unknown, context: ToolContext): Promise<ToolOutcome>;
}

export interface ToolDefinition<TSchema extends z.ZodType> {
  readonly name: string;
  readonly group?: string;
  readonly description: string;
  readonly capability: string | null;
  readonly risk?: AiRiskTier;
  readonly schema: TSchema;
  run(actor: AuthenticatedUser, args: z.output<TSchema>, context: ToolContext): Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodType>(definition: ToolDefinition<TSchema>): AiTool {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(definition.schema, { io: "input" });

  return {
    name: definition.name,
    group: definition.group ?? TOOL_GROUP[definition.name as AiToolName],
    description: definition.description,
    capability: definition.capability,
    risk: definition.risk ?? null,
    parameters,

    async execute(
      actor: AuthenticatedUser,
      raw: unknown,
      context: ToolContext,
    ): Promise<ToolOutcome> {
      const parsed = definition.schema.safeParse(raw ?? {});

      if (!parsed.success) {
        return {
          ok: false,
          error: AI_TOOL_ERROR.INVALID_ARGUMENTS,
          details: parsed.error.issues.map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          ),
        };
      }

      const result = await definition.run(actor, parsed.data, context);

      if (result instanceof ProposalResult) {
        return { ok: true, data: result.forModel, proposal: result.proposal };
      }

      if (result instanceof Viewed) {
        return { ok: true, data: result.result, view: result.view };
      }

      return result instanceof ActionDone
        ? { ok: true, data: result.forModel, audit: result.audit }
        : { ok: true, data: result };
    },
  };
}

export function capped<TItem>(
  items: readonly TItem[],
  total?: number,
): { items: TItem[]; total?: number; truncated: boolean } {
  return {
    items: items.slice(0, TOOL_ROW_LIMIT),
    ...(total !== undefined && { total }),
    truncated: total === undefined ? items.length > TOOL_ROW_LIMIT : total > TOOL_ROW_LIMIT,
  };
}

export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");

  return digits.length <= 4 ? "****" : `****${digits.slice(-4)}`;
};

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

export function localizeInstants(value: unknown, timeZone: string): unknown {
  if (typeof value === "string") {
    return INSTANT.test(value) ? localClock(new Date(value), timeZone) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => localizeInstants(item, timeZone));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, localizeInstants(item, timeZone)]),
    );
  }

  return value;
}

function localClock(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${read("year")}-${read("month")}-${read("day")} ${read("hour")}:${read("minute")}`;
}
