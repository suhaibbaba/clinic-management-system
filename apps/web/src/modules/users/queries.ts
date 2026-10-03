import { DOCTORS_KEY, USERS_KEY } from "@web/shared/constants/query-keys";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { CreateUserInput, PresignUserPhotoInput, UpdateUserInput, User } from "@clinic/shared";
import { useSession } from "@web/shared/providers/session";
import { uploadToStorage } from "@web/shared/lib/upload";
import { usersApi } from "@web/modules/users/api";

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateUserInput) => usersApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useUser(id: string | null, enabled: boolean): UseQueryResult<User> {
  return useQuery({
    queryKey: [USERS_KEY, "one", id],
    queryFn: () => usersApi.get(id ?? ""),
    enabled: enabled && id !== null,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateStaff();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserInput }) => usersApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersApi.invite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useSendPasswordReset() {
  return useMutation({ mutationFn: (id: string) => usersApi.sendPasswordReset(id) });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] }),
      ]);
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, { newPassword }),
  });
}

export function useUploadUserPhoto() {
  const invalidate = useInvalidateStaff();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }): Promise<User> => {
      const presigned = await usersApi.presignPhoto(id, {
        filename: file.name,
        mime: file.type as PresignUserPhotoInput["mime"],
        sizeBytes: file.size,
      });

      await uploadToStorage(presigned.uploadUrl, file);

      return usersApi.confirmPhoto(id, presigned.key);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveUserPhoto() {
  const invalidate = useInvalidateStaff();

  return useMutation({
    mutationFn: (id: string) => usersApi.removePhoto(id),
    onSuccess: invalidate,
  });
}

function useInvalidateStaff(): () => void {
  const queryClient = useQueryClient();
  const { refreshProfile } = useSession();

  return () => {
    void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    void queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] });
    void refreshProfile();
  };
}
