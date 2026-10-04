import { BadRequestException, Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  localDate,
  type CreateDoctorExtraHoursInput,
  type DoctorExtraHours,
  type ListDoctorExtraHoursQuery,
  type Paginated,
} from "@clinic/shared";
import { count, eq, gte, lte, type SQL, desc } from "drizzle-orm";
import { AppointmentAccessService } from "@api/modules/appointments/services/appointment-access.service";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import { doctorExtraHours, doctors } from "@api/database/schema";
import { DOCTOR_EXTRA_HOURS_ENTITY } from "@api/common/constants/audit-entities";
import { toDoctorExtraHours, ExtraHoursRow } from "@api/modules/schedule/lib/doctor-extra-hours";

@Injectable()
export class DoctorExtraHoursService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly access: AppointmentAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(DOCTOR_EXTRA_HOURS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(doctorExtraHours)
        .where(this.scope.where(doctorExtraHours, clinicId, eq(doctorExtraHours.id, id)))
        .limit(1);

      return row ? { ...toDoctorExtraHours(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    doctorId: string,
    query: ListDoctorExtraHoursQuery,
  ): Promise<Paginated<DoctorExtraHours>> {
    await this.scope.findOneOrFail(doctors, actor.clinicId, doctorId);

    const filters: (SQL | undefined)[] = [eq(doctorExtraHours.doctorId, doctorId)];

    if (query.from) {
      filters.push(gte(doctorExtraHours.date, query.from));
    }
    if (query.to) {
      filters.push(lte(doctorExtraHours.date, query.to));
    }

    const where = this.scope.where(doctorExtraHours, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(doctorExtraHours)
        .where(where)
        .orderBy(desc(doctorExtraHours.date))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(doctorExtraHours).where(where),
    ]);

    return toPaginated(rows.map(toDoctorExtraHours), totals?.value ?? 0, query);
  }

  async create(
    actor: AuthenticatedUser,
    doctorId: string,
    input: CreateDoctorExtraHoursInput,
  ): Promise<DoctorExtraHours> {
    await this.scope.findOneOrFail(doctors, actor.clinicId, doctorId);
    await this.access.requireOwnCalendar(actor, doctorId);

    if (input.date < localDate(new Date(), await clinicTimeZone(this.db, actor.clinicId))) {
      throw new BadRequestException("Extra hours cannot be given on a past date");
    }

    const [created] = await this.db
      .insert(doctorExtraHours)
      .values({
        clinicId: actor.clinicId,
        doctorId,
        date: input.date,
        ranges: input.ranges,
        reason: input.reason,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to record the extra hours");
    }

    return toDoctorExtraHours(created);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.scope.findOneOrFail<ExtraHoursRow>(
      doctorExtraHours,
      actor.clinicId,
      id,
    );

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    await this.db
      .update(doctorExtraHours)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(doctorExtraHours, actor.clinicId, eq(doctorExtraHours.id, id)));
  }
}
