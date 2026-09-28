import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { AUTH_ERROR } from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { loginThrottles } from "@api/database/schema";
import {
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MINUTES,
} from "@api/modules/auth/constants";
import { loginThrottleKey } from "@api/modules/auth/lib/login-throttle";

@Injectable()
export class LoginThrottleService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async assertOpen(identifier: string): Promise<void> {
    const [row] = await this.db
      .select({ lockedUntil: loginThrottles.lockedUntil })
      .from(loginThrottles)
      .where(eq(loginThrottles.key, loginThrottleKey(identifier)))
      .limit(1);

    if (row?.lockedUntil && row.lockedUntil > new Date()) {
      throw new HttpException(AUTH_ERROR.LOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(identifier: string): Promise<void> {
    const window = sql`now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})`;
    const failures = sql`case when ${loginThrottles.windowStartedAt} < ${window} then 1 else ${loginThrottles.failures} + 1 end`;

    await this.db
      .insert(loginThrottles)
      .values({ key: loginThrottleKey(identifier), failures: 1 })
      .onConflictDoUpdate({
        target: loginThrottles.key,
        set: {
          failures,
          windowStartedAt: sql`case when ${loginThrottles.windowStartedAt} < ${window} then now() else ${loginThrottles.windowStartedAt} end`,
          lockedUntil: sql`case when ${failures} >= ${LOGIN_MAX_FAILURES} then now() + make_interval(mins => ${LOGIN_LOCK_MINUTES}) else ${loginThrottles.lockedUntil} end`,
        },
      });
  }

  async clear(identifier: string): Promise<void> {
    await this.db
      .delete(loginThrottles)
      .where(eq(loginThrottles.key, loginThrottleKey(identifier)));
  }
}
