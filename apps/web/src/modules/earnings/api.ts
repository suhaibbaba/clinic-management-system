import type { OwnSettlement, SettlementQuery } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const earningsApi = {
  mine: (query: SettlementQuery): Promise<OwnSettlement> => apiRequest("/me/settlement", { query }),
};
