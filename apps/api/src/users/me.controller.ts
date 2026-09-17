import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import {
  AUDIT_ACTION,
  changePasswordSchema,
  updateOwnProfileSchema,
  type AuthenticatedUserProfile,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";

import { Audit } from "@api/common/decorators/audit.decorator";
import { AuthService } from "@api/auth/auth.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { USERS_ENTITY, UsersService } from "@api/users/users.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";

class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
class UpdateOwnProfileDto extends createZodDto(updateOwnProfileSchema) {}

/** No `@Roles(...)`: these only ever read or change the authenticated user's own row. */
@Controller("me")
export class MeController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getProfile(@CurrentUser() actor: AuthenticatedUser): Promise<AuthenticatedUserProfile> {
    return this.authService.getProfile(actor);
  }

  @Patch()
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "actor" })
  async updateProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: UpdateOwnProfileDto,
  ): Promise<AuthenticatedUserProfile> {
    await this.usersService.update(actor, actor.id, body);

    return this.authService.getProfile(actor);
  }

  // Not audited: the trail stores old and new values, and a password has none that may be recorded.
  // Every other session is revoked instead.
  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(actor, body);
  }
}
