import { type AiStreamEvent } from "@clinic/shared";

export const frame = (event: AiStreamEvent): string => `data: ${JSON.stringify(event)}\n\n`;
