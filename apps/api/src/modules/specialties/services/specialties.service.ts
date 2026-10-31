import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { count, desc, eq, type SQL } from "drizzle-orm";
import {
  type ListSpecialtiesQuery,
  type Paginated,
  type Specialty,
  type UpdateSpecialtyInput,
} from "@clinic/shared";
import { SPECIALTIES_ENTITY } from "@api/common/constants/audit-entities";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { specialties } from "@api/database/schema";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { toSpecialty } from "@api/modules/specialties/lib/specialties";

type SpecialtyRow = typeof specialties.$inferSelect;

@Injectable()
export class SpecialtiesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(SPECIALTIES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(specialties)
        .where(this.scope.where(specialties, clinicId, eq(specialties.id, id)))
        .limit(1);

      return row ? { ...toSpecialty(row) } : null;
    });
  }

  async list(actor: AuthenticatedUser, query: ListSpecialtiesQuery): Promise<Paginated<Specialty>> {
    const filters: (SQL | undefined)[] = [];

    if (query.isActive !== undefined) {
      filters.push(eq(specialties.isActive, query.isActive));
    }

    const where = this.scope.where(specialties, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(specialties)
        .where(where)
        .orderBy(desc(specialties.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(specialties).where(where),
    ]);

    return toPaginated(rows.map(toSpecialty), totals?.value ?? 0, query);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateSpecialtyInput,
  ): Promise<Specialty> {
    await this.scope.findOneOrFail<SpecialtyRow>(specialties, actor.clinicId, id);

    const [row] = await this.db
      .update(specialties)
      .set({
        name: input.name,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(specialties, actor.clinicId, eq(specialties.id, id)))
      .returning();

    if (!row) {
      throw new Error("Failed to update specialty");
    }

    return toSpecialty(row);
  }
}
