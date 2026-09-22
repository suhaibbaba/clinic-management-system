import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  AiAutomationSettings,
  AiConversation,
  AiMessage,
  AiOutboundLogEntry,
  AiProposal,
  AiProposalStatusEvent,
  ClinicSecrets,
  ListAiOutboundQuery,
  Paginated,
  UpdateClinicSecretsInput,
} from "@clinic/shared";
import { assistantApi } from "@web/features/assistant/api";

export const CONVERSATIONS_KEY = "ai-conversations";
export const MESSAGES_KEY = "ai-messages";
export const PROPOSAL_KEY = "ai-proposal";
export const PENDING_PROPOSALS_KEY = "ai-proposals-pending";
export const AUTOMATION_SETTINGS_KEY = "ai-automation-settings";
export const OUTBOUND_KEY = "ai-outbound";
export const SECRETS_KEY = "ai-secrets";

/** The rail is a recent list, not an archive: older conversations are reached by their address. */
export const CONVERSATIONS_LIMIT = 30;

export function useConversations(): UseQueryResult<Paginated<AiConversation>> {
  return useQuery({
    queryKey: [CONVERSATIONS_KEY],
    queryFn: () => assistantApi.conversations(CONVERSATIONS_LIMIT),
    placeholderData: (previous) => previous,
  });
}

export function useConversationMessages(id: string | undefined): UseQueryResult<AiMessage[]> {
  return useQuery({
    queryKey: [MESSAGES_KEY, id],
    queryFn: () => assistantApi.messages(id ?? ""),
    enabled: id !== undefined,
    // The live turn is what moves while a question is being answered; a refetch underneath it
    // would draw the same question twice.
    refetchOnWindowFocus: false,
  });
}

export function useRenameConversation(): UseMutationResult<
  AiConversation,
  Error,
  { id: string; title: string }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => assistantApi.rename(id, title),
    onSuccess: () => client.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] }),
  });
}

export function useDeleteConversation(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assistantApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] }),
  });
}

/** Seeded from the stream's frame, so a card the turn just drafted draws without a request. */
export function useProposal(id: string, initial?: AiProposal): UseQueryResult<AiProposal> {
  return useQuery({
    queryKey: [PROPOSAL_KEY, id],
    queryFn: () => assistantApi.proposal(id),
    ...(initial && { initialData: initial }),
    // A draft goes stale by the clock, not by a write: re-read it when somebody comes back.
    refetchOnWindowFocus: true,
  });
}

export function usePendingProposals(enabled: boolean): UseQueryResult<Paginated<AiProposal>> {
  return useQuery({
    queryKey: [PENDING_PROPOSALS_KEY],
    queryFn: () => assistantApi.pendingProposals(),
    enabled,
  });
}

/** The one place a status frame lands, whether the stream or a button delivered it. */
export function applyProposalStatus(client: QueryClient, event: AiProposalStatusEvent): void {
  client.setQueryData<AiProposal>([PROPOSAL_KEY, event.proposalId], (current) =>
    current
      ? {
          ...current,
          status: event.status,
          sentCount: event.sentCount,
          failedCount: event.failedCount,
        }
      : current,
  );
}

export function useProposalAction(): UseMutationResult<
  AiProposalStatusEvent,
  Error,
  { id: string; action: "send" | "cancel" }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }) => assistantApi.actOnProposal(id, action),
    onSuccess: (event) => {
      applyProposalStatus(client, event);
      void client.invalidateQueries({ queryKey: [PENDING_PROPOSALS_KEY] });
      void client.invalidateQueries({ queryKey: [OUTBOUND_KEY] });
    },
    // A refusal may mean the row moved underneath the card — expired, or sent from another tab.
    onError: (_error, { id }) => client.invalidateQueries({ queryKey: [PROPOSAL_KEY, id] }),
  });
}

export function useAutomationSettings(): UseQueryResult<AiAutomationSettings> {
  return useQuery({
    queryKey: [AUTOMATION_SETTINGS_KEY],
    queryFn: () => assistantApi.automationSettings(),
  });
}

export function useSaveAutomationSettings(): UseMutationResult<
  AiAutomationSettings,
  Error,
  AiAutomationSettings
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: AiAutomationSettings) => assistantApi.saveAutomationSettings(body),
    onSuccess: (saved) => client.setQueryData([AUTOMATION_SETTINGS_KEY], saved),
  });
}

export function useOutboundLog(
  query: Partial<ListAiOutboundQuery>,
): UseQueryResult<Paginated<AiOutboundLogEntry>> {
  return useQuery({
    queryKey: [OUTBOUND_KEY, query],
    queryFn: () => assistantApi.outbound(query),
    placeholderData: (previous) => previous,
  });
}

export function useClinicSecrets(): UseQueryResult<ClinicSecrets> {
  return useQuery({ queryKey: [SECRETS_KEY], queryFn: () => assistantApi.secrets() });
}

export function useSaveClinicSecrets(): UseMutationResult<
  ClinicSecrets,
  Error,
  UpdateClinicSecretsInput
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateClinicSecretsInput) => assistantApi.saveSecrets(body),
    onSuccess: (saved) => client.setQueryData([SECRETS_KEY], saved),
  });
}
