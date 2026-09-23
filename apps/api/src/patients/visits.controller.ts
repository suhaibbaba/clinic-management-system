import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  createVisitSchema,
  idParamSchema,
  listVisitsQuerySchema,
  updateVisitSchema,
  USER_ROLE,
  type Paginated,
  type Visit,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { VISITS_ENTITY, VisitsService } from "@api/patients/visits.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreateVisitDto extends createZodDto(createVisitSchema) {}
class UpdateVisitDto extends createZodDto(updateVisitSchema) {}
class ListVisitsQueryDto extends createZodDto(listVisitsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// Admin CRUD, doctor CRU, nothing for technician or receptionist — their responses must never carry
// a diagnosis or a visit note.
@Controller("visits")
@Roles(USER_ROLE.DOCTOR)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @AiTool({
    group: "patients",
    description:
      "Visits, filtered by patient, doctor or dates. Clinical. Use for visit questions; for a patient's whole story use get_patient_summary.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListVisitsQueryDto,
  ): Promise<Paginated<Visit>> {
    return this.visitsService.list(actor, query);
  }

  @AiTool({
    group: "patients",
    description: "One visit in full: complaint, examination, diagnosis, notes. Clinical.",
  })
  @Get(":id")
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Visit> {
    return this.visitsService.findOne(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description:
      "Open a visit for a patient with the doctor and what the user dictated. Waits on a card.",
  })
  @Post()
  @Audit(VISITS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateVisitDto): Promise<Visit> {
    return this.visitsService.create(actor, body);
  }

  @AiTool({
    group: "patients",
    description: "Change a visit's clinical notes with what the user dictated. Waits on a card.",
  })
  @Patch(":id")
  @Audit(VISITS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateVisitDto,
  ): Promise<Visit> {
    return this.visitsService.update(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description: "Archive a visit recorded by mistake. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(VISITS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.visitsService.softDelete(actor, params.id);
  }
}
