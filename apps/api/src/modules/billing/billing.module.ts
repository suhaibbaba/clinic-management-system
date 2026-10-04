import { Module } from "@nestjs/common";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import {
  BillingController,
  PatientBillingController,
} from "@api/modules/billing/controllers/billing.controller";
import { ChargesService } from "@api/modules/billing/services/charges.service";
import { DocumentsService } from "@api/modules/billing/services/documents.service";
import { LedgerService } from "@api/modules/billing/services/ledger.service";
import { OverdueService } from "@api/modules/billing/services/overdue.service";
import { PaymentsController } from "@api/modules/billing/controllers/payments.controller";
import { PaymentsService } from "@api/modules/billing/services/payments.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";

@Module({
  imports: [NotificationsModule],
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
