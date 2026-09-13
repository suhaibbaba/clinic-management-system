import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  CreatePatientInput,
  Money,
  ListPatientsQuery,
  Paginated,
  PatientView,
  UpdatePatientInput,
} from '@clinic/shared';
import { and, desc, eq, exists, gte, isNull, or, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { LedgerService } from '@api/billing/ledger.service';
import { arabicNameSearch } from '@api/common/database/arabic-search';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { patients, visits } from '@api/database/schema';
import { PatientAccessService, type PatientRow } from '@api/patients/patient-access.service';
import { PatientRegistrationService } from '@api/patients/patient-registration.service';
import { PATIENTS_ENTITY, toClinicalView, toRoleView } from '@api/patients/patient-view';

@Injectable()
export class PatientsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly ledger: LedgerService,
    private readonly registration: PatientRegistrationService,
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

  // One box for file number, name or phone — what reception types.
  async list(actor: AuthenticatedUser, query: ListPatientsQuery): Promise<Paginated<PatientView>> {
    const filters: (SQL | undefined)[] = [];

    if (query.gender) {
      filters.push(eq(patients.gender, query.gender));
    }

    // Asked of the server, and only for roles served balances: honouring it for a technician would
    // leak through the row count what the fields withhold.
    if (query.hasBalance && PatientAccessService.seesFinancialData(actor.role)) {
      filters.push(LedgerService.owesFilter(actor.clinicId, patients.id));
    }

    // Attendance, not clinical content: who came in since a date. `exists` rather than a join, so a
    // patient seen three times in the month is still one row.
    if (query.visitedSince) {
      filters.push(
        exists(
          this.db
            .select({ present: sql`1` })
            .from(visits)
            .where(
              and(
                eq(visits.patientId, patients.id),
                eq(visits.clinicId, actor.clinicId),
                isNull(visits.deletedAt),
                gte(visits.visitDate, new Date(query.visitedSince)),
              ),
            ),
        ),
      );
    }

    // Name folded on both sides, phone and file number left exact: those two are typed off a
    // handset or a paper file, and a fuzzy digit match would offer the wrong patient.
    const byName = query.search ? arabicNameSearch(patients.normalizedName, query.search) : null;

    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      filters.push(
        or(
          byName?.match,
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
        // An exactly-folded match outranks a trigram guess, whichever was registered first.
        .orderBy(...(byName ? [byName.rank, byName.closeness] : []), desc(patients.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(patients)
        .where(where),
    ]);

    // One aggregate for the whole page rather than one per row.
    const balances = PatientAccessService.seesFinancialData(actor.role)
      ? await this.ledger.balancesFor(
          actor.clinicId,
          rows.map((row) => row.id),
        )
      : new Map<string, Money>();

    return toPaginated(
      rows.map((row) => toRoleView(row, actor.role, balances.get(row.id))),
      totals?.value ?? 0,
      query,
    );
  }

  /** The patient header, balance included — computed, never stored. */
  async findOne(actor: AuthenticatedUser, id: string): Promise<PatientView> {
    const row = await this.scope.findOneOrFail<PatientRow>(patients, actor.clinicId, id);
    const balance = PatientAccessService.seesFinancialData(actor.role)
      ? (await this.ledger.balanceFor(actor.clinicId, row.id)).balance
      : undefined;

    return toRoleView(row, actor.role, balance);
  }

  // No duplicate-phone check here, unlike the inline form: a mother and her child share a handset,
  // and this is the screen that exists for registering the second of them.
  async create(actor: AuthenticatedUser, input: CreatePatientInput): Promise<PatientView> {
    const row = await this.registration.insertPatient(this.db, actor, input);

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
}
