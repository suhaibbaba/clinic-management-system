import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  updateRolePermissionSchema,
  USER_ROLE,
  USER_ROLES,
  type Permissions,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import { CapabilityRegistry } from '@api/permissions/capability-registry.service';
import { PermissionsService } from '@api/permissions/permissions.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class UpdateRolePermissionDto extends createZodDto(updateRolePermissionSchema) {}

// Who may edit permissions is itself a permission nobody but an admin holds, and it is not one of
// the editable ones: the guard lets an admin through before it reads a single stored row.
@Controller('permissions')
@Roles(USER_ROLE.ADMIN)
export class PermissionsController {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(@CurrentUser() actor: AuthenticatedUser): Promise<Permissions> {
    return {
      capabilities: this.registry.all().map(({ key, resource }) => ({ key, resource })),
      roles: await Promise.all(
        USER_ROLES.map(async (role) => ({
          role,
          allows: await this.permissions.matrix(actor.clinicId, role),
          locked: role === USER_ROLE.ADMIN,
        })),
      ),
    };
  }

  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: UpdateRolePermissionDto,
  ): Promise<void> {
    await this.permissions.set(actor.clinicId, body.role, body.capability, body.allowed, actor.id);
  }
}
