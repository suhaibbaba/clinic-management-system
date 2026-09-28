import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import { AUDIT_ACTION, type AuthenticatedUserProfile } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { USERS_ENTITY } from "@api/modules/users/constants";
import { UsersService } from "@api/modules/users/services/users.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { UpdateOwnProfileDto, ChangePasswordDto } from "@api/modules/users/dto/me.dto";

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

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(actor, body);
  }
}
