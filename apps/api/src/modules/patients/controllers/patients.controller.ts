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
import { AUDIT_ACTION, USER_ROLE, type Paginated, type PatientView } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PATIENTS_ENTITY } from "@api/modules/patients/lib/patient-view";
import { PatientsService } from "@api/modules/patients/services/patients.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  ListPatientsQueryDto,
  IdParamDto,
  CreatePatientDto,
  UpdatePatientDto,
} from "@api/modules/patients/dto/patients.dto";

@Controller("patients")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListPatientsQueryDto,
  ): Promise<Paginated<PatientView>> {
    return this.patientsService.list(actor, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<PatientView> {
    return this.patientsService.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
  @Audit(PATIENTS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreatePatientDto,
  ): Promise<PatientView> {
    return this.patientsService.create(actor, body);
  }

  @AiTool({
    group: "patients",
    description:
      "Correct a patient's details — name, phone, date of birth, address. Not for notes: use add_patient_note. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
  @Audit(PATIENTS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePatientDto,
  ): Promise<PatientView> {
    return this.patientsService.update(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description:
      "Archive a patient's file (never deleted). Only when the user asks for exactly that. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PATIENTS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.patientsService.softDelete(actor, params.id);
  }
}
