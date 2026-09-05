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
  createUserSchema,
  idParamSchema,
  listUsersQuerySchema,
  resetUserPasswordSchema,
  updateUserSchema,
  USER_ROLE,
  type Paginated,
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

/**
 * Users & roles — admin only, for every verb (ROLES.md core matrix).
 *
 * No handler accepts a `clinicId`: it comes from the caller's token and is
 * applied by `ClinicScopeService` inside the service.
 */
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

  /**
   * Not marked `@Audit(...)`: the trail records old and new values and a
   * password has none that may be stored, so the service writes an explicit
   * "password was reset" entry instead.
   */
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ResetUserPasswordDto,
  ): Promise<void> {
    await this.usersService.resetPassword(actor, params.id, body.newPassword);
  }

  /** Soft delete. */
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
