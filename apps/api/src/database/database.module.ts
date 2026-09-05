import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import type { Env } from '@api/config/env.schema';
import * as schema from '@api/database/schema';

/** Injection token for the Drizzle instance. */
export const DATABASE = Symbol('DATABASE');
/** Injection token for the underlying postgres.js client (migrations, shutdown). */
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Sql =>
        postgres(config.get('DATABASE_URL', { infer: true }), {
          max: config.get('DATABASE_POOL_MAX', { infer: true }),
          // Surface connection problems to /health instead of hanging a request.
          connect_timeout: 10,
        }),
    },
    {
      provide: DATABASE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: Sql): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DATABASE, POSTGRES_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
