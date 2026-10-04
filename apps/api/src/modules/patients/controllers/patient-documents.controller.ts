import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { USER_ROLE } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SendDocumentDto } from "@api/modules/notifications/dto/document-delivery.dto";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";
import { PatientIdParamDto } from "@api/modules/patients/dto/patient-documents.dto";
import { PatientDocumentsService } from "@api/modules/patients/services/patient-documents.service";

@Controller("patients/:patientId")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN)
export class PatientDocumentsController {
  constructor(
    private readonly documents: PatientDocumentsService,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  @Get("treatment-plan.pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="treatment-plan.pdf"')
  treatmentPlan(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
  ): Promise<Buffer> {
    return this.documents.treatmentPlan(actor, params.patientId);
  }

  @Post("treatment-plan/whatsapp")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendTreatmentPlan(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Body() body: SendDocumentDto,
  ): Promise<void> {
    await this.delivery.send({
      clinicId: actor.clinicId,
      to: body.to,
      kind: "treatmentPlan",
      pdf: await this.documents.treatmentPlan(actor, params.patientId),
    });
  }
}
