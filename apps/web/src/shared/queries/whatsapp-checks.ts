import type { WhatsAppCheck } from "@clinic/shared";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { whatsAppChecksApi } from "@web/shared/api/whatsapp-checks";
import { WHATSAPP_CHECK_KEY } from "@web/shared/constants/query-keys";

const POLL_MS = 1500;

export function useWhatsAppCheck(phone: string | null): UseQueryResult<WhatsAppCheck> {
  return useQuery({
    queryKey: [WHATSAPP_CHECK_KEY, phone],
    queryFn: () => whatsAppChecksApi.find(phone ?? ""),
    enabled: phone !== null,
    refetchInterval: (query) => (query.state.data?.checking === true ? POLL_MS : false),
  });
}

export function useStartWhatsAppCheck(): UseMutationResult<WhatsAppCheck, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phone: string) => whatsAppChecksApi.check(phone),
    onSuccess: (check) => {
      queryClient.setQueryData([WHATSAPP_CHECK_KEY, check.phone], check);
    },
  });
}
