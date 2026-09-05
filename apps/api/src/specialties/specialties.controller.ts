import { Controller, Get, Query } from '@nestjs/common';
import { listSpecialtiesQuerySchema, type Paginated, type Specialty } from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { SpecialtiesService } from '@api/specialties/specialties.service';

class ListSpecialtiesQueryDto extends createZodDto(listSpecialtiesQuerySchema) {}

/** Readable by every role; no `@Roles(...)` needed. */
@Controller('specialties')
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
