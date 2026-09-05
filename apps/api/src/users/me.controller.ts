import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { changePasswordSchema, type AuthenticatedUserProfile } from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { AuthService } from '@api/auth/auth.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

/**
 * The caller's own account. Available to every role — no `@Roles(...)`, because
 * these only ever read or change the authenticated user's own row.
 */
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getProfile(@CurrentUser() actor: AuthenticatedUser): Promise<AuthenticatedUserProfile> {
    return this.authService.getProfile(actor);
  }

  /**
   * Not audited: the audit trail stores old and new values, and a password
   * change has no value that may be recorded. Every other session for the user
   * is revoked instead.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(actor, body);
  }
}
