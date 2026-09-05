import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  type AuthTokens,
  type LoginResponse,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { AuthService } from '@api/auth/auth.service';
import { Public } from '@api/common/decorators/public.decorator';

class LoginDto extends createZodDto(loginSchema) {}
class RefreshDto extends createZodDto(refreshSchema) {}
class LogoutDto extends createZodDto(logoutSchema) {}

/**
 * Session endpoints. All three are `@Public()`: they are how a caller obtains
 * or discards credentials, so they cannot require one.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(body.refreshToken);
  }

  /**
   * Public and idempotent: a client whose access token has already expired must
   * still be able to discard its refresh token.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: LogoutDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }
}
