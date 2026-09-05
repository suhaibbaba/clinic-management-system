import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  CreatePrescriptionInput,
  ListPrescriptionsQuery,
  Paginated,
  Prescription,
  UpdatePrescriptionInput,
} from '@clinic/shared';
import { desc, eq, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, prescriptions } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

type PrescriptionRow = typeof prescriptions.$inferSelect;

export const PRESCRIPTIONS_ENTITY = 'prescriptions';

/** Admin and doctor only; never reaches a receptionist (ROLES.md field rules). */
@Injectable()
export class PrescriptionsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(PRESCRIPTIONS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(prescriptions)
        .where(this.scope.where(prescriptions, clinicId, eq(prescriptions.id, id)))
        .limit(1);

      return row ? { ...toPrescription(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListPrescriptionsQuery,
  ): Promise<Paginated<Prescription>> {
    const filters: (SQL | undefined)[] = [];

    if (query.patientId) {
      await this.patientAccess.requirePatientId(actor, query.patientId);
      filters.push(eq(prescriptions.patientId, query.patientId));
    }
    if (query.visitId) {
      filters.push(eq(prescriptions.visitId, query.visitId));
    }

    const where = this.scope.where(prescriptions, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(prescriptions)
        .where(where)
        .orderBy(desc(prescriptions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(prescriptions)
        .where(where),
    ]);

    return toPaginated(rows.map(toPrescription), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Prescription> {
    return toPrescription(
      await this.scope.findOneOrFail<PrescriptionRow>(prescriptions, actor.clinicId, id),
    );
  }

  async create(actor: AuthenticatedUser, input: CreatePrescriptionInput): Promise<Prescription> {
    await this.patientAccess.requirePatientId(actor, input.patientId);
    await this.requireDoctor(actor, input.doctorId);

    const [row] = await this.db
      .insert(prescriptions)
      .values({
        clinicId: actor.clinicId,
        patientId: input.patientId,
        visitId: input.visitId ?? null,
        doctorId: input.doctorId,
        items: [...input.items],
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create prescription');
    }

    return toPrescription(row);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdatePrescriptionInput,
  ): Promise<Prescription> {
    await this.scope.findOneOrFail<PrescriptionRow>(prescriptions, actor.clinicId, id);

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    const [row] = await this.db
      .update(prescriptions)
      .set({
        ...(input.visitId !== undefined && { visitId: input.visitId ?? null }),
        ...(input.doctorId !== undefined && { doctorId: input.doctorId }),
        ...(input.items !== undefined && { items: [...input.items] }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(prescriptions, actor.clinicId, eq(prescriptions.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new Error('Failed to update prescription');
    }

    return toPrescription(row);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<PrescriptionRow>(prescriptions, actor.clinicId, id);

    await this.db
      .update(prescriptions)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(prescriptions, actor.clinicId, eq(prescriptions.id, id)));
  }

  private async requireDoctor(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException('Doctor not found in this clinic');
    }
  }
}

export function toPrescription(row: PrescriptionRow): Prescription {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    visitId: row.visitId,
    doctorId: row.doctorId,
    items: row.items,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
