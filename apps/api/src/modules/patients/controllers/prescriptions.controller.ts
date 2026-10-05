import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AUDIT_ACTION, USER_ROLE, type Paginated, type Prescription } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PRESCRIPTIONS_ENTITY } from "@api/common/constants/audit-entities";
import { PrescriptionsService } from "@api/modules/patients/services/prescriptions.service";
import { PatientDocumentsService } from "@api/modules/patients/services/patient-documents.service";
import { SendDocumentDto } from "@api/modules/notifications/dto/document-delivery.dto";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  ListPrescriptionsQueryDto,
  IdParamDto,
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
} from "@api/modules/patients/dto/prescriptions.dto";

@Controller("prescriptions")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class PrescriptionsController {
  constructor(
    private readonly prescriptions: PrescriptionsService,
    private readonly documents: PatientDocumentsService,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  @AiTool({
    group: "patients",
    description: "Prescriptions, filtered by patient or visit. Clinical.",
  })
  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN)
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
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Prescription> {
    return this.prescriptions.findOne(actor, params.id);
  }

  @Get(":id/print")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN)
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="prescription.pdf"')
  print(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Buffer> {
    return this.documents.prescription(actor, params.id);
  }

  @Post(":id/print/whatsapp")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.TECHNICIAN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async send(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SendDocumentDto,
  ): Promise<void> {
    await this.delivery.send({
      clinicId: actor.clinicId,
      to: body.to,
      kind: "prescription",
      pdf: await this.documents.prescription(actor, params.id),
    });
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
