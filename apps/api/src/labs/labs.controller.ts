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
  createLabSchema,
  createLabWorkTypeSchema,
  idParamSchema,
  listLabsQuerySchema,
  updateLabSchema,
  updateLabWorkTypeSchema,
  USER_ROLE,
  type Lab,
  type LabSummary,
  type LabWorkType,
  type Paginated,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { LAB_WORK_TYPES_ENTITY, LabWorkTypesService } from "@api/labs/lab-work-types.service";
import { LABS_ENTITY, LabsService } from "@api/labs/labs.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreateLabDto extends createZodDto(createLabSchema) {}
class UpdateLabDto extends createZodDto(updateLabSchema) {}
class ListLabsQueryDto extends createZodDto(listLabsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class CreateWorkTypeDto extends createZodDto(createLabWorkTypeSchema) {}
class UpdateWorkTypeDto extends createZodDto(updateLabWorkTypeSchema) {}
class LabIdParamDto extends createZodDto(z.object({ labId: z.uuid() })) {}
class WorkTypeQueryDto extends createZodDto(
  z.object({ includeInactive: z.coerce.boolean().optional() }),
) {}

// Admin CRUD, technician CRU, doctor read, receptionist nothing — no route lists them, so every
// call is a 403. Deleting is admin-only: a lab carries a balance.
@Controller("labs")
export class LabsController {
  constructor(
    private readonly labs: LabsService,
    private readonly workTypes: LabWorkTypesService,
  ) {}

  @AiTool({
    group: "labs",
    description:
      "The clinic's labs by name, with what the clinic owes each and its open orders. Use to turn a lab's name into a labId.",
  })
  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLabsQueryDto,
  ): Promise<Paginated<LabSummary>> {
    return this.labs.list(actor, query);
  }

  @AiTool({
    group: "labs",
    description: "One lab with its contact, balance and open orders.",
  })
  @Get(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabSummary> {
    return this.labs.findOne(actor, params.id);
  }

  @AiTool({
    group: "labs",
    description: "Add a lab to the directory. Waits on a card.",
  })
  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LABS_ENTITY, AUDIT_ACTION.CREATE)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateLabDto): Promise<Lab> {
    return this.labs.create(actor, body);
  }

  @AiTool({
    group: "labs",
    description: "Change a lab's contact details, or switch it off. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LABS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateLabDto,
  ): Promise<Lab> {
    return this.labs.update(actor, params.id, body);
  }

  @AiTool({
    group: "labs",
    description: "Archive a lab. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LABS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.labs.softDelete(actor, params.id);
  }

  @AiTool({
    group: "labs",
    description: "A lab's work types and their prices. Use to find a workTypeId for an order.",
  })
  @Get(":labId/work-types")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listWorkTypes(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: WorkTypeQueryDto,
  ): Promise<LabWorkType[]> {
    return this.workTypes.list(actor, params.labId, query.includeInactive ?? false);
  }

  @AiTool({
    group: "labs",
    description: "Add a work type with its price to a lab's list. Waits on a card.",
  })
  @Post(":labId/work-types")
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_WORK_TYPES_ENTITY, AUDIT_ACTION.CREATE)
  createWorkType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Body() body: CreateWorkTypeDto,
  ): Promise<LabWorkType> {
    return this.workTypes.create(actor, params.labId, body);
  }

  @AiTool({
    group: "labs",
    description: "Change a work type's name or price. Waits on a card.",
  })
  @Patch("work-types/:id")
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_WORK_TYPES_ENTITY, AUDIT_ACTION.UPDATE)
  updateWorkType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateWorkTypeDto,
  ): Promise<LabWorkType> {
    return this.workTypes.update(actor, params.id, body);
  }

  @AiTool({
    group: "labs",
    description: "Retire a work type. Waits on a typed confirmation.",
  })
  @Delete("work-types/:id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LAB_WORK_TYPES_ENTITY, AUDIT_ACTION.DELETE)
  async removeWorkType(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.workTypes.softDelete(actor, params.id);
  }
}
