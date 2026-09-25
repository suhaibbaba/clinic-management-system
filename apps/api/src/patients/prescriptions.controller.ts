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
  createPrescriptionSchema,
  idParamSchema,
  listPrescriptionsQuerySchema,
  updatePrescriptionSchema,
  USER_ROLE,
  type Paginated,
  type Prescription,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PRESCRIPTIONS_ENTITY, PrescriptionsService } from "@api/patients/prescriptions.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreatePrescriptionDto extends createZodDto(createPrescriptionSchema) {}
class UpdatePrescriptionDto extends createZodDto(updatePrescriptionSchema) {}
class ListPrescriptionsQueryDto extends createZodDto(listPrescriptionsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// Admin and doctor CRUD, nothing for technician or receptionist — a receptionist response must
// never contain a prescription.
@Controller("prescriptions")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @AiTool({
    group: "patients",
    description: "Prescriptions, filtered by patient or visit. Clinical.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListPrescriptionsQueryDto,
  ): Promise<Paginated<Prescription>> {
    return this.prescriptions.list(actor, query);
  }

  @AiTool({
    group: "patients",
    description: "One prescription in full. Clinical.",
  })
  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Prescription> {
    return this.prescriptions.findOne(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description:
      "Write a prescription exactly as the doctor dictated — never choose a drug or dose yourself. Waits on a card.",
  })
  @Post()
  @Audit(PRESCRIPTIONS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreatePrescriptionDto,
  ): Promise<Prescription> {
    return this.prescriptions.create(actor, body);
  }

  @AiTool({
    group: "patients",
    description: "Correct a prescription exactly as the doctor dictated. Waits on a card.",
  })
  @Patch(":id")
  @Audit(PRESCRIPTIONS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePrescriptionDto,
  ): Promise<Prescription> {
    return this.prescriptions.update(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description: "Void a prescription. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PRESCRIPTIONS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.prescriptions.softDelete(actor, params.id);
  }
}
