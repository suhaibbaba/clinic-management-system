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
  createClinicClosureSchema,
  idParamSchema,
  listClinicClosuresQuerySchema,
  scheduleConflictOptionsSchema,
  updateClinicClosureSchema,
  USER_ROLE,
  type ClinicClosure,
  type ClinicClosureResult,
  type Paginated,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  CLINIC_CLOSURES_ENTITY,
  ClinicClosuresService,
} from "@api/schedule/clinic-closures.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreateClinicClosureDto extends createZodDto(createClinicClosureSchema) {}
class UpdateClinicClosureDto extends createZodDto(updateClinicClosureSchema) {}
class ListClinicClosuresQueryDto extends createZodDto(listClinicClosuresQuerySchema) {}
class ConflictOptionsDto extends createZodDto(scheduleConflictOptionsSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// Reading is open: a receptionist who cannot see Tuesday is shut will book into it. `force` and
// `cancelAppointments` are query parameters — they answer a 409, they are not the closure.
@Controller("clinic-closures")
export class ClinicClosuresController {
  constructor(private readonly closures: ClinicClosuresService) {}

  @AiTool({
    group: "schedule",
    description: "The days the whole clinic is shut, past and future. Returns a page of closures.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListClinicClosuresQueryDto,
  ): Promise<Paginated<ClinicClosure>> {
    return this.closures.list(actor, query);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINIC_CLOSURES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateClinicClosureDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<ClinicClosureResult> {
    return this.closures.create(actor, body, options);
  }

  @AiTool({
    group: "schedule",
    description:
      "Change a closure's dates or reason. To add one use add_clinic_closure. Fails if appointments fall inside the new days — say so. Waits on a card.",
    exclude: ["force", "cancelAppointments"],
  })
  @Patch(":id")
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINIC_CLOSURES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateClinicClosureDto,
    @Query() options: ConflictOptionsDto,
  ): Promise<ClinicClosureResult> {
    return this.closures.update(actor, params.id, body, options);
  }

  @AiTool({
    group: "schedule",
    description: "Reopen days a closure shut. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(CLINIC_CLOSURES_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.closures.softDelete(actor, params.id);
  }
}
