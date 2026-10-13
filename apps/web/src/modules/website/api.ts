import type {
  ContactMessage,
  ContactMessageStatus,
  PresignSiteImageInput,
  PresignSiteImageResponse,
  SiteContent,
  WebsiteEditor,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const websiteApi = {
  editor: () => apiRequest<WebsiteEditor>("/website"),

  saveDraft: (content: SiteContent) =>
    apiRequest<WebsiteEditor>("/website/draft", { method: "PUT", body: content }),

  publish: () => apiRequest<WebsiteEditor>("/website/publish", { method: "POST" }),

  presignImage: (body: PresignSiteImageInput) =>
    apiRequest<PresignSiteImageResponse>("/website/images/presign", { method: "POST", body }),

  setMessageStatus: (id: string, status: ContactMessageStatus) =>
    apiRequest<ContactMessage>(`/website/messages/${id}`, { method: "PATCH", body: { status } }),

  removeMessage: (id: string) => apiRequest<void>(`/website/messages/${id}`, { method: "DELETE" }),
};
