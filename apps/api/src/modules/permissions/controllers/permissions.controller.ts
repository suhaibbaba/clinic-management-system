import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from "@nestjs/common";
import { USER_ROLE, USER_ROLES, type Permissions } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { UpdateRolePermissionDto } from "@api/modules/permissions/dto/permissions.dto";

@Controller("permissions")
@Roles(USER_ROLE.ADMIN)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  async list(@CurrentUser() actor: AuthenticatedUser): Promise<Permissions> {
    return {
      capabilities: (await this.permissions.availableCapabilities(actor.clinicId)).map(
        ({ key, resource }) => ({ key, resource }),
      ),
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
