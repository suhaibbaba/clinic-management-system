import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "@api/auth/controllers/auth.controller";
import { AuthService } from "@api/auth/services/auth.service";
import { PasswordService } from "@api/auth/services/password.service";
import { TokenService } from "@api/auth/services/token.service";

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  exports: [AuthService, PasswordService, TokenService, JwtModule],
})
export class AuthModule {}
