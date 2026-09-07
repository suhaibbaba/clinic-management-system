import { Module } from '@nestjs/common';

import { AppointmentsModule } from '@api/appointments/appointments.module';
import { AuditModule } from '@api/audit/audit.module';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DatabaseModule } from '@api/database/database.module';
import { LabDocumentsService } from '@api/labs/lab-documents.service';
import { LabLedgerService } from '@api/labs/lab-ledger.service';
import { LabOrderAttachmentsService } from '@api/labs/lab-order-attachments.service';
import { LabOrdersController } from '@api/labs/lab-orders.controller';
import { LabOrdersService } from '@api/labs/lab-orders.service';
import { LabLedgerController, LabPaymentsController } from '@api/labs/lab-payments.controller';
import { LabPaymentsService } from '@api/labs/lab-payments.service';
import { LabWorkTypesService } from '@api/labs/lab-work-types.service';
import { LabsController } from '@api/labs/labs.controller';
import { LabsService } from '@api/labs/labs.service';
import { StorageModule } from '@api/storage/storage.module';

/**
 * Labs: the outside workshops, what is ordered from them, and what is owed.
 *
 * `AppointmentsModule` is imported for `AppointmentAccessService` — "a doctor
 * manages their own" is the same rule here as on the calendar, and one
 * definition of it is worth an import. `StorageModule` is for the order
 * attachments, which use the same presigned-URL flow as an X-ray.
 *
 * Everything financial in here is append-only and computed on read: there is
 * no balance column anywhere in this module, and there must never be one.
 */
@Module({
  imports: [DatabaseModule, AuditModule, StorageModule, AppointmentsModule],
  controllers: [LabsController, LabOrdersController, LabLedgerController, LabPaymentsController],
  providers: [
    ClinicScopeService,
    LabsService,
    LabWorkTypesService,
    LabOrdersService,
    LabOrderAttachmentsService,
    LabLedgerService,
    LabPaymentsService,
    LabDocumentsService,
  ],
  exports: [LabOrdersService, LabLedgerService],
})
export class LabsModule {}
