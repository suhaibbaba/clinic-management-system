import { Global, Module } from "@nestjs/common";
import { LoginThrottleService } from "@api/modules/auth/services/login-throttle.service";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "@api/modules/auth/controllers/auth.controller";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { TokenService } from "@api/modules/auth/services/token.service";

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, LoginThrottleService],
  exports: [AuthService, PasswordService, TokenService, JwtModule],
})
export class AuthModule {}
