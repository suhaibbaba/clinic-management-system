import { Module } from "@nestjs/common";
import { AppointmentAccessService } from "@api/modules/appointments/services/appointment-access.service";
import { AppointmentsController } from "@api/modules/appointments/controllers/appointments.controller";
import { AppointmentsService } from "@api/modules/appointments/services/appointments.service";
import { NoShowScheduler } from "@api/modules/appointments/services/no-show.scheduler";
import { AvailabilityService } from "@api/modules/appointments/services/availability.service";
import { WaitingListController } from "@api/modules/appointments/controllers/waiting-list.controller";
import { WaitingListService } from "@api/modules/appointments/services/waiting-list.service";
import { AuditModule } from "@api/modules/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { PatientsModule } from "@api/modules/patients/patients.module";

@Module({
  imports: [DatabaseModule, AuditModule, NotificationsModule, PatientsModule],
  controllers: [AppointmentsController, WaitingListController],
  providers: [
    ClinicScopeService,
    AppointmentAccessService,
    AppointmentsService,
    AvailabilityService,
    NoShowScheduler,
    WaitingListService,
  ],
  exports: [AvailabilityService, AppointmentsService, AppointmentAccessService, WaitingListService],
})
export class AppointmentsModule {}
