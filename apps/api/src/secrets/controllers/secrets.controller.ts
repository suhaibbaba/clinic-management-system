import { Body, Controller, Get, Put } from "@nestjs/common";
import { USER_ROLE, type ClinicSecrets } from "@clinic/shared";
import { Capability } from "@api/common/decorators/capability.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SecretsService } from "@api/secrets/services/secrets.service";
import { UpdateSecretsDto } from "@api/secrets/dto/secrets.dto";

@Controller("ai/secrets")
export class SecretsController {
  constructor(private readonly secrets: SecretsService) {}

  @Get()
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-secrets.status")
  status(@CurrentUser() actor: AuthenticatedUser): Promise<ClinicSecrets> {
    return this.secrets.status(actor.clinicId);
  }

  @Put()
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-secrets.update")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: UpdateSecretsDto,
  ): Promise<ClinicSecrets> {
    return this.secrets.update(actor, body);
  }
}
