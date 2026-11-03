import type {
  ContactMessage,
  ContactMessageStatus,
  PresignSiteImageInput,
  PresignSiteImageResponse,
  SiteDocument,
  WebsiteEditor,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const websiteApi = {
  editor: () => apiRequest<WebsiteEditor>("/website"),

  saveDraft: (document: SiteDocument) =>
    apiRequest<WebsiteEditor>("/website/draft", { method: "PUT", body: document }),

  publish: () => apiRequest<WebsiteEditor>("/website/publish", { method: "POST" }),

  presignImage: (body: PresignSiteImageInput) =>
    apiRequest<PresignSiteImageResponse>("/website/images/presign", { method: "POST", body }),

  setMessageStatus: (id: string, status: ContactMessageStatus) =>
    apiRequest<ContactMessage>(`/website/messages/${id}`, { method: "PATCH", body: { status } }),

  removeMessage: (id: string) => apiRequest<void>(`/website/messages/${id}`, { method: "DELETE" }),
};
