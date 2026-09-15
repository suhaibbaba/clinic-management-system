import { z } from 'zod';

import { USER_ROLES } from '@shared/enums';

/** One thing the API can be asked to do. Its route and the roles it ships for stay on the server:
 *  a screen names the permission in the reader's language, it does not describe the endpoint. */
export const capabilitySchema = z.object({
  key: z.string(),
  /** The group a screen lists it under — the module the endpoint belongs to. */
  resource: z.string(),
});
export type Capability = z.infer<typeof capabilitySchema>;

export const rolePermissionsSchema = z.object({
  role: z.enum(USER_ROLES),
  /** Every capability the API knows, with this role's answer. */
  allows: z.record(z.string(), z.boolean()),
  /** The admin's are fixed: a clinic that could take a permission from its own administrator
   *  could lock itself out of the only account able to give it back. */
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
