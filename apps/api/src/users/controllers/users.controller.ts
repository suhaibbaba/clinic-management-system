import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  USER_ROLE,
  type Paginated,
  type PresignUserPhotoResponse,
  type User,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { AccountInvitationsService } from "@api/email/services/account-invitations.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { USERS_ENTITY } from "@api/users/constants";
import { UsersService } from "@api/users/services/users.service";
import {
  ListUsersQueryDto,
  IdParamDto,
  CreateUserDto,
  UpdateUserDto,
  ResetUserPasswordDto,
  PresignUserPhotoDto,
  ConfirmUserPhotoDto,
} from "@api/users/dto/users.dto";

@Controller("users")
@Roles(USER_ROLE.ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitations: AccountInvitationsService,
  ) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<Paginated<User>> {
    return this.usersService.list(actor, query);
  }

  @Get(":id")
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<User> {
    return this.usersService.findOne(actor, params.id);
  }

  @Post()
  @Audit(USERS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateUserDto): Promise<User> {
    return this.usersService.create(actor, body);
  }

  @Patch(":id")
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(actor, params.id, body);
  }

  @Post(":id/invite")
  @HttpCode(HttpStatus.NO_CONTENT)
  async invite(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.invitations.invite(params.id, actor.clinicId, "activate");
  }

  @Post(":id/send-password-reset")
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendPasswordReset(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.invitations.invite(params.id, actor.clinicId, "reset");
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ResetUserPasswordDto,
  ): Promise<void> {
    await this.usersService.resetPassword(actor, params.id, body.newPassword);
  }

  @Post(":id/photo/presign")
  @HttpCode(HttpStatus.OK)
  presignPhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PresignUserPhotoDto,
  ): Promise<PresignUserPhotoResponse> {
    return this.usersService.presignPhoto(actor, params.id, body);
  }

  @Post(":id/photo")
  @HttpCode(HttpStatus.OK)
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE)
  confirmPhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConfirmUserPhotoDto,
  ): Promise<User> {
    return this.usersService.confirmPhoto(actor, params.id, body);
  }

  @Delete(":id/photo")
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE)
  removePhoto(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<User> {
    return this.usersService.removePhoto(actor, params.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(USERS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.usersService.softDelete(actor, params.id);
  }
}
