import { Controller, Get, Param } from "@nestjs/common";
import { USER_ROLE, type ToothHistory } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { ToothHistoryService } from "@api/modules/patients/services/tooth-history.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import { PatientToothParamDto } from "@api/modules/patients/dto/tooth-history.dto";

@Controller("patients/:patientId/teeth")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class ToothHistoryController {
  constructor(private readonly toothHistory: ToothHistoryService) {}

  @AiTool({
    group: "patients",
    description:
      "Everything done to one tooth of a patient, by its FDI number (11–48, 51–85). Returns the tooth's history.",
  })
  @Get(":fdi")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN)
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientToothParamDto,
  ): Promise<ToothHistory> {
    return this.toothHistory.get(actor, params.patientId, params.fdi);
  }
}
