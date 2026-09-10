import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  PresignUserPhotoInput,
  UpdateUserInput,
  User,
} from '@clinic/shared';

import { useSession } from '@web/features/auth/session';
import { uploadToStorage } from '@web/features/patients/api';
import { usersApi } from '@web/features/users/api';

const USERS_KEY = 'users';
/** The doctors list draws the same faces, so it is stale after a photo changes. */
const DOCTORS_KEY = 'doctors';

export function useUsers(query: Partial<ListUsersQuery>): UseQueryResult<Paginated<User>> {
  return useQuery({
    queryKey: [USERS_KEY, query],
    queryFn: () => usersApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateUserInput) => usersApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserInput }) => usersApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, { newPassword }),
  });
}

export function useUploadUserPhoto() {
  const invalidate = useInvalidatePhotos();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }): Promise<User> => {
      const presigned = await usersApi.presignPhoto(id, {
        filename: file.name,
        mime: file.type as PresignUserPhotoInput['mime'],
        sizeBytes: file.size,
      });

      await uploadToStorage(presigned.uploadUrl, file);

      return usersApi.confirmPhoto(id, presigned.key);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveUserPhoto() {
  const invalidate = useInvalidatePhotos();

  return useMutation({
    mutationFn: (id: string) => usersApi.removePhoto(id),
    onSuccess: invalidate,
  });
}

// Three places hold a face, and the profile is session state rather than a query. Refreshing only
// the one on screen is how a photo stays old in the sidebar.
function useInvalidatePhotos(): () => void {
  const queryClient = useQueryClient();
  const { refreshProfile } = useSession();

  return () => {
    void queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    void queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] });
    void refreshProfile();
  };
}
