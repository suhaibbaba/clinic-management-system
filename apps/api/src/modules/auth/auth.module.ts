import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "@api/modules/auth/controllers/auth.controller";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { TokenService } from "@api/modules/auth/services/token.service";

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [AuthService, PasswordService, TokenService, JwtModule],
})
export class AuthModule {}
