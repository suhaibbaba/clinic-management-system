import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { OwnSettlement, SettlementQuery } from "@clinic/shared";
import { earningsApi } from "@web/modules/earnings/api";

const EARNINGS_KEY = "my-earnings";

export function useMyEarnings(
  query: SettlementQuery,
  enabled: boolean,
): UseQueryResult<OwnSettlement> {
  return useQuery({
    queryKey: [EARNINGS_KEY, query.from, query.to, query.status ?? null],
    queryFn: () => earningsApi.mine(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}
