import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { healthResponseSchema, type HealthResponse } from '@clinic/shared';
import { sql } from 'drizzle-orm';

import type { Env } from '../config/env.schema';
import { DATABASE, type Database } from '../database/database.module';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Liveness + database connectivity. The response is validated with the same
   * shared Zod schema the web app parses it with, so a drift between the two
   * fails here rather than in the browser.
   */
  async check(): Promise<HealthResponse> {
    const database = (await this.pingDatabase()) ? 'up' : 'down';

    return healthResponseSchema.parse({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      version: this.config.get('APP_VERSION', { infer: true }),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    } satisfies HealthResponse);
  }

  private async pingDatabase(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        'Database health probe failed',
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }
}
