import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/appointments/appointments.module";
import { AuditModule } from "@api/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { LabDocumentsService } from "@api/labs/services/lab-documents.service";
import { LabLedgerService } from "@api/labs/services/lab-ledger.service";
import { LabOrderAttachmentsService } from "@api/labs/services/lab-order-attachments.service";
import { LabOrdersController } from "@api/labs/controllers/lab-orders.controller";
import { LabOrdersService } from "@api/labs/services/lab-orders.service";
import {
  LabLedgerController,
  LabPaymentsController,
} from "@api/labs/controllers/lab-payments.controller";
import { LabPaymentsService } from "@api/labs/services/lab-payments.service";
import { LabWorkTypesService } from "@api/labs/services/lab-work-types.service";
import { LabsController } from "@api/labs/controllers/labs.controller";
import { LabsService } from "@api/labs/services/labs.service";
import { PatientsModule } from "@api/patients/patients.module";
import { StorageModule } from "@api/storage/storage.module";

@Module({
  imports: [DatabaseModule, AuditModule, StorageModule, AppointmentsModule, PatientsModule],
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
  exports: [LabOrdersService, LabLedgerService, LabsService, LabPaymentsService],
})
export class LabsModule {}
