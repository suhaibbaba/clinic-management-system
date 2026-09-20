import { z } from "zod";
import { AI_ERROR_CODES, AI_MESSAGE_ROLES, AI_STREAM_EVENT, AI_TOOL_NAMES } from "@shared/enums";
import { paginationQuerySchema, uuidSchema } from "@shared/schemas/common";

/** A question, not a document: anything longer is a paste the agent has no use for. */
export const AI_MESSAGE_MAX_LENGTH = 2000;
export const AI_TITLE_MAX_LENGTH = 120;

export const aiChatRequestSchema = z.object({
  /** Omitted starts a conversation; the stream's first frame carries the new id. */
  conversationId: uuidSchema.optional(),
  message: z.string().trim().min(1).max(AI_MESSAGE_MAX_LENGTH),
});
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

export const aiConversationSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AiConversation = z.infer<typeof aiConversationSchema>;

export const aiMessageSchema = z.object({
  id: uuidSchema,
  role: z.enum(AI_MESSAGE_ROLES),
  content: z.string(),
  /** Set on a `tool` row only: which tool answered. */
  toolName: z.enum(AI_TOOL_NAMES).nullable(),
  createdAt: z.iso.datetime(),
});
export type AiMessage = z.infer<typeof aiMessageSchema>;

export const listAiConversationsQuerySchema = paginationQuerySchema;
export type ListAiConversationsQuery = z.infer<typeof listAiConversationsQuerySchema>;

export const renameAiConversationSchema = z.object({
  title: z.string().trim().min(1).max(AI_TITLE_MAX_LENGTH),
});
export type RenameAiConversationInput = z.infer<typeof renameAiConversationSchema>;

// The SSE frames, as a union so the web exhausts them. Nothing here is a user-facing string: a
// failure is a code and the front end writes the Arabic (CLAUDE.md).
export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(AI_STREAM_EVENT.CONVERSATION), conversationId: uuidSchema }),
  z.object({ type: z.literal(AI_STREAM_EVENT.TOOL), tool: z.enum(AI_TOOL_NAMES) }),
  z.object({ type: z.literal(AI_STREAM_EVENT.DELTA), text: z.string() }),
  z.object({ type: z.literal(AI_STREAM_EVENT.DONE), messageId: uuidSchema }),
  z.object({ type: z.literal(AI_STREAM_EVENT.ERROR), code: z.enum(AI_ERROR_CODES) }),
]);
export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;
