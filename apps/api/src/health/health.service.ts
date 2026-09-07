import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_VERSION, healthResponseSchema, type HealthResponse } from '@clinic/shared';
import { sql } from 'drizzle-orm';

import { DATABASE, type Database } from '@api/database/database.module';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

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
      // The build's own version, not the environment's: a version somebody
      // can forget to export is a number that gets believed and is wrong.
      version: APP_VERSION,
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
