import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppConfigModule } from '@api/config/config.module';
import { DatabaseModule } from '@api/database/database.module';
import { HealthModule } from '@api/health/health.module';

/**
 * Root module. One Nest module per domain module is added here as the phases in
 * CLAUDE.md are built (core, patients, billing, appointments, ...).
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule],
  providers: [
    // Global validation: every DTO is a Zod schema from @clinic/shared wrapped
    // with `createZodDto`. Validation is never duplicated per controller.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
