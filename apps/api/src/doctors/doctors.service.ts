import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import {
  USER_ROLE,
  type ChartType,
  type CreateDoctorInput,
  type Doctor,
  type ListDoctorsQuery,
  type Paginated,
  type UpdateDoctorInput,
  type UpdateDoctorScheduleInput,
  type WeeklySchedule,
} from '@clinic/shared';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, specialties, users } from '@api/database/schema';

type DoctorRow = typeof doctors.$inferSelect;

export const DOCTORS_ENTITY = 'doctors';

/** Doctor row joined with the parts of its user and specialty the API exposes. */
const doctorColumns = {
  id: doctors.id,
  clinicId: doctors.clinicId,
  userId: doctors.userId,
  specialtyId: doctors.specialtyId,
  weeklySchedule: doctors.weeklySchedule,
  defaultAppointmentDurationMinutes: doctors.defaultAppointmentDurationMinutes,
  createdAt: doctors.createdAt,
  updatedAt: doctors.updatedAt,
  userName: users.name,
  userPhone: users.phone,
  userEmail: users.email,
  userIsActive: users.isActive,
  specialtyCode: specialties.code,
  specialtyName: specialties.name,
  specialtyChartType: specialties.chartType,
};

/** Spelled out rather than derived: a mapped type over the columns loses which of them are nullable. */
interface DoctorJoinedRow {
  id: string;
  clinicId: string;
  userId: string;
  specialtyId: string;
  weeklySchedule: WeeklySchedule;
  defaultAppointmentDurationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  userName: string;
  userPhone: string;
  userEmail: string | null;
  userIsActive: boolean;
  specialtyCode: string;
  specialtyName: string;
  specialtyChartType: ChartType;
}

