import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  AI_AUTOMATION_MODE,
  AI_AUTOMATION_RULES,
  AI_AUTOMATION_RUN_STATUS,
  AI_AUTOMATION_SETTINGS_KEY,
  AI_OUTBOUND_ERROR,
  AI_OUTBOUND_TARGET,
  aiAutomationSettings,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  minutesFromLocalMidnight,
  type AiAutomationRule,
  type AiAutomationSettings,
} from "@clinic/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { OutboundError, ProposalsService } from "@api/ai/outbound/proposals.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import type { Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { aiAutomationRuns, clinics } from "@api/database/schema";

// What each rule asks the model to phrase. Fixed here, never taken from a row: the automation's
// wording is not something a patient's data can steer.
const RULE_INTENTS: Record<AiAutomationRule, string> = {
  [AI_OUTBOUND_TARGET.OVERDUE_LABS]:
    "Tell the patient their lab work is taking longer than expected, apologise, and say the " +
    "clinic will contact them as soon as it arrives.",
  [AI_OUTBOUND_TARGET.UNPAID_INVOICES]:
    "Politely remind the patient that they have an outstanding balance with the clinic and " +
    "invite them to get in touch with any question.",
  [AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS]:
    "Remind the patient of their appointment tomorrow, naming the doctor and the time.",
};

export type RunOutcome = "skipped" | "off" | "done" | "failed";

@Injectable()
export class AutomationService {
  private readonly logger = new Logger("Assistant");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly proposals: ProposalsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async settings(clinicId: string): Promise<AiAutomationSettings> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return aiAutomationSettings(row?.settings);
  }

  // One key of the clinic's settings, merged in place, so an edit here cannot overwrite what the
  // clinic page saved beside it.
  async updateSettings(
    actor: AuthenticatedUser,
    input: AiAutomationSettings,
  ): Promise<AiAutomationSettings> {
    await this.db
      .update(clinics)
      .set({
        settings: sql`${clinics.settings} || jsonb_build_object(${AI_AUTOMATION_SETTINGS_KEY}::text, ${JSON.stringify(input)}::jsonb)`,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)));

    return this.settings(actor.clinicId);
  }

  // Hourly, so each clinic runs at its own local hour and a restart at nine loses nothing: the run
  // record, not the clock, is what makes it once a day.
  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    // The suites drive `runClinic` themselves; a tick landing mid-suite would claim their day.
    if (this.config.get("NODE_ENV", { infer: true }) === "test") {
      return;
    }

    const hour = this.config.get("AI_AUTOMATION_HOUR", { infer: true });
    const rows = await this.db
      .select({ id: clinics.id, settings: clinics.settings })
      .from(clinics)
      .where(isNull(clinics.deletedAt));

    for (const clinic of rows) {
      const timeZone = clinicScheduleSettings(clinic.settings).timezone || DEFAULT_TIME_ZONE;
      const now = new Date();
      const today = localDate(now, timeZone);

      if (minutesFromLocalMidnight(now, today, timeZone) < hour * 60) {
        continue;
      }

      await this.runClinic(clinic.id, today);
    }
  }

  /** Every rule for one clinic and day. Exposed for the tests, which drive it without the clock. */
  async runClinic(
    clinicId: string,
    runDate: string,
  ): Promise<Record<AiAutomationRule, RunOutcome>> {
    const outcomes = {} as Record<AiAutomationRule, RunOutcome>;

    for (const rule of AI_AUTOMATION_RULES) {
      // One clinic's broken rule must not stop the next rule, or the next clinic.
      try {
        outcomes[rule] = await this.runRule(clinicId, rule, runDate);
      } catch (error) {
        this.logger.error(`Automation ${rule} for clinic ${clinicId} failed: ${String(error)}`);
        outcomes[rule] = "failed";
      }
    }

    return outcomes;
  }

  async runRule(clinicId: string, rule: AiAutomationRule, runDate: string): Promise<RunOutcome> {
    const settings = await this.settings(clinicId);
    const mode = settings.rules[rule].mode;

    if (mode === AI_AUTOMATION_MODE.OFF) {
      return "off";
    }

    // Claimed before anything is drafted. A second run finds the row and stops, whatever became
    // of the first — a crash mid-send is never retried into a second message.
    const [run] = await this.db
      .insert(aiAutomationRuns)
      .values({ clinicId, rule, runDate })
      .onConflictDoNothing()
      .returning({ id: aiAutomationRuns.id });

    if (!run) {
      return "skipped";
    }

    try {
      const proposal = await this.proposals.draftForRule(clinicId, rule, RULE_INTENTS[rule]);

      if (mode === AI_AUTOMATION_MODE.AUTO_SEND) {
        await this.proposals.sendAsSystem(clinicId, proposal.id);
      }

      await this.finish(run.id, AI_AUTOMATION_RUN_STATUS.DONE, {
        proposalId: proposal.id,
        recipientCount: proposal.recipients.length,
      });

      return "done";
    } catch (error) {
      if (error instanceof OutboundError && error.code === AI_OUTBOUND_ERROR.NO_RECIPIENTS) {
        await this.finish(run.id, AI_AUTOMATION_RUN_STATUS.DONE, { recipientCount: 0 });

        return "done";
      }

      await this.finish(run.id, AI_AUTOMATION_RUN_STATUS.FAILED, {
        error: error instanceof OutboundError ? error.code : String(error).slice(0, 300),
      });

      if (!(error instanceof OutboundError)) {
        this.logger.error(`Automation ${rule} for clinic ${clinicId} failed: ${String(error)}`);
      }

      return "failed";
    }
  }

  private async finish(
    runId: string,
    status: (typeof AI_AUTOMATION_RUN_STATUS)[keyof typeof AI_AUTOMATION_RUN_STATUS],
    values: { proposalId?: string; recipientCount?: number; error?: string },
  ): Promise<void> {
    await this.db
      .update(aiAutomationRuns)
      .set({ status, ...values, updatedAt: new Date() })
      .where(eq(aiAutomationRuns.id, runId));
  }
}
