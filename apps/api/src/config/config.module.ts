import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './env.schema';

/**
 * Global config module. Inject `ConfigService<Env, true>` and read values with
 * `config.get('PORT', { infer: true })` for full type inference.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Docker Compose injects the environment; a local .env is a convenience.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
