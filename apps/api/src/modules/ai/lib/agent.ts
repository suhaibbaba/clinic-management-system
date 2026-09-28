import { type ChatUsage } from "@api/modules/ai/lib/chat-provider";
import { z } from "zod";
import { TOOL_GROUP_NAMES } from "@api/modules/ai/tools/tool-groups";

export function add(total: { inputTokens: number; outputTokens: number }, usage: ChatUsage): void {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
}

export function clock(timeZone: string): { now: string; weekday: string } {
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

export const loadToolsSchema = z.object({ groups: z.array(z.enum(TOOL_GROUP_NAMES)).min(1) });

export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
