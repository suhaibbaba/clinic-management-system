import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/appointments/appointments.module";
import { AuditModule } from "@api/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { NotificationsModule } from "@api/notifications/notifications.module";
import { ClinicClosuresController } from "@api/schedule/clinic-closures.controller";
import { ClinicClosuresService } from "@api/schedule/clinic-closures.service";
import { DoctorExtraHoursController } from "@api/schedule/doctor-extra-hours.controller";
import { DoctorExtraHoursService } from "@api/schedule/doctor-extra-hours.service";
import { DoctorTimeOffController } from "@api/schedule/doctor-time-off.controller";
import { DoctorTimeOffService } from "@api/schedule/doctor-time-off.service";
import { ScheduleConflictsService } from "@api/schedule/schedule-conflicts.service";

@Module({
  imports: [DatabaseModule, AuditModule, AppointmentsModule, NotificationsModule],
  controllers: [ClinicClosuresController, DoctorTimeOffController, DoctorExtraHoursController],
  providers: [
    ClinicScopeService,
    ScheduleConflictsService,
    ClinicClosuresService,
    DoctorTimeOffService,
    DoctorExtraHoursService,
  ],
  exports: [
    ClinicClosuresService,
    DoctorTimeOffService,
    DoctorExtraHoursService,
    ScheduleConflictsService,
  ],
})
export class ClinicScheduleModule {}
