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
import {
  CLINIC_MODULE,
  AUDIT_ACTION,
  USER_ROLE,
  type CollectionTerm,
  type DoctorSettlement,
  type OwnSettlement,
  type SettlementPayout,
  type StaffPayment,
  type TreatmentSettlementStatus,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  COLLECTION_TERMS_ENTITY,
  DOCTOR_RATES_ENTITY,
  SETTLEMENT_TREATMENTS_ENTITY,
  STAFF_PAYMENTS_ENTITY,
} from "@api/common/constants/audit-entities";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import {
  CollectionTermsDto,
  CreateRemittanceDto,
  CreateSettlementPayoutDto,
  IdParamDto,
  OwnSettlementQueryDto,
  PayoutParamDto,
  SettlementQueryDto,
  SettlementTermsDto,
  UpdateTreatmentSettlementDto,
} from "@api/modules/payroll/dto/payroll.dto";
import { ClinicFeature } from "@api/common/decorators/clinic-feature.decorator";

@ClinicFeature(CLINIC_MODULE.PAYROLL)
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
  @Audit(DOCTOR_RATES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  terms(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SettlementTermsDto,
  ): Promise<{ id: string }> {
    return this.settlements.updateTerms(actor, params.id, body);
  }

  @Get(":id/collection-terms")
  collectionTerms(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CollectionTerm[]> {
    return this.settlements.collectionTerms(actor, params.id);
  }

  @Put(":id/collection-terms")
  @Audit(COLLECTION_TERMS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  setCollectionTerms(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CollectionTermsDto,
  ): Promise<CollectionTerm> {
    return this.settlements.setCollector(actor, params.id, body);
  }

  @Post(":id/remittances")
  @Audit(STAFF_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  remit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CreateRemittanceDto,
  ): Promise<StaffPayment> {
    return this.settlements.remit(actor, params.id, body);
  }

  @Post(":id/payouts")
  @Audit(STAFF_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  payout(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CreateSettlementPayoutDto,
  ): Promise<SettlementPayout> {
    return this.settlements.createPayout(actor, params.id, body);
  }

  @Get(":id/payouts/:payoutId/print")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="payout.pdf"')
  payoutPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PayoutParamDto,
  ): Promise<Buffer> {
    return this.documents.payout(actor, params.id, params.payoutId);
  }
}

@ClinicFeature(CLINIC_MODULE.PAYROLL)
@Controller("me/settlement")
@Roles(USER_ROLE.ADMIN)
export class MySettlementController {
  constructor(private readonly settlements: DoctorSettlementsService) {}

  @Get()
  statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: OwnSettlementQueryDto,
  ): Promise<OwnSettlement> {
    return this.settlements.ownSettlement(actor, query);
  }
}

@ClinicFeature(CLINIC_MODULE.PAYROLL)
@Controller("patients/:id/settlement-status")
@Roles(USER_ROLE.ADMIN)
export class PatientSettlementStatusController {
  constructor(private readonly settlements: DoctorSettlementsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<TreatmentSettlementStatus[]> {
    return this.settlements.treatmentStatuses(actor, params.id);
  }
}

@ClinicFeature(CLINIC_MODULE.PAYROLL)
@Controller("settlement-treatments")
@Roles(USER_ROLE.ADMIN)
export class SettlementTreatmentsController {
  constructor(private readonly settlements: DoctorSettlementsService) {}

  @Patch(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(SETTLEMENT_TREATMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateTreatmentSettlementDto,
  ): Promise<void> {
    await this.settlements.updateTreatment(actor, params.id, body);
  }
}
