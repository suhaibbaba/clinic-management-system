import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import {
  DOCTOR_USER_REF_MESSAGE,
  USER_ROLE,
  type ChartType,
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  type CreateDoctorInput,
  type CreateVisitingDoctorInput,
  type Doctor,
  type ListDoctorsQuery,
  type Paginated,
  type UpdateDoctorInput,
  type UpdateDoctorScheduleInput,
  type UserRole,
  type WeeklySchedule,
} from "@clinic/shared";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { arabicNameSearch } from "@api/common/database/arabic-search";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { StorageService } from "@api/storage/storage.service";
import { TokenService } from "@api/auth/token.service";
import { UsersService } from "@api/users/users.service";
import { doctors, specialties, users } from "@api/database/schema";

type DoctorRow = typeof doctors.$inferSelect;

export const DOCTORS_ENTITY = "doctors";

const doctorColumns = {
  id: doctors.id,
  clinicId: doctors.clinicId,
  userId: doctors.userId,
  specialtyId: doctors.specialtyId,
  weeklySchedule: doctors.weeklySchedule,
  defaultAppointmentDurationMinutes: doctors.defaultAppointmentDurationMinutes,
  createdAt: doctors.createdAt,
  updatedAt: doctors.updatedAt,
  userNameAr: users.nameAr,
  userNameEn: users.nameEn,
  userPhone: users.phone,
  userEmail: users.email,
  userIsActive: users.isActive,
  userPhotoKey: users.photoKey,
  userRole: users.role,
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
  userNameAr: string;
  userNameEn: string;
  userPhone: string;
  userEmail: string | null;
  userIsActive: boolean;
  userPhotoKey: string | null;
  userRole: UserRole;
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
    private readonly storage: StorageService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
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

  async list(actor: AuthenticatedUser, query: ListDoctorsQuery): Promise<Paginated<Doctor>> {
    const filters: (SQL | undefined)[] = [];

    if (query.specialtyId) {
      filters.push(eq(doctors.specialtyId, query.specialtyId));
    }
    if (query.isActive !== undefined) {
      filters.push(eq(users.isActive, query.isActive));
    }
    const byName = query.search ? arabicNameSearch(users.normalizedName, query.search) : null;

    if (query.search) {
      filters.push(or(byName?.match, ilike(users.phone, `%${query.search}%`)));
    }

    const where = this.scope.where(doctors, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(...(byName ? [byName.rank, byName.closeness] : []), desc(doctors.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(doctors)
        .innerJoin(users, eq(users.id, doctors.userId))
        .innerJoin(specialties, eq(specialties.id, doctors.specialtyId))
        .where(where),
    ]);

    return toPaginated(
      await Promise.all(rows.map((row) => this.present(row))),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Doctor> {
    return this.present(await this.findJoinedOrFail(actor.clinicId, id));
  }

  // The account and the profile in one transaction: a doctor is both, and neither half is any use
  // on its own. `newUser` creates the account here; `userId` links and promotes an existing one.
  async create(actor: AuthenticatedUser, input: CreateDoctorInput): Promise<Doctor> {
    const [specialty] = await this.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(this.scope.where(specialties, actor.clinicId, eq(specialties.id, input.specialtyId)))
      .limit(1);

    if (!specialty) {
      throw new BadRequestException("Specialty not found in this clinic");
    }

    const created = await this.db.transaction(async (tx) => {
      const userId = input.newUser
        ? (
            await this.users.insertUser(tx, actor, {
              ...input.newUser,
              isActive: true,
              role: USER_ROLE.DOCTOR,
            })
          ).id
        : await this.promoteToDoctor(tx, actor, input.userId);

      const [row] = await tx
        .insert(doctors)
        .values({
          clinicId: actor.clinicId,
          userId,
          specialtyId: input.specialtyId,
          weeklySchedule: input.weeklySchedule,
          defaultAppointmentDurationMinutes: input.defaultAppointmentDurationMinutes,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: doctors.id });

      if (!row) {
        throw new Error("Failed to create doctor");
      }

      return row;
    });

    return this.present(await this.findJoinedOrFail(actor.clinicId, created.id));
  }

  // The specialty defaults to the creator's, then to the clinic's first: whoever adds a visitor from
  // a plan is rarely thinking about which specialty they belong to.
  async createVisiting(
    actor: AuthenticatedUser,
    input: CreateVisitingDoctorInput,
  ): Promise<Doctor> {
    const specialtyId = input.specialtyId ?? (await this.defaultSpecialtyId(actor));

    const created = await this.db.transaction(async (tx) => {
      const user = await this.users.insertUser(tx, actor, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email ?? null,
        role: USER_ROLE.VISITING_DOCTOR,
        isActive: true,
      });

      const [row] = await tx
        .insert(doctors)
        .values({
          clinicId: actor.clinicId,
          userId: user.id,
          specialtyId,
          weeklySchedule: [],
          defaultAppointmentDurationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: doctors.id });

      if (!row) {
        throw new Error("Failed to create visiting doctor");
      }

      return row;
    });

    return this.present(await this.findJoinedOrFail(actor.clinicId, created.id));
  }

  private async defaultSpecialtyId(actor: AuthenticatedUser): Promise<string> {
    const [own] = await this.db
      .select({ specialtyId: doctors.specialtyId })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.userId, actor.id)))
      .limit(1);

    if (own) {
      return own.specialtyId;
    }

    const [first] = await this.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(this.scope.where(specialties, actor.clinicId))
      .orderBy(asc(specialties.createdAt))
      .limit(1);

    if (!first) {
      throw new BadRequestException("This clinic has no specialty to add a doctor under");
    }

    return first.id;
  }

  // Linking the rare case: an account that already exists takes the doctor role here rather than on
  // the users screen, which refuses it — that refusal is what makes an orphan impossible.
  private async promoteToDoctor(
    executor: DatabaseExecutor,
    actor: AuthenticatedUser,
    userId: string | undefined,
  ): Promise<string> {
    /* istanbul ignore next -- the create schema refuses a body with neither. */
    if (!userId) {
      throw new BadRequestException(DOCTOR_USER_REF_MESSAGE);
    }

    const [user] = await executor
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(this.scope.where(users, actor.clinicId, eq(users.id, userId)))
      .limit(1);

    if (!user) {
      throw new BadRequestException("User not found in this clinic");
    }

    if (user.id === actor.id && user.role !== USER_ROLE.DOCTOR) {
      throw new BadRequestException("You cannot change your own role");
    }

    const [existing] = await executor
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.userId, userId)))
      .limit(1);

    if (existing) {
      throw new ConflictException("This user already has a doctor profile");
    }

    if (user.role !== USER_ROLE.DOCTOR) {
      await executor
        .update(users)
        .set({ role: USER_ROLE.DOCTOR, updatedAt: new Date(), updatedBy: actor.id })
        .where(this.scope.where(users, actor.clinicId, eq(users.id, userId)));
    }

    return userId;
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
        throw new BadRequestException("Specialty not found in this clinic");
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

    return this.present(await this.findJoinedOrFail(actor.clinicId, id));
  }

  /** An admin may edit any schedule; a doctor only their own (ROLES.md). */
  async updateSchedule(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateDoctorScheduleInput,
  ): Promise<Doctor> {
    const doctor = await this.scope.findOneOrFail<DoctorRow>(doctors, actor.clinicId, id);

    if (actor.role !== USER_ROLE.ADMIN && doctor.userId !== actor.id) {
      throw new ForbiddenException("You may only change your own schedule");
    }

    await this.db
      .update(doctors)
      .set({ weeklySchedule: input.weeklySchedule, updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, id)));

    return this.present(await this.findJoinedOrFail(actor.clinicId, id));
  }

  // The account goes inactive with the profile, in the same transaction: a `doctor` user with no
  // profile left is the orphan the create path exists to prevent, arrived at from the other end.
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    const doctor = await this.scope.findOneOrFail<DoctorRow>(doctors, actor.clinicId, id);

    await this.db.transaction(async (tx) => {
      await tx
        .update(doctors)
        .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, id)));

      await tx
        .update(users)
        .set({ isActive: false, updatedAt: new Date(), updatedBy: actor.id })
        .where(this.scope.where(users, actor.clinicId, eq(users.id, doctor.userId)));
    });

    await this.tokens.revokeAllForUser(doctor.userId);
  }

  private baseQuery() {
    return this.db
      .select(doctorColumns)
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(specialties, eq(specialties.id, doctors.specialtyId));
  }

  private async present(row: DoctorJoinedRow): Promise<Doctor> {
    return toDoctor(
      row,
      row.userPhotoKey ? (await this.storage.createDownloadUrl(row.userPhotoKey)).url : null,
    );
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
      throw new Error("Doctor row is missing its user or specialty");
    }

    return row;
  }
}

function toDoctor(row: DoctorJoinedRow, photoUrl: string | null): Doctor {
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
      name: { ar: row.userNameAr, en: row.userNameEn },
      phone: row.userPhone,
      email: row.userEmail,
      isActive: row.userIsActive,
      photoUrl,
    },
    specialty: {
      id: row.specialtyId,
      code: row.specialtyCode,
      name: row.specialtyName,
      chartType: row.specialtyChartType,
    },
    isVisiting: row.userRole === USER_ROLE.VISITING_DOCTOR,
  };
}
