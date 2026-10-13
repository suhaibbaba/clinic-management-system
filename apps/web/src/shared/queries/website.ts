import {
  CONTACT_MESSAGE_STATUS,
  type ContactMessage,
  type ListContactMessagesQuery,
  type Paginated,
} from "@clinic/shared";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { CONTACT_MESSAGES_KEY } from "@web/shared/constants/query-keys";
import { listContactMessages } from "@web/shared/api/website";

export function useContactMessages(
  params: Partial<ListContactMessagesQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<ContactMessage>> {
  return useQuery({
    queryKey: [CONTACT_MESSAGES_KEY, params],
    queryFn: () => listContactMessages(params),
    placeholderData: (previous) => previous,
    enabled,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

export function useOpenContactMessagesCount(enabled = true): number {
  const query = useContactMessages({ limit: 1, status: CONTACT_MESSAGE_STATUS.OPEN }, enabled);

  return query.data?.total ?? 0;
}
