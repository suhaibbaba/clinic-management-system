import { Module } from '@nestjs/common';

import { AppointmentsModule } from '@api/appointments/appointments.module';
import { AuditModule } from '@api/audit/audit.module';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DatabaseModule } from '@api/database/database.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { ClinicClosuresController } from '@api/schedule/clinic-closures.controller';
import { ClinicClosuresService } from '@api/schedule/clinic-closures.service';
import { DoctorTimeOffController } from '@api/schedule/doctor-time-off.controller';
import { DoctorTimeOffService } from '@api/schedule/doctor-time-off.service';
import { ScheduleConflictsService } from '@api/schedule/schedule-conflicts.service';

// Separate from `AppointmentsModule` and importing it, because the dependency runs one way —
// folding these controllers in would make it a cycle.
@Module({
  imports: [DatabaseModule, AuditModule, AppointmentsModule, NotificationsModule],
  controllers: [ClinicClosuresController, DoctorTimeOffController],
  providers: [
    ClinicScopeService,
    ScheduleConflictsService,
    ClinicClosuresService,
    DoctorTimeOffService,
  ],
  exports: [ClinicClosuresService, DoctorTimeOffService],
})
export class ClinicScheduleModule {}
