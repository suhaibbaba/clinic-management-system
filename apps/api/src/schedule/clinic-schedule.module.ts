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

/**
 * When the clinic is shut and when a doctor is away.
 *
 * Separate from `AppointmentsModule` and importing it, rather than living
 * inside it, because the dependency only runs one way: closures need the
 * appointments they collide with and the "own calendar" rule, and appointments
 * need closures only through `AvailabilityService`, which reads the two tables
 * directly. Folding these controllers into the calendar module would have made
 * that a cycle.
 *
 * `NotificationsModule` is here for the one thing that actually reaches a
 * patient: a closure that cancels their appointment tells them it did.
 */
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
