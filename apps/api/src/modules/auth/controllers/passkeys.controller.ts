import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { type Passkey, type PasskeyChallenge } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { CurrentSite } from "@api/common/decorators/request-site.decorator";
import { type RequestSite } from "@api/common/types/request-site";
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
    @CurrentSite() site: RequestSite,
  ): Promise<PasskeyChallenge<PublicKeyCredentialCreationOptionsJSON>> {
    return this.passkeys.registrationOptions(actor, site);
  }

  @Post()
  register(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: RegisterPasskeyDto,
    @CurrentSite() site: RequestSite,
  ): Promise<Passkey> {
    return this.passkeys.register(actor, body, site);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    return this.passkeys.remove(actor, params.id);
  }
}
