import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Permissions, UpdateRolePermissionInput } from "@clinic/shared";

import { permissionsApi } from "@web/features/permissions/api";

const PERMISSIONS_KEY = "permissions";

export function usePermissions(): UseQueryResult<Permissions> {
  return useQuery({ queryKey: [PERMISSIONS_KEY], queryFn: () => permissionsApi.get() });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateRolePermissionInput) => permissionsApi.update(body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: [PERMISSIONS_KEY] });
      const previous = queryClient.getQueryData<Permissions>([PERMISSIONS_KEY]);

      queryClient.setQueryData<Permissions>([PERMISSIONS_KEY], (current) =>
        current
          ? {
              ...current,
              roles: current.roles.map((role) =>
                role.role === body.role
                  ? { ...role, allows: { ...role.allows, [body.capability]: body.allowed } }
                  : role,
              ),
            }
          : current,
      );

      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData([PERMISSIONS_KEY], context.previous);
      }
    },
  });
}
