import { z } from "zod";
import { AI_TOOL_ERROR, type AiToolName } from "@clinic/shared";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";

/** Nothing the model asks for returns more than this, whatever it asked for. */
export const TOOL_ROW_LIMIT = 50;

export interface ToolRejection {
  readonly ok: false;
  readonly error: typeof AI_TOOL_ERROR.INVALID_ARGUMENTS;
  /** `field: what was wrong` — enough for the model to retry, and never an internal. */
  readonly details: string[];
}

export type ToolOutcome = { readonly ok: true; readonly data: unknown } | ToolRejection;

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
  /** JSON Schema for the model, derived from the same Zod schema that validates the call. */
  readonly parameters: Record<string, unknown>;
  execute(actor: AuthenticatedUser, raw: unknown): Promise<ToolOutcome>;
}

export interface ToolDefinition<TSchema extends z.ZodType> {
  readonly name: AiToolName;
  readonly description: string;
  readonly capability: string | null;
  readonly schema: TSchema;
  run(actor: AuthenticatedUser, args: z.output<TSchema>): Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodType>(definition: ToolDefinition<TSchema>): AiTool {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(definition.schema, { io: "input" });

  return {
    name: definition.name,
    description: definition.description,
    capability: definition.capability,
    parameters,

    async execute(actor: AuthenticatedUser, raw: unknown): Promise<ToolOutcome> {
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

      return { ok: true, data: await definition.run(actor, parsed.data) };
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
