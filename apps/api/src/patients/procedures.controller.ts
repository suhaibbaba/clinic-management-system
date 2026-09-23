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
  createPerformedProcedureSchema,
  idParamSchema,
  listPerformedProceduresQuerySchema,
  updatePerformedProcedureSchema,
  USER_ROLE,
  type Paginated,
  type PerformedProcedure,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PERFORMED_PROCEDURES_ENTITY, ProceduresService } from "@api/patients/procedures.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";
import { AI_RISK_TIER } from "@clinic/shared";

class CreateProcedureDto extends createZodDto(createPerformedProcedureSchema) {}
class UpdateProcedureDto extends createZodDto(updatePerformedProcedureSchema) {}
class ListProceduresQueryDto extends createZodDto(listPerformedProceduresQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// Recording a procedure is what makes a patient owe money, so every mutation is audited and hands
// the billing seam an event.
@Controller("performed-procedures")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  /** A technician's page is filtered to lab-linked rows inside the service. */
  @AiTool({
    group: "patients",
    description:
      "Treatments performed, filtered by patient, visit or status. Clinical. Returns a page with prices.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListProceduresQueryDto,
  ): Promise<Paginated<PerformedProcedure>> {
    return this.procedures.list(actor, query);
  }

  @AiTool({
    group: "patients",
    description: "One performed treatment in full. Clinical.",
  })
  @Get(":id")
  @Roles(USER_ROLE.DOCTOR)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PerformedProcedure> {
    return this.procedures.findOne(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description:
      "Record a treatment performed on a patient, from the procedure catalogue; it adds its charge to the patient's balance. Waits on a typed confirmation.",
    risk: AI_RISK_TIER.TYPED,
  })
  @Post()
  @Roles(USER_ROLE.DOCTOR)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateProcedureDto,
  ): Promise<PerformedProcedure> {
    return this.procedures.create(actor, body);
  }

  @AiTool({
    group: "patients",
    description:
      "Change a performed treatment — its status, price or notes; the charge follows. Waits on a typed confirmation.",
    risk: AI_RISK_TIER.TYPED,
  })
  @Patch(":id")
  @Roles(USER_ROLE.DOCTOR)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateProcedureDto,
  ): Promise<PerformedProcedure> {
    return this.procedures.update(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description:
      "Void a treatment recorded by mistake; its charge is reversed. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.procedures.softDelete(actor, params.id);
  }
}
