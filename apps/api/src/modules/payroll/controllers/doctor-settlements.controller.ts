import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SendDocumentDto } from "@api/modules/notifications/dto/document-delivery.dto";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";
import { PayrollDocumentsService } from "@api/modules/payroll/services/payroll-documents.service";
import { AUDIT_ACTION, USER_ROLE, type DoctorSettlement, type StaffPayment } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  DOCTORS_ENTITY,
  PERFORMED_PROCEDURES_ENTITY,
  STAFF_PAYMENTS_ENTITY,
} from "@api/common/constants/audit-entities";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import {
  CreateStaffPaymentDto,
  IdParamDto,
  SettlementQueryDto,
  SettlementTermsDto,
  UpdateTreatmentSettlementDto,
} from "@api/modules/payroll/dto/payroll.dto";

@Controller("doctors")
@Roles(USER_ROLE.ADMIN)
export class DoctorSettlementsController {
  constructor(
    private readonly settlements: DoctorSettlementsService,
    private readonly documents: PayrollDocumentsService,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  @Get(":id/settlement")
  settlement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: SettlementQueryDto,
  ): Promise<DoctorSettlement> {
    return this.settlements.settlement(actor, params.id, query);
  }

  @Get(":id/settlement/print")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="settlement.pdf"')
  settlementPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: SettlementQueryDto,
  ): Promise<Buffer> {
    return this.documents.settlement(actor, params.id, query);
  }

  @Post(":id/settlement/print/whatsapp")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendSettlement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: SettlementQueryDto,
    @Body() body: SendDocumentDto,
  ): Promise<void> {
    await this.delivery.send({
      clinicId: actor.clinicId,
      to: body.to,
      kind: "settlement",
      pdf: await this.documents.settlement(actor, params.id, query),
    });
  }

  @Put(":id/settlement-terms")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(DOCTORS_ENTITY, AUDIT_ACTION.UPDATE)
  async terms(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SettlementTermsDto,
  ): Promise<void> {
    await this.settlements.updateTerms(actor, params.id, body);
  }

  @Post(":id/payouts")
  @Audit(STAFF_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  payout(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CreateStaffPaymentDto,
  ): Promise<StaffPayment> {
    return this.settlements.createPayout(actor, params.id, body);
  }
}

@Controller("settlement-treatments")
@Roles(USER_ROLE.ADMIN)
export class SettlementTreatmentsController {
  constructor(private readonly settlements: DoctorSettlementsService) {}

  @Patch(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.UPDATE)
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateTreatmentSettlementDto,
  ): Promise<void> {
    await this.settlements.updateTreatment(actor, params.id, body);
  }
}
