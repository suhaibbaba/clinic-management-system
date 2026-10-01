import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { type Passkey, type PasskeyChallenge } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { IdParamDto, RegisterPasskeyDto } from "@api/modules/auth/dto/auth.dto";
import { PasskeyService } from "@api/modules/auth/services/passkey.service";

@Controller("me/passkeys")
export class PasskeysController {
  constructor(private readonly passkeys: PasskeyService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser): Promise<Passkey[]> {
    return this.passkeys.list(actor);
  }

  @Post("options")
  @HttpCode(HttpStatus.OK)
  options(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PasskeyChallenge<PublicKeyCredentialCreationOptionsJSON>> {
    return this.passkeys.registrationOptions(actor);
  }

  @Post()
  register(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: RegisterPasskeyDto,
  ): Promise<Passkey> {
    return this.passkeys.register(actor, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    return this.passkeys.remove(actor, params.id);
  }
}
