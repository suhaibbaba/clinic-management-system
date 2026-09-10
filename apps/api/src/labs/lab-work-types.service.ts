import { Inject, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import {
  type CreateLabWorkTypeInput,
  type LabWorkType,
  type UpdateLabWorkTypeInput,
} from '@clinic/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { LabsService } from '@api/labs/labs.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { labWorkTypes, labs } from '@api/database/schema';

type WorkTypeRow = typeof labWorkTypes.$inferSelect;

export const LAB_WORK_TYPES_ENTITY = 'lab_work_types';

// Rows hang off the lab, so the clinic scope check happens once, on the lab, and the table needs no
// `clinic_id` of its own. An order copies the price it was placed at.
@Injectable()
export class LabWorkTypesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly labsService: LabsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(LAB_WORK_TYPES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select({ workType: labWorkTypes })
        .from(labWorkTypes)
        .innerJoin(labs, eq(labs.id, labWorkTypes.labId))
        .where(
          and(eq(labWorkTypes.id, id), eq(labs.clinicId, clinicId), isNull(labWorkTypes.deletedAt)),
        )
        .limit(1);

      return row ? { ...toWorkType(row.workType) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    labId: string,
    includeInactive = false,
  ): Promise<LabWorkType[]> {
    await this.labsService.requireRow(actor.clinicId, labId);

    const rows = await this.db
      .select()
      .from(labWorkTypes)
      .where(
        and(
          eq(labWorkTypes.labId, labId),
          isNull(labWorkTypes.deletedAt),
          includeInactive ? undefined : eq(labWorkTypes.isActive, true),
        ),
      )
      .orderBy(asc(labWorkTypes.nameAr));

    return rows.map(toWorkType);
  }

  async create(
    actor: AuthenticatedUser,
    labId: string,
    input: CreateLabWorkTypeInput,
  ): Promise<LabWorkType> {
    await this.labsService.requireRow(actor.clinicId, labId);

    const [row] = await this.db
      .insert(labWorkTypes)
      .values({
        labId,
        nameAr: input.nameAr,
        defaultPrice: input.defaultPrice,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the work type');
    }

    return toWorkType(row);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateLabWorkTypeInput,
  ): Promise<LabWorkType> {
    await this.requireRow(actor.clinicId, id);

    const [row] = await this.db
      .update(labWorkTypes)
      .set({
        ...(input.nameAr !== undefined && { nameAr: input.nameAr }),
        ...(input.defaultPrice !== undefined && { defaultPrice: input.defaultPrice }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(labWorkTypes.id, id))
      .returning();

    /* istanbul ignore next -- the row was just read under the same scope. */
    if (!row) {
      throw new Error('Failed to update the work type');
    }

    return toWorkType(row);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(labWorkTypes)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(eq(labWorkTypes.id, id));
  }

  async requireRow(clinicId: string, id: string): Promise<WorkTypeRow> {
    const [row] = await this.db
      .select({ workType: labWorkTypes })
      .from(labWorkTypes)
      .innerJoin(labs, eq(labs.id, labWorkTypes.labId))
      .where(
        and(
          eq(labWorkTypes.id, id),
          eq(labs.clinicId, clinicId),
          isNull(labWorkTypes.deletedAt),
          isNull(labs.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      // 404 rather than 403 for another clinic's id, like everything else here:
      // "not found" tells a caller nothing about what exists elsewhere.
      throw new NotFoundException('Resource not found');
    }

    return row.workType;
  }
}

export function toWorkType(row: WorkTypeRow): LabWorkType {
  return {
    id: row.id,
    labId: row.labId,
    nameAr: row.nameAr,
    defaultPrice: row.defaultPrice,
    isActive: row.isActive,
  };
}
