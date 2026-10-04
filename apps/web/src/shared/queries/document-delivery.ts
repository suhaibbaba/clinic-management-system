import type { DocumentDelivery } from "@clinic/shared";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { documentDeliveryApi } from "@web/shared/api/document-delivery";

const DOCUMENT_DELIVERY_KEY = "document-delivery";

export function useDocumentDelivery(enabled = true): UseQueryResult<DocumentDelivery> {
  return useQuery({
    queryKey: [DOCUMENT_DELIVERY_KEY],
    queryFn: () => documentDeliveryApi.availability(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
