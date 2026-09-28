import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AiModule } from "@api/modules/ai/ai.module";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { AuditInterceptor } from "@api/modules/audit/services/audit.interceptor";
import { AuditModule } from "@api/modules/audit/audit.module";
import { AuthModule } from "@api/modules/auth/auth.module";
import { BookingModule } from "@api/modules/booking/booking.module";
import { BillingModule } from "@api/modules/billing/billing.module";
import { ClinicsModule } from "@api/modules/clinics/clinics.module";
import { JwtAuthGuard } from "@api/common/guards/jwt-auth.guard";
import { RolesGuard } from "@api/common/guards/roles.guard";
import { AppConfigModule } from "@api/config/config.module";
import { DashboardModule } from "@api/modules/dashboard/dashboard.module";
import { DatabaseModule } from "@api/database/database.module";
import { DoctorsModule } from "@api/modules/doctors/doctors.module";
import { HealthModule } from "@api/modules/health/health.module";
import { InventoryModule } from "@api/modules/inventory/inventory.module";
import { LabsModule } from "@api/modules/labs/labs.module";
import { LookupsModule } from "@api/modules/lookups/lookups.module";
import { TranslationsModule } from "@api/modules/translations/translations.module";
import { NotesModule } from "@api/modules/notes/notes.module";
import { PdfModule } from "@api/modules/billing/pdf/pdf.module";
import { EmailModule } from "@api/modules/email/email.module";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { PermissionsModule } from "@api/modules/permissions/permissions.module";
import { PatientsModule } from "@api/modules/patients/patients.module";
import { ClinicScheduleModule } from "@api/modules/schedule/clinic-schedule.module";
import { SpecialtiesModule } from "@api/modules/specialties/specialties.module";
import { StorageModule } from "@api/modules/storage/storage.module";
import { UsersModule } from "@api/modules/users/users.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    AuditModule,
    HealthModule,
    UsersModule,
    DoctorsModule,
    ClinicsModule,
    SpecialtiesModule,
    StorageModule,
    PatientsModule,
    BillingModule,
    AppointmentsModule,
    ClinicScheduleModule,
    LookupsModule,
    TranslationsModule,
    NotesModule,
    PdfModule,
    LabsModule,
    InventoryModule,
    EmailModule,
    NotificationsModule,
    PermissionsModule,
    BookingModule,
    DashboardModule,
    AiModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },

    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
