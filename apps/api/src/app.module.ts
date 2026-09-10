import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppointmentsModule } from '@api/appointments/appointments.module';
import { AuditInterceptor } from '@api/audit/audit.interceptor';
import { AuditModule } from '@api/audit/audit.module';
import { AuthModule } from '@api/auth/auth.module';
import { BookingModule } from '@api/booking/booking.module';
import { BillingModule } from '@api/billing/billing.module';
import { ClinicsModule } from '@api/clinics/clinics.module';
import { JwtAuthGuard } from '@api/common/guards/jwt-auth.guard';
import { RolesGuard } from '@api/common/guards/roles.guard';
import { AppConfigModule } from '@api/config/config.module';
import { DashboardModule } from '@api/dashboard/dashboard.module';
import { DatabaseModule } from '@api/database/database.module';
import { DoctorsModule } from '@api/doctors/doctors.module';
import { HealthModule } from '@api/health/health.module';
import { InventoryModule } from '@api/inventory/inventory.module';
import { LabsModule } from '@api/labs/labs.module';
import { LookupsModule } from '@api/lookups/lookups.module';
import { PdfModule } from '@api/billing/pdf/pdf.module';
import { NotificationsModule } from '@api/notifications/notifications.module';
import { PatientsModule } from '@api/patients/patients.module';
import { ClinicScheduleModule } from '@api/schedule/clinic-schedule.module';
import { SpecialtiesModule } from '@api/specialties/specialties.module';
import { StorageModule } from '@api/storage/storage.module';
import { UsersModule } from '@api/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    // One process today; with two this needs a lock — the log's dedupe makes a double reminder
    // survivable, not correct.
    ScheduleModule.forRoot(),
    /** A default ceiling for every route, which the public booking endpoints tighten sharply. */
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
    PdfModule,
    LabsModule,
    InventoryModule,
    NotificationsModule,
    BookingModule,
    DashboardModule,
  ],
  providers: [
    // Global validation: every DTO is a Zod schema from @clinic/shared wrapped
    // with `createZodDto`. Validation is never duplicated per controller.
    { provide: APP_PIPE, useClass: ZodValidationPipe },

    // Guards run in registration order, so JwtAuthGuard must come first: RolesGuard needs the
    // caller it attaches.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Inert unless a handler carries @Audit(...).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
