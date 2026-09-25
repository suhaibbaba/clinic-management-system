import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  listTimelineQuerySchema,
  patientIdParamSchema,
  USER_ROLE,
  type Paginated,
  type TimelineEntry,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { TimelineService } from "@api/patients/timeline.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class ListTimelineQueryDto extends createZodDto(listTimelineQuerySchema) {}
class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}

// Which entries come back is decided by role inside the service; the `type` parameter can only
// narrow that set, never widen it.
@Controller("patients/:patientId/timeline")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.RECEPTIONIST)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @AiTool({
    group: "patients",
    description:
      "A patient's history page by page — visits, treatments, appointments, payments, newest first. Use for older history than get_patient_summary shows.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: ListTimelineQueryDto,
  ): Promise<Paginated<TimelineEntry>> {
    return this.timeline.list(actor, params.patientId, query);
  }
}
