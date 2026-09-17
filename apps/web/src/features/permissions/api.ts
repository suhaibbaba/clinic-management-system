import type { Permissions, UpdateRolePermissionInput } from "@clinic/shared";

import { apiRequest } from "@web/lib/api-client";

export const permissionsApi = {
  get: (): Promise<Permissions> => apiRequest("/permissions"),

  update: (body: UpdateRolePermissionInput): Promise<void> =>
    apiRequest("/permissions", { method: "PATCH", body }),
};
