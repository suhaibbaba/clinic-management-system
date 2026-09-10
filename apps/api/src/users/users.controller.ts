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
} from '@nestjs/common';
import {
  AUDIT_ACTION,
  confirmUserPhotoSchema,
  createUserSchema,
  idParamSchema,
  listUsersQuerySchema,
  presignUserPhotoSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  USER_ROLE,
  type Paginated,
  type PresignUserPhotoResponse,
  type User,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { USERS_ENTITY, UsersService } from '@api/users/users.service';

class CreateUserDto extends createZodDto(createUserSchema) {}
class UpdateUserDto extends createZodDto(updateUserSchema) {}
class ResetUserPasswordDto extends createZodDto(resetUserPasswordSchema) {}
class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class PresignUserPhotoDto extends createZodDto(presignUserPhotoSchema) {}
class ConfirmUserPhotoDto extends createZodDto(confirmUserPhotoSchema) {}

// Admin only, every verb. No handler accepts a `clinicId` — it comes from the token, via
// `ClinicScopeService`.
@Controller('users')
@Roles(USER_ROLE.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<Paginated<User>> {
    return this.usersService.list(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<User> {
    return this.usersService.findOne(actor, params.id);
  }

  @Post()
  @Audit(USERS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateUserDto): Promise<User> {
    return this.usersService.create(actor, body);
  }

  @Patch(':id')
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(actor, params.id, body);
  }

  // Not `@Audit(...)`: a password has no value that may be stored, so the service writes an
  // explicit "password was reset" entry instead.
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ResetUserPasswordDto,
  ): Promise<void> {
    await this.usersService.resetPassword(actor, params.id, body.newPassword);
  }

  @Post(':id/photo/presign')
  @HttpCode(HttpStatus.OK)
  presignPhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PresignUserPhotoDto,
  ): Promise<PresignUserPhotoResponse> {
    return this.usersService.presignPhoto(actor, params.id, body);
  }

  /** Step 2: the bytes are read back from storage and the key is recorded. */
  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE)
  confirmPhoto(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConfirmUserPhotoDto,
  ): Promise<User> {
    return this.usersService.confirmPhoto(actor, params.id, body);
  }

  @Delete(':id/photo')
  @Audit(USERS_ENTITY, AUDIT_ACTION.UPDATE)
  removePhoto(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<User> {
    return this.usersService.removePhoto(actor, params.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(USERS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.usersService.softDelete(actor, params.id);
  }
}
