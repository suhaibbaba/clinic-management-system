import type { ContactMessage, ListContactMessagesQuery, Paginated } from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";
import { toQueryString } from "@web/shared/lib/query-string";

export const listContactMessages = (params: Partial<ListContactMessagesQuery> = {}) =>
  apiRequest<Paginated<ContactMessage>>(`/website/messages${toQueryString(params)}`);
