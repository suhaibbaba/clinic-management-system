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
import { PatientsModule } from '@api/patients/patients.module';

@Module({
  imports: [DatabaseModule, AuditModule, PatientsModule],
  controllers: [AppointmentsController, WaitingListController],
  providers: [
    ClinicScopeService,
    AppointmentAccessService,
    AppointmentsService,
    AvailabilityService,
    WaitingListService,
  ],
  // Exported for the labs module: "a doctor manages their own" is the same rule for a crown as for
  // an appointment.
  exports: [AvailabilityService, AppointmentsService, AppointmentAccessService],
})
export class AppointmentsModule {}
