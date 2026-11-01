import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  addDays,
  CLINIC_MODULES,
  VENDOR_LAST_SPECIALTY,
  VENDOR_MISSING_MODULES,
  missingModules,
  type ClinicModule,
  READ_ONLY_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_EVENT,
  SUBSCRIPTION_STATUS,
  VENDOR_CLINIC_FILTER,
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
import { grantSpecialty, revokeSpecialty } from "@api/database/clinic-specialties";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { conflictFor } from "@api/modules/vendor/lib/vendor-conflicts";
import { VENDOR_ENDING_SOON_DAYS, VENDOR_EVENT_LIMIT } from "@api/modules/vendor/constants";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";

@Injectable()
export class VendorClinicsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly subscriptions: SubscriptionsService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(query: VendorClinicsQuery): Promise<Paginated<VendorClinicSummary>> {
    const where = and(
      query.status === VENDOR_CLINIC_FILTER.REMOVED
        ? isNotNull(clinics.deletedAt)
        : isNull(clinics.deletedAt),
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
    const live = sql`${clinics.deletedAt} is null`;
    const status = (value: string) =>
      count(sql`case when ${live} and ${subscriptions.status} = ${value} then 1 end`);
    const [row] = await this.db
      .select({
        clinics: count(sql`case when ${live} then 1 end`),
        active: status(SUBSCRIPTION_STATUS.ACTIVE),
        trial: status(SUBSCRIPTION_STATUS.TRIAL),
        grace: status(SUBSCRIPTION_STATUS.GRACE),
        suspended: status(SUBSCRIPTION_STATUS.SUSPENDED),
        cancelled: status(SUBSCRIPTION_STATUS.CANCELLED),
        endingSoon: count(
          sql`case when ${live} and ${subscriptions.status} in (${SUBSCRIPTION_STATUS.TRIAL}, ${SUBSCRIPTION_STATUS.ACTIVE}, ${SUBSCRIPTION_STATUS.GRACE}) and ${subscriptions.endsOn} <= ${soon} then 1 end`,
        ),
        readOnly: count(
          sql`case when ${live} and ${inArray(subscriptions.status, [...READ_ONLY_SUBSCRIPTION_STATUSES])} then 1 end`,
        ),
        unmanaged: count(sql`case when ${live} and ${subscriptions.id} is null then 1 end`),
        removed: count(sql`case when ${clinics.deletedAt} is not null then 1 end`),
      })
      .from(clinics)
      .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id));

    return {
      clinics: row?.clinics ?? 0,
      active: row?.active ?? 0,
      trial: row?.trial ?? 0,
      grace: row?.grace ?? 0,
      suspended: row?.suspended ?? 0,
      cancelled: row?.cancelled ?? 0,
      endingSoon: row?.endingSoon ?? 0,
      readOnly: row?.readOnly ?? 0,
      unmanaged: row?.unmanaged ?? 0,
      removed: row?.removed ?? 0,
    };
  }

  async detail(id: string): Promise<VendorClinicDetail> {
    const [row] = await this.db
      .select(SUMMARY_COLUMNS)
      .from(clinics)
      .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(clinics.id, id))
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
      throw conflictFor(error) ?? error;
    }
  }

  async saveModules(
    clinicId: string,
    modules: readonly ClinicModule[],
    actorId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [clinic] = await tx
        .select({
          modules: clinics.modules,
          subscriptionId: subscriptions.id,
          planModules: plans.modules,
        })
        .from(clinics)
        .leftJoin(subscriptions, eq(subscriptions.clinicId, clinics.id))
        .leftJoin(plans, eq(plans.id, subscriptions.planId))
        .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
        .limit(1);

      if (!clinic) {
        throw new NotFoundException("Clinic not found");
      }

      const planModules = clinic.planModules ?? [];
      const wanted = CLINIC_MODULES.filter(
        (module) => modules.includes(module) || planModules.includes(module),
      );

      if (missingModules(wanted).length > 0) {
        throw new BadRequestException(VENDOR_MISSING_MODULES);
      }

      if (clinic.subscriptionId !== null) {
        await tx
          .update(subscriptions)
          .set({
            addOnModules: wanted.filter((module) => !planModules.includes(module)),
            updatedBy: actorId,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, clinic.subscriptionId));
      }

      await tx
        .update(clinics)
        .set({ modules: wanted, updatedAt: new Date() })
        .where(eq(clinics.id, clinicId));
      await this.subscriptions.record(
        tx,
        clinicId,
        actorId,
        SUBSCRIPTION_EVENT.MODULES_CHANGED,
        { modules: clinic.modules },
        { modules: wanted },
      );
    });

    this.permissions.forgetClinic(clinicId);
  }

  async revokeSpecialty(clinicId: string, code: SpecialtyCode, actorId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const active = await tx
        .select({ code: specialties.code })
        .from(specialties)
        .innerJoin(clinics, eq(clinics.id, specialties.clinicId))
        .where(
          and(
            eq(specialties.clinicId, clinicId),
            eq(specialties.isActive, true),
            isNull(specialties.deletedAt),
            isNull(clinics.deletedAt),
          ),
        );

      if (!active.some((entry) => entry.code === code)) {
        throw new NotFoundException("Specialty not granted");
      }

      if (active.length === 1) {
        throw new BadRequestException(VENDOR_LAST_SPECIALTY);
      }

      await revokeSpecialty(tx, clinicId, code);
      await this.subscriptions.record(
        tx,
        clinicId,
        actorId,
        SUBSCRIPTION_EVENT.SPECIALTY_REVOKED,
        { code },
        null,
      );
    });
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
      removedAt: row.removedAt?.toISOString() ?? null,
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
    if (!query.status || query.status === VENDOR_CLINIC_FILTER.REMOVED) {
      return undefined;
    }

    return query.status === VENDOR_CLINIC_FILTER.NONE
      ? isNull(subscriptions.id)
      : eq(subscriptions.status, query.status);
  }
}
