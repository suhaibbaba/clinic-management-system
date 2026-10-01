import { Global, Module } from "@nestjs/common";
import { LoginThrottleService } from "@api/modules/auth/services/login-throttle.service";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "@api/modules/auth/controllers/auth.controller";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { TokenService } from "@api/modules/auth/services/token.service";
import { LoginCodeService } from "@api/modules/auth/services/login-code.service";
import { PasskeyService } from "@api/modules/auth/services/passkey.service";
import { GoogleAuthService } from "@api/modules/auth/services/google-auth.service";
import { GoogleAuthController } from "@api/modules/auth/controllers/google-auth.controller";
import { PasskeysController } from "@api/modules/auth/controllers/passkeys.controller";

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, GoogleAuthController, PasskeysController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    LoginThrottleService,
    LoginCodeService,
    PasskeyService,
    GoogleAuthService,
  ],
  exports: [AuthService, PasswordService, TokenService, JwtModule],
})
export class AuthModule {}
