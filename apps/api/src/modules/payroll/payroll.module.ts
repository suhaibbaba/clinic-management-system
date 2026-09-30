import { Module } from "@nestjs/common";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import {
  DoctorSettlementsController,
  SettlementTreatmentsController,
} from "@api/modules/payroll/controllers/doctor-settlements.controller";
import {
  PayrollAdjustmentsController,
  PayrollController,
  StaffPaymentsController,
} from "@api/modules/payroll/controllers/payroll.controller";
import { DoctorSettlementsService } from "@api/modules/payroll/services/doctor-settlements.service";
import { PayrollService } from "@api/modules/payroll/services/payroll.service";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";

@Module({
  controllers: [
    DoctorSettlementsController,
    SettlementTreatmentsController,
    PayrollController,
    PayrollAdjustmentsController,
    StaffPaymentsController,
  ],
  providers: [ClinicScopeService, StaffPaymentsService, DoctorSettlementsService, PayrollService],
})
export class PayrollModule {}
