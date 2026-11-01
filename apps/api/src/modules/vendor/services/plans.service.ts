import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { asc, count, eq } from "drizzle-orm";
import {
  type Paginated,
  type PaginationQuery,
  type Plan,
  type SavePlanInput,
} from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { plans, subscriptions } from "@api/database/schema";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";

@Injectable()
export class PlansService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly subscriptions: SubscriptionsService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(query: PaginationQuery): Promise<Paginated<Plan>> {
    const clinicCount = count(subscriptions.id);
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: plans.id,
          code: plans.code,
          name: plans.name,
          modules: plans.modules,
          maxUsers: plans.maxUsers,
          maxDoctors: plans.maxDoctors,
          isActive: plans.isActive,
          createdAt: plans.createdAt,
          clinicCount,
        })
        .from(plans)
        .leftJoin(subscriptions, eq(subscriptions.planId, plans.id))
        .groupBy(plans.id)
        .orderBy(asc(plans.name))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      this.db.select({ value: count() }).from(plans),
    ]);
    const totalRows = total?.value ?? 0;

    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      page: query.page,
      limit: query.limit,
      total: totalRows,
      totalPages: Math.ceil(totalRows / query.limit),
    };
  }

  async create(input: SavePlanInput, actorId: string): Promise<void> {
    try {
      await this.db.insert(plans).values({ ...input, createdBy: actorId, updatedBy: actorId });
    } catch (error) {
      throw violatedConstraint(error, UNIQUE_VIOLATION)
        ? new ConflictException("A plan has this code")
        : error;
    }
  }

  async update(id: string, input: SavePlanInput, actorId: string): Promise<void> {
    const touched = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(plans)
        .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(plans.id, id))
        .returning({ id: plans.id });

      if (!row) {
        throw new NotFoundException("Plan not found");
      }

      return this.subscriptions.syncPlan(tx, id, actorId);
    });

    for (const clinicId of touched) {
      this.permissions.forgetClinic(clinicId);
    }
  }
}
