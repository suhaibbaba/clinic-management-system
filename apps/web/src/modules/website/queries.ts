import type { ContactMessageStatus, PresignSiteImageInput, SiteContent } from "@clinic/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONTACT_MESSAGES_KEY, WEBSITE_EDITOR_KEY } from "@web/shared/constants/query-keys";
import { uploadToStorage } from "@web/shared/lib/upload";
import { websiteApi } from "@web/modules/website/api";

export function useWebsiteEditor(enabled = true) {
  return useQuery({ queryKey: [WEBSITE_EDITOR_KEY], queryFn: websiteApi.editor, enabled });
}

export function useSaveSiteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: SiteContent) => websiteApi.saveDraft(content),
    onSuccess: (editor) => queryClient.setQueryData([WEBSITE_EDITOR_KEY], editor),
  });
}

export function usePublishSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: SiteContent) => {
      await websiteApi.saveDraft(content);

      return websiteApi.publish();
    },
    onSuccess: (editor) => queryClient.setQueryData([WEBSITE_EDITOR_KEY], editor),
  });
}

export function useUploadSiteImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const presigned = await websiteApi.presignImage({
        filename: file.name,
        mime: file.type as PresignSiteImageInput["mime"],
        sizeBytes: file.size,
      });

      await uploadToStorage(presigned.uploadUrl, file);

      return { key: presigned.key, url: presigned.url };
    },
  });
}

function useMessageMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [CONTACT_MESSAGES_KEY] }),
  });
}

export function useSetContactMessageStatus() {
  return useMessageMutation(({ id, status }: { id: string; status: ContactMessageStatus }) =>
    websiteApi.setMessageStatus(id, status),
  );
}

export function useRemoveContactMessage() {
  return useMessageMutation((id: string) => websiteApi.removeMessage(id));
}
