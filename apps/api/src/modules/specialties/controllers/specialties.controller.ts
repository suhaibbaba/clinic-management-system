import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { AUDIT_ACTION, USER_ROLE, type Paginated, type Specialty } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { SPECIALTIES_ENTITY } from "@api/common/constants/audit-entities";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SpecialtiesService } from "@api/modules/specialties/services/specialties.service";
import {
  IdParamDto,
  ListSpecialtiesQueryDto,
  UpdateSpecialtyDto,
} from "@api/modules/specialties/dto/specialties.dto";

@Controller("specialties")
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSpecialtiesQueryDto,
  ): Promise<Paginated<Specialty>> {
    return this.specialtiesService.list(actor, query);
  }

  @Patch(":id")
  @Roles(USER_ROLE.ADMIN)
  @Audit(SPECIALTIES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateSpecialtyDto,
  ): Promise<Specialty> {
    return this.specialtiesService.update(actor, params.id, body);
  }
}
