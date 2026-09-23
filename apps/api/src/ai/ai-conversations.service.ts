import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AI_MESSAGE_ROLE,
  AI_TOOL,
  AI_TOOL_NAMES,
  AI_TITLE_MAX_LENGTH,
  type AiConversation,
  type AiMessage,
  type AiMessageRole,
  type AiView,
  type ListAiConversationsQuery,
  type Paginated,
} from "@clinic/shared";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { ChatMessage, ChatUsage } from "@api/ai/chat-provider";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiConversations, aiMessages, aiProposals } from "@api/database/schema";

/** Tool rows are the model's working: recorded, never replayed and never served. */
const SERVED_ROLES = [AI_MESSAGE_ROLE.USER, AI_MESSAGE_ROLE.ASSISTANT];
const REPLAYED_ROLES = [...SERVED_ROLES, AI_MESSAGE_ROLE.TOOL];

/** A long listing replayed whole would crowd out the conversation it belongs to. */
const REPLAY_MAX_CHARS = 4000;

function replayed(
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
    } catch {
      // Not ours to reshape; replayed as it was stored.
    }
  }

  return text.length > REPLAY_MAX_CHARS
    ? `${text.slice(0, REPLAY_MAX_CHARS)}… (cut here; call the tool again for the rest)`
    : text;
}

type ConversationRow = typeof aiConversations.$inferSelect;
type MessageRow = typeof aiMessages.$inferSelect;

export interface AppendedMessage {
  readonly id: string;
}

