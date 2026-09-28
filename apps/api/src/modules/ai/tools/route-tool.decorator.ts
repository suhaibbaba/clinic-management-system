import { SetMetadata } from "@nestjs/common";
import type { AiRiskTier } from "@clinic/shared";
import type { ToolGroup } from "@api/modules/ai/tools/tool-groups";

export const AI_ROUTE_TOOL = "ai:route-tool";

export interface AiToolOptions {
  readonly group: ToolGroup;
  readonly description: string;
  readonly risk?: AiRiskTier;
  readonly exclude?: readonly string[];
}

export const AiTool = (options: AiToolOptions): MethodDecorator =>
  SetMetadata(AI_ROUTE_TOOL, options);
