import { Inject, Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import {
  type CreateLabWorkTypeInput,
  type LabWorkType,
  type UpdateLabWorkTypeInput,
} from "@clinic/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { LabsService } from "@api/modules/labs/services/labs.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { labWorkTypes, labs } from "@api/database/schema";
import { LAB_WORK_TYPES_ENTITY } from "@api/common/constants/audit-entities";
import { toWorkType, WorkTypeRow } from "@api/modules/labs/lib/lab-work-types";

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
      .orderBy(asc(labWorkTypes.name));

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
        name: input.name,
        defaultPrice: input.defaultPrice,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create the work type");
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
        ...(input.name !== undefined && { name: input.name }),
        ...(input.defaultPrice !== undefined && { defaultPrice: input.defaultPrice }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(labWorkTypes.id, id))
      .returning();

    if (!row) {
      throw new Error("Failed to update the work type");
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
      throw new NotFoundException("Resource not found");
    }

    return row.workType;
  }
}
