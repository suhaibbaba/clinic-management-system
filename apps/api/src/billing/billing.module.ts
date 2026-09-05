import { Module } from '@nestjs/common';

import { BillingController, PatientBillingController } from '@api/billing/billing.controller';
import { ChargesService } from '@api/billing/charges.service';
import { DocumentsService } from '@api/billing/documents.service';
import { LedgerService } from '@api/billing/ledger.service';
import { OverdueService } from '@api/billing/overdue.service';
import { PaymentsController } from '@api/billing/payments.controller';
import { PaymentsService } from '@api/billing/payments.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { PatientAccessService } from '@api/patients/patient-access.service';

/**
 * The money ledgers (CLAUDE.md module 3).
 *
 * `PatientAccessService` is provided here rather than imported from
 * `PatientsModule`: billing needs the patient existence check, patients needs
 * `ChargesService` to bill a procedure in the same transaction, and importing
 * both ways would be a cycle. The service is stateless, so a second instance
 * costs nothing and keeps the dependency pointing one way.
 */
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
  exports: [ChargesService, LedgerService],
})
export class BillingModule {}
