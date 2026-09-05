import { ConflictException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  Paginated,
  PatientClinicalView,
  PatientPublicView,
  PatientView,
  UpdatePatientInput,
  UserRole,
} from '@clinic/shared';
import { desc, eq, or, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { patients } from '@api/database/schema';
import { PatientAccessService, type PatientRow } from '@api/patients/patient-access.service';

export const PATIENTS_ENTITY = 'patients';

/** File numbers are zero-padded so they sort and read like a paper file. */
const FILE_NUMBER_WIDTH = 5;
/** Bounded retry when two receptionists register a patient at the same moment. */
const FILE_NUMBER_ATTEMPTS = 5;

@Injectable()
export class PatientsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(PATIENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(patients)
        .where(this.scope.where(patients, clinicId, eq(patients.id, id)))
        .limit(1);

      return row ? { ...toClinicalView(row) } : null;
    });
  }

  /**
   * Search by file number, name or phone in one box — what reception actually
   * types. The trigram indexes on those three columns keep the partial match an
   * index scan rather than a sequential one.
   */
  async list(actor: AuthenticatedUser, query: ListPatientsQuery): Promise<Paginated<PatientView>> {
    const filters: (SQL | undefined)[] = [];

    if (query.gender) {
      filters.push(eq(patients.gender, query.gender));
    }

    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      filters.push(
        or(
          sql`${patients.fullName} ilike ${pattern}`,
          sql`${patients.phone} ilike ${pattern}`,
          sql`${patients.fileNumber} ilike ${pattern}`,
        ),
      );
    }

    const where = this.scope.where(patients, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(patients)
        .where(where)
        .orderBy(desc(patients.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(patients)
        .where(where),
    ]);

    return toPaginated(
      rows.map((row) => toRoleView(row, actor.role)),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<PatientView> {
    const row = await this.scope.findOneOrFail<PatientRow>(patients, actor.clinicId, id);
    return toRoleView(row, actor.role);
  }

  async create(actor: AuthenticatedUser, input: CreatePatientInput): Promise<PatientView> {
    const row = await this.insertWithFileNumber(actor, input);
    return toRoleView(row, actor.role);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdatePatientInput,
  ): Promise<PatientView> {
    await this.scope.findOneOrFail<PatientRow>(patients, actor.clinicId, id);

    const [row] = await this.db
      .update(patients)
      .set({
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth ?? null }),
        ...(input.gender !== undefined && { gender: input.gender ?? null }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        ...(input.nationalId !== undefined && { nationalId: input.nationalId ?? null }),
        ...(input.emergencyContactName !== undefined && {
          emergencyContactName: input.emergencyContactName ?? null,
        }),
        ...(input.emergencyContactPhone !== undefined && {
          emergencyContactPhone: input.emergencyContactPhone ?? null,
        }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(patients, actor.clinicId, eq(patients.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just loaded within this clinic. */
    if (!row) {
      throw new Error('Failed to update patient');
    }

    return toRoleView(row, actor.role);
  }

  /** Soft delete — a medical record is never removed (CLAUDE.md). */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<PatientRow>(patients, actor.clinicId, id);

    await this.db
      .update(patients)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(patients, actor.clinicId, eq(patients.id, id)));
  }

  /**
   * Allocates the next per-clinic file number and inserts.
   *
   * The number is derived from the current maximum, which two concurrent
   * registrations can read identically; the unique index is the real guard and
   * a conflict simply means trying again with the next value.
   */
  private async insertWithFileNumber(
    actor: AuthenticatedUser,
    input: CreatePatientInput,
  ): Promise<PatientRow> {
    for (let attempt = 0; attempt < FILE_NUMBER_ATTEMPTS; attempt += 1) {
      const fileNumber = await this.nextFileNumber(actor.clinicId, attempt);

      try {
        const [row] = await this.db
          .insert(patients)
          .values({
            clinicId: actor.clinicId,
            fileNumber,
            fullName: input.fullName,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth ?? null,
            gender: input.gender ?? null,
            address: input.address ?? null,
            nationalId: input.nationalId ?? null,
            emergencyContactName: input.emergencyContactName ?? null,
            emergencyContactPhone: input.emergencyContactPhone ?? null,
            notes: input.notes ?? null,
            createdBy: actor.id,
            updatedBy: actor.id,
          })
          .returning();

        if (row) {
          return row;
        }
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException('Could not allocate a file number, please retry');
  }

  private async nextFileNumber(clinicId: string, offset: number): Promise<string> {
    const [result] = await this.db
      .select({
        // Non-numeric file numbers (imported records) are ignored rather than
        // breaking the cast.
        max: sql<number>`coalesce(max(nullif(regexp_replace(${patients.fileNumber}, '\\D', '', 'g'), '')::bigint), 0)::int`,
      })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    return String((result?.max ?? 0) + 1 + offset).padStart(FILE_NUMBER_WIDTH, '0');
  }
}

function toClinicalView(row: PatientRow): PatientClinicalView {
  return {
    id: row.id,
    clinicId: row.clinicId,
    fileNumber: row.fileNumber,
    fullName: row.fullName,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    address: row.address,
    nationalId: row.nationalId,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicView(row: PatientRow): PatientPublicView {
  return {
    id: row.id,
    fileNumber: row.fileNumber,
    fullName: row.fullName,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth,
  };
}

/**
 * The response shape is chosen by role, not by endpoint
 * (ROLES.md enforcement step 5).
 */
export function toRoleView(row: PatientRow, role: UserRole): PatientView {
  return PatientAccessService.seesClinicalData(role) ? toClinicalView(row) : toPublicView(row);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}
