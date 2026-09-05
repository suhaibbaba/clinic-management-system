import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from '@api/auth/auth.controller';
import { AuthService } from '@api/auth/auth.service';
import { PasswordService } from '@api/auth/password.service';
import { TokenService } from '@api/auth/token.service';

/**
 * Global because `JwtAuthGuard` is registered application-wide and needs
 * `JwtService`, and because other modules hash passwords when creating users.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [AuthService, PasswordService, TokenService, JwtModule],
})
export class AuthModule {}
