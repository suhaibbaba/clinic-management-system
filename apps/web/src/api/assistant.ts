import {
  aiActionsSettingsSchema,
  aiAutomationSettingsSchema,
  aiConversationSchema,
  aiMessageSchema,
  aiOutboundLogEntrySchema,
  aiProposalSchema,
  aiProposalStatusEventSchema,
  clinicSecretsSchema,
  paginatedSchema,
  type AiActionsSettings,
  type AiAutomationSettings,
  type AiChatRequest,
  type AiConversation,
  type AiMessage,
  type AiOutboundLogEntry,
  type AiProposal,
  type AiProposalStatusEvent,
  type ClinicSecrets,
  type ListAiOutboundQuery,
  type Paginated,
  type UpdateClinicSecretsInput,
  type AiPlanInputs,
} from "@clinic/shared";
import { z } from "zod";
import { apiRequest, apiStream } from "@web/lib/api-client";

const listSchema = paginatedSchema(aiConversationSchema);
const messagesSchema = z.array(aiMessageSchema);
const proposalsSchema = paginatedSchema(aiProposalSchema);
const outboundSchema = paginatedSchema(aiOutboundLogEntrySchema);

export const assistantApi = {
  conversations: async (limit: number): Promise<Paginated<AiConversation>> =>
    listSchema.parse(await apiRequest("/ai/conversations", { query: { limit } })),

  messages: async (id: string): Promise<AiMessage[]> =>
    messagesSchema.parse(await apiRequest(`/ai/conversations/${id}`)),

  rename: (id: string, title: string): Promise<AiConversation> =>
    apiRequest<AiConversation>(`/ai/conversations/${id}`, { method: "PATCH", body: { title } }),

  remove: (id: string): Promise<void> =>
    apiRequest<void>(`/ai/conversations/${id}`, { method: "DELETE" }),

  proposal: async (id: string): Promise<AiProposal> =>
    aiProposalSchema.parse(await apiRequest(`/ai/proposals/${id}`)),

  pendingProposals: async (): Promise<Paginated<AiProposal>> =>
    proposalsSchema.parse(
      await apiRequest("/ai/proposals", { query: { status: "draft", limit: 20 } }),
    ),

  actOnProposal: async (id: string, action: "send" | "cancel"): Promise<AiProposalStatusEvent> =>
    aiProposalStatusEventSchema.parse(
      await apiRequest(`/ai/proposals/${id}/${action}`, { method: "POST" }),
    ),

  action: async (id: string): Promise<AiProposal> =>
    aiProposalSchema.parse(await apiRequest(`/ai/actions/${id}`)),

  confirmAction: async (
    id: string,
    options: { typedPhrase?: string; inputs?: AiPlanInputs; resume?: boolean } = {},
  ): Promise<AiProposalStatusEvent> =>
    aiProposalStatusEventSchema.parse(
      await apiRequest(`/ai/proposals/${id}/${options.resume ? "continue" : "confirm"}`, {
        method: "POST",
        body: {
          ...(options.typedPhrase !== undefined && { typedPhrase: options.typedPhrase }),
          ...(options.inputs && { inputs: options.inputs }),
        },
      }),
    ),

  cancelAction: async (id: string): Promise<AiProposalStatusEvent> =>
    aiProposalStatusEventSchema.parse(
      await apiRequest(`/ai/actions/${id}/cancel`, { method: "POST" }),
    ),

  actionsSettings: async (): Promise<AiActionsSettings> =>
    aiActionsSettingsSchema.parse(await apiRequest("/ai/actions/settings")),

  saveActionsSettings: async (body: AiActionsSettings): Promise<AiActionsSettings> =>
    aiActionsSettingsSchema.parse(
      await apiRequest("/ai/actions/settings", { method: "PUT", body }),
    ),

  automationSettings: async (): Promise<AiAutomationSettings> =>
    aiAutomationSettingsSchema.parse(await apiRequest("/ai/automation/settings")),

  saveAutomationSettings: async (body: AiAutomationSettings): Promise<AiAutomationSettings> =>
    aiAutomationSettingsSchema.parse(
      await apiRequest("/ai/automation/settings", { method: "PUT", body }),
    ),

  outbound: async (query: Partial<ListAiOutboundQuery>): Promise<Paginated<AiOutboundLogEntry>> =>
    outboundSchema.parse(await apiRequest("/ai/outbound", { query })),

  secrets: async (): Promise<ClinicSecrets> =>
    clinicSecretsSchema.parse(await apiRequest("/ai/secrets")),

  saveSecrets: async (body: UpdateClinicSecretsInput): Promise<ClinicSecrets> =>
    clinicSecretsSchema.parse(await apiRequest("/ai/secrets", { method: "PUT", body })),

  chat: (body: AiChatRequest, signal: AbortSignal): Promise<Response> =>
    apiStream("/ai/chat", body, signal),
};
