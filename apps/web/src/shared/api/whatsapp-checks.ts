import type { WhatsAppCheck } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const whatsAppChecksApi = {
  find: (phone: string): Promise<WhatsAppCheck> =>
    apiRequest("/whatsapp-checks", { query: { phone } }),
  check: (phone: string): Promise<WhatsAppCheck> =>
    apiRequest("/whatsapp-checks", { method: "POST", body: { phone } }),
};
