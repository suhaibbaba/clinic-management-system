import { SetMetadata } from "@nestjs/common";
import type { AiRiskTier } from "@clinic/shared";
import type { ToolGroup } from "@api/ai/tools/tool-groups";

export const AI_ROUTE_TOOL = "ai:route-tool";

export interface AiToolOptions {
  readonly group: ToolGroup;
  /** Written for the model: what it does · when to use it · when not (and what instead) · returns. */
  readonly description: string;
  /** A write's tier when the verb's default is wrong for it. The model never chooses one. */
  readonly risk?: AiRiskTier;
  /** Fields the model is never shown — `force`-style overrides a person answers, not a model. */
  readonly exclude?: readonly string[];
}

/**
 * Makes a route one of the assistant's tools. Opt-in: an undecorated route is invisible to it, and
 * `RouteToolRegistry` refuses to boot on one under a controller it must never reach.
 */
export const AiTool = (options: AiToolOptions): MethodDecorator =>
  SetMetadata(AI_ROUTE_TOOL, options);
