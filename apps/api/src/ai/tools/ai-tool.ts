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

/** Nothing the model asks for returns more than this, whatever it asked for. */
export const TOOL_ROW_LIMIT = 50;

export interface ToolRejection {
  readonly ok: false;
  readonly error: typeof AI_TOOL_ERROR.INVALID_ARGUMENTS;
  /** `field: what was wrong` — enough for the model to retry, and never an internal. */
  readonly details: string[];
}

/** The row an action changed, for the assistant's own audit row beside the domain's entry. */
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

/** A tool declining to run, with the code the model is told. Never carries an internal. */
export class ToolRefusal extends Error {
  constructor(readonly code: AiToolError) {
    super(code);
    this.name = "ToolRefusal";
  }
}

/** Where the call was made. Server-side, like the actor: the model supplies neither. */
export interface ToolContext {
  readonly conversationId: string;
}

/** What a drafting tool returns: the proposal for the card, and the little the model is told. */
export class ProposalResult {
  constructor(
    readonly proposal: AiProposal,
    readonly forModel: unknown,
  ) {}
}

/** A result the page also draws: the model is handed `result`, never `view`. */
export class Viewed {
  constructor(
    readonly result: unknown,
    readonly view: AiView,
  ) {}
}

/** What an action that ran inside the call returns: what the model is told, and what changed. */
export class ActionDone {
  constructor(
    readonly forModel: unknown,
    readonly audit: ToolAuditTarget,
  ) {}
}

// Type-erased on purpose: the registry holds one array of these, and each tool's own argument type
// survives inside `defineTool`, which is the only place that casts nothing.
export interface AiTool {
  readonly name: AiToolName;
  readonly description: string;
  /**
   * The capability key of the endpoint this mirrors, or null where that endpoint is open to
   * everybody signed in. The clinic's own permission matrix decides, so the assistant can never
   * read what the screen would refuse.
   */
  readonly capability: string | null;
  /**
   * The tier the code gives an action, which a clinic or the call itself may only raise. Null on
   * a tool that reads.
   */
  readonly risk: AiRiskTier | null;
  /** JSON Schema for the model, derived from the same Zod schema that validates the call. */
  readonly parameters: Record<string, unknown>;
  execute(actor: AuthenticatedUser, raw: unknown, context: ToolContext): Promise<ToolOutcome>;
}

export interface ToolDefinition<TSchema extends z.ZodType> {
  readonly name: AiToolName;
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

// Caps a list and says so, rather than handing the model a table and a wrong total. `total` is
// passed only by a paginated source that knows one — an unpaginated caller asks for one row more
// than it will show, and the extra is what says there were more.
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

// Data minimization: the model is answering "who is coming tomorrow", not dialling anybody. The
// last four digits are enough for a human to recognise the record they meant.
export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");

  return digits.length <= 4 ? "****" : `****${digits.slice(-4)}`;
};

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

// The model reads the clinic's wall clock, never UTC: handed `07:00Z` it booked 07:00 for a patient
// due at 10:00. Every instant in a result becomes `YYYY-MM-DD HH:MM` in the clinic's own zone.
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
