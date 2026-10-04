import { Module } from "@nestjs/common";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { AuditModule } from "@api/modules/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { LabDocumentsService } from "@api/modules/labs/services/lab-documents.service";
import { LabLedgerService } from "@api/modules/labs/services/lab-ledger.service";
import { LabOrderAttachmentsService } from "@api/modules/labs/services/lab-order-attachments.service";
import { LabOrdersController } from "@api/modules/labs/controllers/lab-orders.controller";
import { LabOrdersService } from "@api/modules/labs/services/lab-orders.service";
import {
  LabLedgerController,
  LabPaymentsController,
} from "@api/modules/labs/controllers/lab-payments.controller";
import { LabPaymentsService } from "@api/modules/labs/services/lab-payments.service";
import { LabWorkTypesService } from "@api/modules/labs/services/lab-work-types.service";
import { LabsController } from "@api/modules/labs/controllers/labs.controller";
import { LabsService } from "@api/modules/labs/services/labs.service";
import { PatientsModule } from "@api/modules/patients/patients.module";
import { StorageModule } from "@api/modules/storage/storage.module";

@Module({
  imports: [
    NotificationsModule,
    DatabaseModule,
    AuditModule,
    StorageModule,
    AppointmentsModule,
    PatientsModule,
  ],
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
