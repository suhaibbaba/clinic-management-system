import type { DocumentDelivery } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const documentDeliveryApi = {
  availability: (): Promise<DocumentDelivery> => apiRequest("/document-delivery"),
};
