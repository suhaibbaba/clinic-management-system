import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  type AllergyFlags,
  type MedicalHistory,
  type UpdateMedicalHistoryInput,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { medicalHistories } from "@api/database/schema";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { MEDICAL_HISTORIES_ENTITY } from "@api/modules/patients/constants";
import {
  toMedicalHistory,
  emptyHistory,
  MedicalHistoryRow,
} from "@api/modules/patients/lib/medical-histories";

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

  async get(actor: AuthenticatedUser, patientId: string): Promise<MedicalHistory> {
    await this.patientAccess.requirePatientId(actor, patientId);
    const row = await this.findRow(actor.clinicId, patientId);

    return row ? toMedicalHistory(row) : emptyHistory(actor.clinicId, patientId);
  }

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

      if (!created) {
        throw new Error("Failed to create medical history");
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

    if (!row) {
      throw new Error("Failed to update medical history");
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
