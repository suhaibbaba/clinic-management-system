import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { AuditModule } from "@api/modules/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { ClinicClosuresController } from "@api/modules/schedule/controllers/clinic-closures.controller";
import { ClinicClosuresService } from "@api/modules/schedule/services/clinic-closures.service";
import { DoctorExtraHoursController } from "@api/modules/schedule/controllers/doctor-extra-hours.controller";
import { DoctorExtraHoursService } from "@api/modules/schedule/services/doctor-extra-hours.service";
import { DoctorTimeOffController } from "@api/modules/schedule/controllers/doctor-time-off.controller";
import { DoctorTimeOffService } from "@api/modules/schedule/services/doctor-time-off.service";
import { ScheduleConflictsService } from "@api/modules/schedule/services/schedule-conflicts.service";

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
