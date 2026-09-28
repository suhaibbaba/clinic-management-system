import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  AiActionsSettings,
  AiPlanInputs,
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
import { assistantApi } from "@web/modules/assistant/api";

export const CONVERSATIONS_KEY = "ai-conversations";
export const MESSAGES_KEY = "ai-messages";
export const PROPOSAL_KEY = "ai-proposal";
export const ACTION_KEY = "ai-action";
export const ACTIONS_SETTINGS_KEY = "ai-actions-settings";
export const PENDING_PROPOSALS_KEY = "ai-proposals-pending";
export const AUTOMATION_SETTINGS_KEY = "ai-automation-settings";
export const OUTBOUND_KEY = "ai-outbound";
export const SECRETS_KEY = "ai-secrets";

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

export function useProposal(id: string, initial?: AiProposal): UseQueryResult<AiProposal> {
  return useQuery({
    queryKey: [PROPOSAL_KEY, id],
    queryFn: () => assistantApi.proposal(id),
    ...(initial && { initialData: initial }),
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

export function applyProposalStatus(client: QueryClient, event: AiProposalStatusEvent): void {
  const apply = (current: AiProposal | undefined): AiProposal | undefined =>
    current
      ? {
          ...current,
          status: event.status,
          sentCount: event.sentCount,
          failedCount: event.failedCount,
          ...(event.result !== undefined && { result: event.result }),
          ...(event.error !== undefined && { error: event.error }),
        }
      : current;

  client.setQueryData<AiProposal>([PROPOSAL_KEY, event.proposalId], apply);
  client.setQueryData<AiProposal>([ACTION_KEY, event.proposalId], apply);
}

export function useAction(id: string, initial?: AiProposal): UseQueryResult<AiProposal> {
  return useQuery({
    queryKey: [ACTION_KEY, id],
    queryFn: () => assistantApi.action(id),
    ...(initial && { initialData: initial }),
    refetchOnWindowFocus: true,
  });
}

export type ActionDecision =
  | {
      readonly id: string;
      readonly decision: "confirm" | "continue";
      readonly typedPhrase?: string;
      readonly inputs?: AiPlanInputs;
    }
  | { readonly id: string; readonly decision: "cancel" };

export function useActionDecision(): UseMutationResult<
  AiProposalStatusEvent,
  Error,
  ActionDecision
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: ActionDecision) =>
      input.decision === "cancel"
        ? assistantApi.cancelAction(input.id)
        : assistantApi.confirmAction(input.id, {
            ...(input.typedPhrase !== undefined && { typedPhrase: input.typedPhrase }),
            ...(input.inputs && { inputs: input.inputs }),
            resume: input.decision === "continue",
          }),
    onSuccess: (event, input) => {
      applyProposalStatus(client, event);
      if (input.decision !== "cancel") {
        void client.invalidateQueries({ queryKey: [ACTION_KEY, input.id] });
      }
    },
    onError: (_error, { id }) => client.invalidateQueries({ queryKey: [ACTION_KEY, id] }),
  });
}

export function useActionsSettings(): UseQueryResult<AiActionsSettings> {
  return useQuery({
    queryKey: [ACTIONS_SETTINGS_KEY],
    queryFn: () => assistantApi.actionsSettings(),
  });
}

export function useSaveActionsSettings(): UseMutationResult<
  AiActionsSettings,
  Error,
  AiActionsSettings
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: AiActionsSettings) => assistantApi.saveActionsSettings(body),
    onSuccess: (saved) => client.setQueryData([ACTIONS_SETTINGS_KEY], saved),
  });
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
