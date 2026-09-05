import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  listTimelineQuerySchema,
  patientIdParamSchema,
  USER_ROLE,
  type Paginated,
  type TimelineEntry,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { TimelineService } from '@api/patients/timeline.service';

class ListTimelineQueryDto extends createZodDto(listTimelineQuerySchema) {}
class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}

/**
 * The merged patient timeline (ROLES.md patients matrix): admin and doctor read
 * it in full, a receptionist only the financial and appointment entries, and a
 * technician not at all.
 *
 * Which entries come back is decided by the caller's role inside the service —
 * the `type` query parameter can only narrow that set, never widen it.
 */
@Controller('patients/:patientId/timeline')
@Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: ListTimelineQueryDto,
  ): Promise<Paginated<TimelineEntry>> {
    return this.timeline.list(actor, params.patientId, query);
  }
}
