import { Module } from '@nestjs/common';

import { AppointmentAccessService } from '@api/appointments/appointment-access.service';
import { AppointmentsController } from '@api/appointments/appointments.controller';
import { AppointmentsService } from '@api/appointments/appointments.service';
import { AvailabilityService } from '@api/appointments/availability.service';
import { WaitingListController } from '@api/appointments/waiting-list.controller';
import { WaitingListService } from '@api/appointments/waiting-list.service';
import { AuditModule } from '@api/audit/audit.module';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DatabaseModule } from '@api/database/database.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { PatientsModule } from '@api/patients/patients.module';

@Module({
  imports: [DatabaseModule, AuditModule, NotificationsModule, PatientsModule],
  controllers: [AppointmentsController, WaitingListController],
  providers: [
    ClinicScopeService,
    AppointmentAccessService,
    AppointmentsService,
    AvailabilityService,
    WaitingListService,
  ],
  exports: [AvailabilityService, AppointmentsService, AppointmentAccessService, WaitingListService],
})
export class AppointmentsModule {}
