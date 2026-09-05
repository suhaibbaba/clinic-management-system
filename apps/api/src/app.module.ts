import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AuditInterceptor } from '@api/audit/audit.interceptor';
import { AuditModule } from '@api/audit/audit.module';
import { AuthModule } from '@api/auth/auth.module';
import { ClinicsModule } from '@api/clinics/clinics.module';
import { JwtAuthGuard } from '@api/common/guards/jwt-auth.guard';
import { RolesGuard } from '@api/common/guards/roles.guard';
import { AppConfigModule } from '@api/config/config.module';
import { DatabaseModule } from '@api/database/database.module';
import { DoctorsModule } from '@api/doctors/doctors.module';
import { HealthModule } from '@api/health/health.module';
import { PatientsModule } from '@api/patients/patients.module';
import { SpecialtiesModule } from '@api/specialties/specialties.module';
import { StorageModule } from '@api/storage/storage.module';
import { UsersModule } from '@api/users/users.module';

/**
 * Root module. Domain modules are added here as the phases in CLAUDE.md are
 * built: `core` (clinics, specialties, doctors, users/roles, settings, audit
 * log) and `patients` (the patient record and everything attached to it).
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    AuditModule,
    HealthModule,
    UsersModule,
    DoctorsModule,
    ClinicsModule,
    SpecialtiesModule,
    StorageModule,
    PatientsModule,
  ],
  providers: [
    // Global validation: every DTO is a Zod schema from @clinic/shared wrapped
    // with `createZodDto`. Validation is never duplicated per controller.
    { provide: APP_PIPE, useClass: ZodValidationPipe },

    // ROLES.md enforcement order: authenticate, then check the role. Guards run
    // in registration order, so JwtAuthGuard must come first — RolesGuard needs
    // the caller it attaches.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Inert unless a handler carries @Audit(...).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
