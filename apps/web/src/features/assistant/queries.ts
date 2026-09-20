import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { AiConversation, AiMessage, Paginated } from "@clinic/shared";
import { assistantApi } from "@web/features/assistant/api";

export const CONVERSATIONS_KEY = "ai-conversations";
export const MESSAGES_KEY = "ai-messages";

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
