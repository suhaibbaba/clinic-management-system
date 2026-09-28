import {
  AI_MESSAGE_ROLE,
  AI_TITLE_MAX_LENGTH,
  type AiConversation,
  type AiMessage,
  AI_TOOL_NAMES,
  AI_TOOL,
} from "@clinic/shared";
import { REPLAY_MAX_CHARS, REPLAYED_RESULTS, REPLAY_BUDGET_CHARS } from "@api/modules/ai/constants";
import { aiConversations, aiMessages } from "@api/database/schema";

export function replayable<TRow extends { role: string; content: string }>(rows: TRow[]): TRow[] {
  const keep = new Set<TRow>();
  let spent = 0;

  for (const row of [...rows].reverse()) {
    if (row.role !== AI_MESSAGE_ROLE.TOOL) {
      continue;
    }

    const size = Math.min(row.content.length, REPLAY_MAX_CHARS);

    if (keep.size === REPLAYED_RESULTS || spent + size > REPLAY_BUDGET_CHARS) {
      break;
    }

    keep.add(row);
    spent += size;
  }

  return rows.filter((row) => row.role !== AI_MESSAGE_ROLE.TOOL || keep.has(row));
}

export function replayed(
  content: string,
  outcome: { status: string; error: string | null } | undefined,
): string {
  let text = content;

  if (outcome) {
    try {
      const envelope = JSON.parse(content) as Record<string, unknown>;

      text = JSON.stringify({
        ...envelope,
        card_outcome: { status: outcome.status, ...(outcome.error && { error: outcome.error }) },
      });
    } catch {}
  }

  return text.length > REPLAY_MAX_CHARS
    ? `${text.slice(0, REPLAY_MAX_CHARS)}… (cut here; call the tool again for the rest)`
    : text;
}

export type ConversationRow = typeof aiConversations.$inferSelect;

export type MessageRow = typeof aiMessages.$inferSelect;

export interface AppendedMessage {
  readonly id: string;
}

export function titleFrom(message: string): string {
  const flattened = message.replace(/\s+/g, " ").trim();

  return flattened.length > AI_TITLE_MAX_LENGTH
    ? `${flattened.slice(0, AI_TITLE_MAX_LENGTH - 1)}…`
    : flattened;
}

export const toConversation = (row: ConversationRow): AiConversation => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toMessage = (row: MessageRow): AiMessage =>
  row.proposalId || row.view
    ? {
        id: row.id,
        role: row.role,
        content: "",
        toolName: AI_TOOL_NAMES.find((name) => name === row.toolName) ?? AI_TOOL.DRAFT_BULK_MESSAGE,
        proposalId: row.proposalId,
        view: row.view,
        createdAt: row.createdAt.toISOString(),
      }
    : {
        id: row.id,
        role: row.role,
        content: row.content,
        toolName: null,
        proposalId: null,
        view: null,
        createdAt: row.createdAt.toISOString(),
      };
