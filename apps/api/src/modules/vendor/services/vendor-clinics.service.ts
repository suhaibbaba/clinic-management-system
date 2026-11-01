import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  addDays,
  READ_ONLY_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_EVENT,
  SUBSCRIPTION_STATUS,
  VENDOR_CLINIC_FILTER,
  VENDOR_DOMAIN_TAKEN,
  type Paginated,
  type SpecialtyCode,
  type VendorClinicDetail,
  type VendorClinicSummary,
  type VendorClinicsQuery,
  type VendorOverview,
} from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  clinics,
  doctors,
  plans,
  specialties,
  subscriptionEvents,
  subscriptions,
  users,
  vendorUsers,
} from "@api/database/schema";
import {
  SUMMARY_COLUMNS,
  subscriptionOf,
  type SummaryRow,
} from "@api/modules/vendor/lib/vendor-clinic-row";
import { grantSpecialty } from "@api/database/clinic-specialties";
import { violatedConstraint } from "@api/common/lib/postgres-errors";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { VENDOR_ENDING_SOON_DAYS, VENDOR_EVENT_LIMIT } from "@api/modules/vendor/constants";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";

@Injectable()
export class VendorClinicsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(query: VendorClinicsQuery): Promise<Paginated<VendorClinicSummary>> {
    const where = and(
      isNull(clinics.deletedAt),
      this.searchFilter(query),
      this.statusFilter(query),
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select(SUMMARY_COLUMNS)
        .from(clinics)
        .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id))
        .leftJoin(plans, eq(plans.id, subscriptions.planId))
        .where(where)
        .orderBy(desc(clinics.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      this.db
        .select({ value: count() })
        .from(clinics)
        .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id))
        .where(where),
    ]);
    const totalRows = total?.value ?? 0;

    return {
      items: await this.summaries(rows),
      page: query.page,
      limit: query.limit,
      total: totalRows,
      totalPages: Math.ceil(totalRows / query.limit),
    };
  }

  async overview(today: string = new Date().toISOString().slice(0, 10)): Promise<VendorOverview> {
    const soon = addDays(today, VENDOR_ENDING_SOON_DAYS);
    const [row] = await this.db
      .select({
        clinics: count(clinics.id),
        active: count(
          sql`case when ${subscriptions.status} = ${SUBSCRIPTION_STATUS.ACTIVE} then 1 end`,
        ),
        trial: count(
          sql`case when ${subscriptions.status} = ${SUBSCRIPTION_STATUS.TRIAL} then 1 end`,
        ),
        endingSoon: count(
          sql`case when ${subscriptions.status} in (${SUBSCRIPTION_STATUS.TRIAL}, ${SUBSCRIPTION_STATUS.ACTIVE}, ${SUBSCRIPTION_STATUS.GRACE}) and ${subscriptions.endsOn} <= ${soon} then 1 end`,
        ),
        readOnly: count(
          sql`case when ${inArray(subscriptions.status, [...READ_ONLY_SUBSCRIPTION_STATUSES])} then 1 end`,
        ),
        unmanaged: count(sql`case when ${subscriptions.id} is null then 1 end`),
      })
      .from(clinics)
      .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id))
      .where(isNull(clinics.deletedAt));

    return {
      clinics: row?.clinics ?? 0,
      active: row?.active ?? 0,
      trial: row?.trial ?? 0,
      endingSoon: row?.endingSoon ?? 0,
      readOnly: row?.readOnly ?? 0,
      unmanaged: row?.unmanaged ?? 0,
    };
  }

  async detail(id: string): Promise<VendorClinicDetail> {
    const [row] = await this.db
      .select(SUMMARY_COLUMNS)
      .from(clinics)
      .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(and(eq(clinics.id, id), isNull(clinics.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Clinic not found");
    }

    const [[summary], [doctorCount], events] = await Promise.all([
      this.summaries([row]),
      this.db
        .select({ value: count() })
        .from(doctors)
        .where(and(eq(doctors.clinicId, id), isNull(doctors.deletedAt))),
      this.db
        .select({
          id: subscriptionEvents.id,
          action: subscriptionEvents.action,
          actor: vendorUsers.name,
          oldValue: subscriptionEvents.oldValue,
          newValue: subscriptionEvents.newValue,
          createdAt: subscriptionEvents.createdAt,
        })
        .from(subscriptionEvents)
        .leftJoin(vendorUsers, eq(vendorUsers.id, subscriptionEvents.vendorUserId))
        .where(eq(subscriptionEvents.clinicId, id))
        .orderBy(desc(subscriptionEvents.createdAt))
        .limit(VENDOR_EVENT_LIMIT),
    ]);

    if (!summary) {
      throw new NotFoundException("Clinic not found");
    }

    return {
      ...summary,
      doctors: doctorCount?.value ?? 0,
      events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    };
  }

  async grantSpecialty(clinicId: string, code: SpecialtyCode, actorId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [clinic] = await tx
        .select({ id: clinics.id })
        .from(clinics)
        .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
        .limit(1);

      if (!clinic) {
        throw new NotFoundException("Clinic not found");
      }

      await grantSpecialty(tx, clinicId, code);
      await this.subscriptions.record(
        tx,
        clinicId,
        actorId,
        SUBSCRIPTION_EVENT.SPECIALTY_GRANTED,
        null,
        { code },
      );
    });
  }

  async saveDomain(clinicId: string, domain: string | null, actorId: string): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const [clinic] = await tx
          .select({ domain: clinics.siteDomain })
          .from(clinics)
          .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
          .limit(1);

        if (!clinic) {
          throw new NotFoundException("Clinic not found");
        }

        if (clinic.domain === domain) {
          return;
        }

        await tx
          .update(clinics)
          .set({ siteDomain: domain, updatedAt: new Date() })
          .where(eq(clinics.id, clinicId));
        await this.subscriptions.record(
          tx,
          clinicId,
          actorId,
          SUBSCRIPTION_EVENT.DOMAIN_CHANGED,
          { domain: clinic.domain },
          { domain },
        );
      });
    } catch (error) {
      throw violatedConstraint(error, UNIQUE_VIOLATION)
        ? new ConflictException(VENDOR_DOMAIN_TAKEN)
        : error;
    }
  }

  private async summaries(rows: readonly SummaryRow[]): Promise<VendorClinicSummary[]> {
    const ids = rows.map((row) => row.id);

    if (ids.length === 0) {
      return [];
    }

    const [userCounts, specialtyRows] = await Promise.all([
      this.db
        .select({ clinicId: users.clinicId, value: count() })
        .from(users)
        .where(and(inArray(users.clinicId, ids), isNull(users.deletedAt)))
        .groupBy(users.clinicId),
      this.db
        .select({ clinicId: specialties.clinicId, code: specialties.code })
        .from(specialties)
        .where(
          and(
            inArray(specialties.clinicId, ids),
            eq(specialties.isActive, true),
            isNull(specialties.deletedAt),
          ),
        ),
    ]);
    const usersBy = new Map(userCounts.map((entry) => [entry.clinicId, entry.value]));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      domain: row.domain,
      modules: row.modules,
      specialties: specialtyRows
        .filter((entry) => entry.clinicId === row.id)
        .map((entry) => entry.code)
        .sort(),
      users: usersBy.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
      subscription: subscriptionOf(row),
    }));
  }

  private searchFilter(query: VendorClinicsQuery): SQL | undefined {
    if (!query.search) {
      return undefined;
    }

    const pattern = `%${query.search.replaceAll(/[%_\\]/g, (match) => `\\${match}`)}%`;

    return or(
      ilike(clinics.slug, pattern),
      ilike(clinics.siteDomain, pattern),
      sql`${clinics.name}::text ilike ${pattern}`,
    );
  }

  private statusFilter(query: VendorClinicsQuery): SQL | undefined {
    if (!query.status) {
      return undefined;
    }

    return query.status === VENDOR_CLINIC_FILTER.NONE
      ? isNull(subscriptions.id)
      : eq(subscriptions.status, query.status);
  }
}
