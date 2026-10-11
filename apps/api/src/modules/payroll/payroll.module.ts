import { Module } from "@nestjs/common";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { PayrollDocumentsService } from "@api/modules/payroll/services/payroll-documents.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import {
  DoctorSettlementsController,
  MySettlementController,
  PatientSettlementStatusController,
  SettlementTreatmentsController,
} from "@api/modules/payroll/controllers/doctor-settlements.controller";
import {
  PayrollAdjustmentsController,
  PayrollController,
  StaffPaymentsController,
} from "@api/modules/payroll/controllers/payroll.controller";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import { PayTermsService } from "@api/modules/payroll/services/pay-terms.service";
import { PayrollService } from "@api/modules/payroll/services/payroll.service";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";

@Module({
  imports: [NotificationsModule],
  controllers: [
    DoctorSettlementsController,
    SettlementTreatmentsController,
    MySettlementController,
    PatientSettlementStatusController,
    PayrollController,
    PayrollAdjustmentsController,
    StaffPaymentsController,
  ],
  providers: [
    ClinicScopeService,
    StaffPaymentsService,
    PayTermsService,
    DoctorSettlementsService,
    PayrollService,
    PayrollDocumentsService,
  ],
})
export class PayrollModule {}
