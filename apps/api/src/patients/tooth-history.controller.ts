import { Controller, Get, Param } from "@nestjs/common";
import { patientToothParamSchema, USER_ROLE, type ToothHistory } from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { ToothHistoryService } from "@api/patients/tooth-history.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class PatientToothParamDto extends createZodDto(patientToothParamSchema) {}

@Controller("patients/:patientId/teeth")
@Roles(USER_ROLE.DOCTOR)
export class ToothHistoryController {
  constructor(private readonly toothHistory: ToothHistoryService) {}

  @AiTool({
    group: "patients",
    description:
      "Everything done to one tooth of a patient, by its FDI number (11–48, 51–85). Returns the tooth's history.",
  })
  @Get(":fdi")
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientToothParamDto,
  ): Promise<ToothHistory> {
    return this.toothHistory.get(actor, params.patientId, params.fdi);
  }
}
