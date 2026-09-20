import {
  aiConversationSchema,
  aiMessageSchema,
  paginatedSchema,
  type AiChatRequest,
  type AiConversation,
  type AiMessage,
  type Paginated,
} from "@clinic/shared";
import { z } from "zod";
import { apiRequest, apiStream } from "@web/lib/api-client";

const listSchema = paginatedSchema(aiConversationSchema);
const messagesSchema = z.array(aiMessageSchema);

export const assistantApi = {
  conversations: async (limit: number): Promise<Paginated<AiConversation>> =>
    listSchema.parse(await apiRequest("/ai/conversations", { query: { limit } })),

  messages: async (id: string): Promise<AiMessage[]> =>
    messagesSchema.parse(await apiRequest(`/ai/conversations/${id}`)),

  rename: (id: string, title: string): Promise<AiConversation> =>
    apiRequest<AiConversation>(`/ai/conversations/${id}`, { method: "PATCH", body: { title } }),

  remove: (id: string): Promise<void> =>
    apiRequest<void>(`/ai/conversations/${id}`, { method: "DELETE" }),

  /** The streamed turn. The caller reads frames off the response; nothing is parsed here. */
  chat: (body: AiChatRequest, signal: AbortSignal): Promise<Response> =>
    apiStream("/ai/chat", body, signal),
};
