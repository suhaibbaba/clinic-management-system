import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AI_ERROR_CODE,
  AI_MESSAGE_ROLE,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  localDate,
  type AiErrorCode,
} from "@clinic/shared";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import type { Env } from "@api/config/env.schema";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiConversations, aiMessages, clinics } from "@api/database/schema";

/** Refused before the model is called, so a limit costs nothing. */
export class AiLimitError extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code);
    this.name = "AiLimitError";
  }
}

const HOUR_MS = 3_600_000;

// Two ceilings, both counted from rows rather than a counter: one person cannot hold the model
// open all afternoon, and one clinic cannot spend a month's tokens in a morning.
@Injectable()
export class AiBudgetService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async assertWithinLimits(actor: AuthenticatedUser): Promise<void> {
    const [asked, spent] = await Promise.all([
      this.questionsThisHour(actor),
      this.tokensToday(actor.clinicId),
    ]);

    if (asked >= this.config.get("AI_RATE_LIMIT_PER_HOUR", { infer: true })) {
      throw new AiLimitError(AI_ERROR_CODE.RATE_LIMITED);
    }

    if (spent >= this.config.get("AI_DAILY_TOKEN_BUDGET", { infer: true })) {
      throw new AiLimitError(AI_ERROR_CODE.BUDGET_EXHAUSTED);
    }
  }

  private async questionsThisHour(actor: AuthenticatedUser): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(aiMessages)
      .innerJoin(aiConversations, eq(aiConversations.id, aiMessages.conversationId))
      .where(
        and(
          eq(aiMessages.clinicId, actor.clinicId),
          eq(aiConversations.userId, actor.id),
          eq(aiMessages.role, AI_MESSAGE_ROLE.USER),
          isNull(aiMessages.deletedAt),
          gte(aiMessages.createdAt, new Date(Date.now() - HOUR_MS)),
        ),
      );

    return row?.value ?? 0;
  }

  // The clinic's own day, not the server's: a budget that rolls over at 2am local is one nobody
  // can reason about.
  private async tokensToday(clinicId: string): Promise<number> {
    const [clinic] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    const timeZone = clinicScheduleSettings(clinic?.settings).timezone || DEFAULT_TIME_ZONE;
    const midnight = instantFromLocal(localDate(new Date(), timeZone), 0, timeZone);

    const [row] = await this.db
      .select({
        value: sql<number>`coalesce(sum(coalesce(${aiMessages.inputTokens}, 0) + coalesce(${aiMessages.outputTokens}, 0)), 0)::int`,
      })
      .from(aiMessages)
      .where(and(eq(aiMessages.clinicId, clinicId), gte(aiMessages.createdAt, midnight)));

    return row?.value ?? 0;
  }
}
