import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  missingModules,
  SUBSCRIPTION_EVENT,
  SUBSCRIPTION_STATUS,
  VENDOR_MISSING_MODULES,
  type ClinicModule,
  type SaveSubscriptionInput,
  type SubscriptionEventAction,
  type SubscriptionStatus,
} from "@clinic/shared";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { clinics, plans, subscriptionEvents, subscriptions } from "@api/database/schema";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { subscriptionModules } from "@api/modules/vendor/lib/subscription-modules";
import { nextStatus } from "@api/modules/vendor/lib/subscription-status";

interface SubscriptionSnapshot {
  readonly planId: string;
  readonly planCode: string;
  readonly addOnModules: readonly ClinicModule[];
  readonly status: SubscriptionStatus;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly graceDays: number;
  readonly notes: string | null;
  readonly modules: readonly ClinicModule[];
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly permissions: PermissionsService,
  ) {}

  async save(clinicId: string, input: SaveSubscriptionInput, actorId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [clinic] = await tx
        .select({ id: clinics.id, modules: clinics.modules })
        .from(clinics)
        .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
        .limit(1);

      if (!clinic) {
        throw new NotFoundException("Clinic not found");
      }

      const [plan] = await tx.select().from(plans).where(eq(plans.id, input.planId)).limit(1);

      if (!plan) {
        throw new BadRequestException("No such plan");
      }

      const modules = subscriptionModules(plan.modules, input.addOnModules);

      if (missingModules(modules).length > 0) {
        throw new BadRequestException(VENDOR_MISSING_MODULES);
      }

      const before = await this.snapshot(tx, clinicId);
      const values = {
        planId: plan.id,
        addOnModules: [...input.addOnModules],
        status: input.status,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        graceDays: input.graceDays,
        notes: input.notes,
        updatedBy: actorId,
        updatedAt: new Date(),
      };

      await tx
        .insert(subscriptions)
        .values({ clinicId, ...values, createdBy: actorId })
        .onConflictDoUpdate({ target: subscriptions.clinicId, set: values });
      await tx
        .update(clinics)
        .set({ modules, updatedAt: new Date() })
        .where(eq(clinics.id, clinicId));
      await this.record(
        tx,
        clinicId,
        actorId,
        SUBSCRIPTION_EVENT.SUBSCRIPTION_SAVED,
        before,
        await this.snapshot(tx, clinicId),
      );
    });

    this.permissions.forgetClinic(clinicId);
  }

  async syncPlan(tx: DatabaseExecutor, planId: string, actorId: string): Promise<string[]> {
    const rows = await tx
      .select({ clinicId: subscriptions.clinicId })
      .from(subscriptions)
      .where(eq(subscriptions.planId, planId));

    for (const { clinicId } of rows) {
      const before = await this.snapshot(tx, clinicId);

      if (!before) {
        continue;
      }

      const [plan] = await tx
        .select({ modules: plans.modules })
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);
      const modules = subscriptionModules(plan?.modules ?? [], before.addOnModules);

      await tx
        .update(clinics)
        .set({ modules, updatedAt: new Date() })
        .where(eq(clinics.id, clinicId));
      await this.record(
        tx,
        clinicId,
        actorId,
        SUBSCRIPTION_EVENT.PLAN_CHANGED,
        before,
        await this.snapshot(tx, clinicId),
      );
    }

    return rows.map((row) => row.clinicId);
  }

  async advance(today: string = new Date().toISOString().slice(0, 10)): Promise<number> {
    const due = await this.db
      .select({
        clinicId: subscriptions.clinicId,
        status: subscriptions.status,
        endsOn: subscriptions.endsOn,
        graceDays: subscriptions.graceDays,
      })
      .from(subscriptions)
      .where(
        and(
          isNotNull(subscriptions.endsOn),
          inArray(subscriptions.status, [
            SUBSCRIPTION_STATUS.TRIAL,
            SUBSCRIPTION_STATUS.ACTIVE,
            SUBSCRIPTION_STATUS.GRACE,
          ]),
        ),
      );

    let moved = 0;

    for (const row of due) {
      const next = nextStatus(row.status, row.endsOn, row.graceDays, today);

      if (next === row.status) {
        continue;
      }

      await this.db.transaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({ status: next, updatedAt: new Date() })
          .where(eq(subscriptions.clinicId, row.clinicId));
        await this.record(
          tx,
          row.clinicId,
          null,
          SUBSCRIPTION_EVENT.STATUS_ADVANCED,
          { status: row.status },
          { status: next },
        );
      });

      this.permissions.forgetClinic(row.clinicId);
      moved += 1;
    }

    if (moved > 0) {
      this.logger.log(`Moved ${moved} subscription(s) on`);
    }

    return moved;
  }

  async record(
    tx: DatabaseExecutor,
    clinicId: string,
    actorId: string | null,
    action: SubscriptionEventAction,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    await tx.insert(subscriptionEvents).values({
      clinicId,
      vendorUserId: actorId,
      action,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
  }

  private async snapshot(
    tx: DatabaseExecutor,
    clinicId: string,
  ): Promise<SubscriptionSnapshot | null> {
    const [row] = await tx
      .select({
        planId: subscriptions.planId,
        planCode: plans.code,
        addOnModules: subscriptions.addOnModules,
        status: subscriptions.status,
        startsOn: subscriptions.startsOn,
        endsOn: subscriptions.endsOn,
        graceDays: subscriptions.graceDays,
        notes: subscriptions.notes,
        modules: clinics.modules,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .innerJoin(clinics, eq(clinics.id, subscriptions.clinicId))
      .where(eq(subscriptions.clinicId, clinicId))
      .limit(1);

    return row ?? null;
  }
}
