import { Module } from "@nestjs/common";
import {
  BillingController,
  PatientBillingController,
} from "@api/billing/controllers/billing.controller";
import { ChargesService } from "@api/billing/services/charges.service";
import { DocumentsService } from "@api/billing/services/documents.service";
import { LedgerService } from "@api/billing/services/ledger.service";
import { OverdueService } from "@api/billing/services/overdue.service";
import { PaymentsController } from "@api/billing/controllers/payments.controller";
import { PaymentsService } from "@api/billing/services/payments.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { PatientAccessService } from "@api/patients/services/patient-access.service";

@Module({
  controllers: [PaymentsController, PatientBillingController, BillingController],
  providers: [
    ClinicScopeService,
    PatientAccessService,
    LedgerService,
    ChargesService,
    PaymentsService,
    OverdueService,
    DocumentsService,
  ],
  exports: [ChargesService, LedgerService, OverdueService, PaymentsService],
})
export class BillingModule {}