@Injectable()
export class DoctorsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(DOCTORS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select({
          id: doctors.id,
          clinicId: doctors.clinicId,
          userId: doctors.userId,
          specialtyId: doctors.specialtyId,
          weeklySchedule: doctors.weeklySchedule,
          defaultAppointmentDurationMinutes: doctors.defaultAppointmentDurationMinutes,
        })
        .from(doctors)
        .where(this.scope.where(doctors, clinicId, eq(doctors.id, id)))
        .limit(1);

      return row ?? null;
    });
  }

  /** Readable by every role (ROLES.md core matrix). */
  async list(actor: AuthenticatedUser, query: ListDoctorsQuery): Promise<Paginated<Doctor>> {
    const filters: (SQL | undefined)[] = [];

    if (query.specialtyId) {
      filters.push(eq(doctors.specialtyId, query.specialtyId));
    }
    if (query.isActive !== undefined) {
      filters.push(eq(users.isActive, query.isActive));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(or(ilike(users.name, pattern), ilike(users.phone, pattern)));
    }

    const where = this.scope.where(doctors, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.baseQuery().where(where).orderBy(desc(doctors.createdAt)).limit(limit).offset(offset),
      this.db
        .select({ value: count() })
        .from(doctors)
        .innerJoin(users, eq(users.id, doctors.userId))
        .innerJoin(specialties, eq(specialties.id, doctors.specialtyId))
        .where(where),
    ]);

    return toPaginated(rows.map(toDoctor), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Doctor> {
    return toDoctor(await this.findJoinedOrFail(actor.clinicId, id));
  }

  async create(actor: AuthenticatedUser, input: CreateDoctorInput): Promise<Doctor> {
    const [user] = await this.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(this.scope.where(users, actor.clinicId, eq(users.id, input.userId)))
      .limit(1);

    if (!user) {
      throw new BadRequestException('User not found in this clinic');
    }

    if (user.role !== USER_ROLE.DOCTOR) {
      throw new BadRequestException('The linked user must have the doctor role');
    }

    const [specialty] = await this.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(this.scope.where(specialties, actor.clinicId, eq(specialties.id, input.specialtyId)))
      .limit(1);

    if (!specialty) {
      throw new BadRequestException('Specialty not found in this clinic');
    }

    const [existing] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.userId, input.userId)))
      .limit(1);

    if (existing) {
      throw new ConflictException('This user already has a doctor profile');
    }

    const [created] = await this.db
      .insert(doctors)
      .values({
        clinicId: actor.clinicId,
        userId: input.userId,
        specialtyId: input.specialtyId,
        weeklySchedule: input.weeklySchedule,
        defaultAppointmentDurationMinutes: input.defaultAppointmentDurationMinutes,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: doctors.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!created) {
      throw new Error('Failed to create doctor');
    }

    return toDoctor(await this.findJoinedOrFail(actor.clinicId, created.id));
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateDoctorInput): Promise<Doctor> {
    await this.scope.findOneOrFail<DoctorRow>(doctors, actor.clinicId, id);

    if (input.specialtyId) {
      const [specialty] = await this.db
        .select({ id: specialties.id })
        .from(specialties)
        .where(this.scope.where(specialties, actor.clinicId, eq(specialties.id, input.specialtyId)))
        .limit(1);

      if (!specialty) {
        throw new BadRequestException('Specialty not found in this clinic');
      }
    }

    await this.db
      .update(doctors)
      .set({
        ...(input.specialtyId !== undefined && { specialtyId: input.specialtyId }),
        ...(input.weeklySchedule !== undefined && { weeklySchedule: input.weeklySchedule }),
        ...(input.defaultAppointmentDurationMinutes !== undefined && {
          defaultAppointmentDurationMinutes: input.defaultAppointmentDurationMinutes,
        }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, id)));

    return toDoctor(await this.findJoinedOrFail(actor.clinicId, id));
  }

  /**
   * An admin may edit any schedule; a doctor may edit only their own
   * (ROLES.md: "doctor R (own U: schedule off-days)").
   */
  async updateSchedule(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateDoctorScheduleInput,
  ): Promise<Doctor> {
    const doctor = await this.scope.findOneOrFail<DoctorRow>(doctors, actor.clinicId, id);

    if (actor.role !== USER_ROLE.ADMIN && doctor.userId !== actor.id) {
      throw new ForbiddenException('You may only change your own schedule');
    }

    await this.db
      .update(doctors)
      .set({ weeklySchedule: input.weeklySchedule, updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, id)));

    return toDoctor(await this.findJoinedOrFail(actor.clinicId, id));
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<DoctorRow>(doctors, actor.clinicId, id);

    await this.db
      .update(doctors)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, id)));
  }

  private baseQuery() {
    return this.db
      .select(doctorColumns)
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(specialties, eq(specialties.id, doctors.specialtyId));
  }

  private async findJoinedOrFail(clinicId: string, id: string): Promise<DoctorJoinedRow> {
    const [row] = await this.baseQuery()
      .where(
        and(
          this.scope.where(doctors, clinicId, eq(doctors.id, id)),
          isNull(users.deletedAt),
          isNull(specialties.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      // Same 404 as a non-existent id: another clinic's id must not be
      // distinguishable (ROLES.md global rule 1).
      await this.scope.findOneOrFail<DoctorRow>(doctors, clinicId, id);
      throw new Error('Doctor row is missing its user or specialty');
    }

    return row;
  }
}

function toDoctor(row: DoctorJoinedRow): Doctor {
  return {
    id: row.id,
    clinicId: row.clinicId,
    userId: row.userId,
    specialtyId: row.specialtyId,
    weeklySchedule: row.weeklySchedule,
    defaultAppointmentDurationMinutes: row.defaultAppointmentDurationMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: {
      id: row.userId,
      name: row.userName,
      phone: row.userPhone,
      email: row.userEmail,
      isActive: row.userIsActive,
    },
    specialty: {
      id: row.specialtyId,
      code: row.specialtyCode,
      name: row.specialtyName,
      chartType: row.specialtyChartType,
    },
  };
}
