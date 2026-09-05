import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { AllergyFlags, MedicalHistory, UpdateMedicalHistoryInput } from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { medicalHistories } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

type MedicalHistoryRow = typeof medicalHistories.$inferSelect;

export const MEDICAL_HISTORIES_ENTITY = 'medical_histories';

@Injectable()
export class MedicalHistoriesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(MEDICAL_HISTORIES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(medicalHistories)
        .where(this.scope.where(medicalHistories, clinicId, eq(medicalHistories.patientId, id)))
        .limit(1);

      return row ? { ...toMedicalHistory(row) } : null;
    });
  }

  /**
   * Admin and doctor only. Returns an empty record rather than 404 when nothing
   * has been filled in yet — every patient conceptually has a history.
   */
  async get(actor: AuthenticatedUser, patientId: string): Promise<MedicalHistory> {
    await this.patientAccess.requirePatientId(actor, patientId);
    const row = await this.findRow(actor.clinicId, patientId);

    return row ? toMedicalHistory(row) : emptyHistory(actor.clinicId, patientId);
  }

  /**
   * The light endpoint a technician may call.
   *
   * ROLES.md permits the allergy *flag* for safety while forbidding every other
   * medical detail, so this deliberately returns nothing else — no conditions,
   * medications, notes or pregnancy status.
   */
  async allergyFlags(actor: AuthenticatedUser, patientId: string): Promise<AllergyFlags> {
    await this.patientAccess.requirePatientId(actor, patientId);

    const [row] = await this.db
      .select({ allergies: medicalHistories.allergies })
      .from(medicalHistories)
      .where(
        this.scope.where(
          medicalHistories,
          actor.clinicId,
          eq(medicalHistories.patientId, patientId),
        ),
      )
      .limit(1);

    const allergies = row?.allergies ?? [];
    return { patientId, hasAllergies: allergies.length > 0, allergies };
  }

  /** Upsert: the 1:1 row is created on first write. */
  async update(
    actor: AuthenticatedUser,
    patientId: string,
    input: UpdateMedicalHistoryInput,
  ): Promise<MedicalHistory> {
    await this.patientAccess.requirePatientId(actor, patientId);
    const existing = await this.findRow(actor.clinicId, patientId);

    if (!existing) {
      const [created] = await this.db
        .insert(medicalHistories)
        .values({
          clinicId: actor.clinicId,
          patientId,
          chronicConditions: input.chronicConditions ?? [],
          allergies: input.allergies ?? [],
          currentMedications: input.currentMedications ?? [],
          isPregnant: input.isPregnant ?? null,
          notes: input.notes ?? null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!created) {
        throw new Error('Failed to create medical history');
      }

      return toMedicalHistory(created);
    }

    const [row] = await this.db
      .update(medicalHistories)
      .set({
        ...(input.chronicConditions !== undefined && {
          chronicConditions: input.chronicConditions,
        }),
        ...(input.allergies !== undefined && { allergies: input.allergies }),
        ...(input.currentMedications !== undefined && {
          currentMedications: input.currentMedications,
        }),
        ...(input.isPregnant !== undefined && { isPregnant: input.isPregnant ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(
        this.scope.where(medicalHistories, actor.clinicId, eq(medicalHistories.id, existing.id)),
      )
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new Error('Failed to update medical history');
    }

    return toMedicalHistory(row);
  }

  private async findRow(
    clinicId: string,
    patientId: string,
  ): Promise<MedicalHistoryRow | undefined> {
    const [row] = await this.db
      .select()
      .from(medicalHistories)
      .where(
        this.scope.where(medicalHistories, clinicId, eq(medicalHistories.patientId, patientId)),
      )
      .limit(1);

    return row;
  }
}

function toMedicalHistory(row: MedicalHistoryRow): MedicalHistory {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    chronicConditions: row.chronicConditions,
    allergies: row.allergies,
    currentMedications: row.currentMedications,
    isPregnant: row.isPregnant,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shape returned before anything has been recorded. */
function emptyHistory(clinicId: string, patientId: string): MedicalHistory {
  const now = new Date().toISOString();

  return {
    id: '00000000-0000-4000-8000-000000000000',
    clinicId,
    patientId,
    chronicConditions: [],
    allergies: [],
    currentMedications: [],
    isPregnant: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}
