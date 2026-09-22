import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AI_MESSAGE_ROLE,
  AI_TOOL,
  AI_TOOL_NAMES,
  AI_TITLE_MAX_LENGTH,
  type AiConversation,
  type AiMessage,
  type AiMessageRole,
  type ListAiConversationsQuery,
  type Paginated,
} from "@clinic/shared";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { ChatMessage, ChatUsage } from "@api/ai/chat-provider";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiConversations, aiMessages } from "@api/database/schema";

/** Tool rows are the model's working: recorded, never replayed and never served. */
const SERVED_ROLES = [AI_MESSAGE_ROLE.USER, AI_MESSAGE_ROLE.ASSISTANT];

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
          or(inArray(aiMessages.role, SERVED_ROLES), isNotNull(aiMessages.proposalId)),
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
  async history(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages.conversationId, conversationId),
          isNull(aiMessages.deletedAt),
          inArray(aiMessages.role, SERVED_ROLES),
          ne(aiMessages.content, ""),
        ),
      )
      .orderBy(desc(aiMessages.createdAt))
      .limit(limit);

    return rows
      .reverse()
      .map((row) =>
        row.role === AI_MESSAGE_ROLE.USER
          ? ({ role: "user", content: row.content } as const)
          : ({ role: "assistant", content: row.content } as const),
      );
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

const toMessage = (row: MessageRow): AiMessage =>
  row.proposalId
    ? {
        id: row.id,
        role: row.role,
        // The envelope stays behind: the card reads the proposal itself, and the tool that drafted
        // it says which card — a message's or an action's.
        content: "",
        toolName: AI_TOOL_NAMES.find((name) => name === row.toolName) ?? AI_TOOL.DRAFT_BULK_MESSAGE,
        proposalId: row.proposalId,
        createdAt: row.createdAt.toISOString(),
      }
    : {
        id: row.id,
        role: row.role,
        content: row.content,
        toolName: null,
        proposalId: null,
        createdAt: row.createdAt.toISOString(),
      };