// A conversation is the caller's own, admin included: it quotes back whatever that person was
// allowed to read, and the role check that let them read it was theirs, not somebody else's.
@Injectable()
export class AiConversationsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(
    actor: AuthenticatedUser,
    query: ListAiConversationsQuery,
  ): Promise<Paginated<AiConversation>> {
    const where = this.ownScope(actor);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(aiConversations)
        .where(where)
        .orderBy(desc(aiConversations.updatedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(aiConversations)
        .where(where),
    ]);

    return toPaginated(rows.map(toConversation), totals?.value ?? 0, query);
  }

  // The thread as a person reads it. Tool rows are kept for the audit trail but never served: they
  // are the model's working, and they carry records in a shape no screen checked. The one that
  // drafted a proposal is served empty, as the place its confirmation card goes.
  async messages(actor: AuthenticatedUser, conversationId: string): Promise<AiMessage[]> {
    await this.requireOwn(actor, conversationId);

    const rows = await this.db
      .select()
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages.conversationId, conversationId),
          isNull(aiMessages.deletedAt),
          or(
            inArray(aiMessages.role, SERVED_ROLES),
            isNotNull(aiMessages.proposalId),
            isNotNull(aiMessages.view),
          ),
          // A turn that failed leaves an empty assistant row carrying only its token cost.
          ne(aiMessages.content, ""),
        ),
      )
      .orderBy(asc(aiMessages.createdAt));

    return rows.map(toMessage);
  }

  async rename(
    actor: AuthenticatedUser,
    conversationId: string,
    title: string,
  ): Promise<AiConversation> {
    await this.requireOwn(actor, conversationId);

    const [row] = await this.db
      .update(aiConversations)
      .set({ title, updatedAt: new Date(), updatedBy: actor.id })
      .where(this.ownScope(actor, conversationId))
      .returning();

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return toConversation(row);
  }

  /** Soft delete, and its messages with it — nothing here is ever removed. */
  async softDelete(actor: AuthenticatedUser, conversationId: string): Promise<void> {
    await this.requireOwn(actor, conversationId);

    const deletedAt = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(aiConversations)
        .set({ deletedAt, updatedBy: actor.id })
        .where(this.ownScope(actor, conversationId));
      await tx
        .update(aiMessages)
        .set({ deletedAt, updatedBy: actor.id })
        .where(and(eq(aiMessages.conversationId, conversationId), isNull(aiMessages.deletedAt)));
    });
  }

  async requireOwn(actor: AuthenticatedUser, conversationId: string): Promise<ConversationRow> {
    const [row] = await this.db
      .select()
      .from(aiConversations)
      .where(this.ownScope(actor, conversationId))
      .limit(1);

    if (!row) {
      // Somebody else's conversation is a 404, like another clinic's row: a 403 confirms it exists.
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  async start(actor: AuthenticatedUser, firstMessage: string): Promise<ConversationRow> {
    const [row] = await this.db
      .insert(aiConversations)
      .values({
        clinicId: actor.clinicId,
        userId: actor.id,
        title: titleFrom(firstMessage),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to open the conversation");
    }

    return row;
  }

  async append(
    actor: AuthenticatedUser,
    conversationId: string,
    message: {
      role: AiMessageRole;
      content: string;
      toolName?: string;
      usage?: ChatUsage;
      promptVersion?: number;
      proposalId?: string;
      view?: AiView;
    },
  ): Promise<AppendedMessage> {
    const [row] = await this.db
      .insert(aiMessages)
      .values({
        clinicId: actor.clinicId,
        conversationId,
        role: message.role,
        content: message.content,
        toolName: message.toolName ?? null,
        inputTokens: message.usage?.inputTokens ?? null,
        outputTokens: message.usage?.outputTokens ?? null,
        promptVersion: message.promptVersion ?? null,
        proposalId: message.proposalId ?? null,
        view: message.view ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: aiMessages.id });

    if (!row) {
      throw new Error("Failed to record the message");
    }

    await this.db
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, conversationId));

    return row;
  }

  // What the model is shown of what came before: the last N turns, oldest first. Tool rows are
  // left out — replaying one without the call that asked for it is not a valid transcript, and
  // the answer it produced is already in the assistant row beside it.
  // What the model worked with, replayed: its tool results, so an id found three messages ago is
  // not looked up again, and each card's outcome, so it knows what a confirmation actually did.
  async history(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const rows = (
      await this.db
        .select()
        .from(aiMessages)
        .where(
          and(
            eq(aiMessages.conversationId, conversationId),
            isNull(aiMessages.deletedAt),
            inArray(aiMessages.role, REPLAYED_ROLES),
            ne(aiMessages.content, ""),
          ),
        )
        .orderBy(desc(aiMessages.createdAt))
        .limit(limit)
    ).reverse();

    // The cut can land inside a turn; a thread that opens on a tool result is one the model rejects.
    const first = rows.findIndex((row) => row.role === AI_MESSAGE_ROLE.USER);
    const kept = first === -1 ? [] : rows.slice(first);
    const outcomes = await this.cardOutcomes(kept);
    const messages: ChatMessage[] = [];
    let calls: { id: string; name: string; content: string }[] = [];

    const flush = (): void => {
      if (calls.length === 0) {
        return;
      }

      messages.push({
        role: "assistant",
        content: "",
        toolCalls: calls.map((call) => ({ id: call.id, name: call.name, arguments: "{}" })),
      });

      for (const call of calls) {
        messages.push({ role: "tool", toolCallId: call.id, content: call.content });
      }

      calls = [];
    };

    for (const row of kept) {
      if (row.role === AI_MESSAGE_ROLE.TOOL) {
        calls.push({
          id: `replay_${row.id}`,
          name: row.toolName ?? "tool",
          content: replayed(row.content, row.proposalId ? outcomes.get(row.proposalId) : undefined),
        });
        continue;
      }

      flush();
      messages.push(
        row.role === AI_MESSAGE_ROLE.USER
          ? { role: "user", content: row.content }
          : { role: "assistant", content: row.content },
      );
    }

    flush();

    return messages;
  }

  private async cardOutcomes(
    rows: readonly { proposalId: string | null }[],
  ): Promise<Map<string, { status: string; error: string | null }>> {
    const ids = rows.flatMap((row) => (row.proposalId ? [row.proposalId] : []));

    if (ids.length === 0) {
      return new Map();
    }

    const proposals = await this.db
      .select({ id: aiProposals.id, status: aiProposals.status, error: aiProposals.errorCode })
      .from(aiProposals)
      .where(inArray(aiProposals.id, ids));

    return new Map(proposals.map((row) => [row.id, { status: row.status, error: row.error }]));
  }

  private ownScope(actor: AuthenticatedUser, conversationId?: string) {
    return and(
      eq(aiConversations.clinicId, actor.clinicId),
      eq(aiConversations.userId, actor.id),
      isNull(aiConversations.deletedAt),
      ...(conversationId ? [eq(aiConversations.id, conversationId)] : []),
    );
  }
}

// The first line of the question, which is what a person recognises the thread by. Renaming it is
// an edit away.
function titleFrom(message: string): string {
  const flattened = message.replace(/\s+/g, " ").trim();

  return flattened.length > AI_TITLE_MAX_LENGTH
    ? `${flattened.slice(0, AI_TITLE_MAX_LENGTH - 1)}…`
    : flattened;
}

const toConversation = (row: ConversationRow): AiConversation => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// A tool row is served only for what the page draws from it — a card, or a table — and never with
// its envelope, which is what the model read.
const toMessage = (row: MessageRow): AiMessage =>
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
