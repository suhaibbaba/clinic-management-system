import { z } from "zod";
import { USER_ROLES } from "@shared/enums";

export const capabilitySchema = z.object({
  key: z.string(),
  resource: z.string(),
});
export type Capability = z.infer<typeof capabilitySchema>;

export const rolePermissionsSchema = z.object({
  role: z.enum(USER_ROLES),
  allows: z.record(z.string(), z.boolean()),
  locked: z.boolean(),
});
export type RolePermissions = z.infer<typeof rolePermissionsSchema>;

export const permissionsSchema = z.object({
  capabilities: z.array(capabilitySchema),
  roles: z.array(rolePermissionsSchema),
});
export type Permissions = z.infer<typeof permissionsSchema>;

export const updateRolePermissionSchema = z.object({
  role: z.enum(USER_ROLES),
  capability: z.string().min(1).max(160),
  allowed: z.boolean(),
});
export type UpdateRolePermissionInput = z.infer<typeof updateRolePermissionSchema>;
