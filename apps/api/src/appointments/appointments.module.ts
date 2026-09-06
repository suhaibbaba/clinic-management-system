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

/**
 * The internal calendar: appointments, availability and the waiting list.
 *
 * `PatientsModule` is imported for `PatientAccessService` — every appointment
 * belongs to a patient, and the 404-not-403 rule for a patient from another
 * clinic is written once there.
 *
 * `AvailabilityService` is exported because public booking will need exactly
 * this service from its own `@Public()` controller, with none of the rest.
 */
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
  exports: [AvailabilityService, AppointmentsService],
})
export class AppointmentsModule {}
