import { Controller, Get, Query } from "@nestjs/common";
import { type Paginated, type Specialty } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SpecialtiesService } from "@api/modules/specialties/services/specialties.service";
import { ListSpecialtiesQueryDto } from "@api/modules/specialties/dto/specialties.dto";

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
}
