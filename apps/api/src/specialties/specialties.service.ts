import { Inject, Injectable } from '@nestjs/common';
import { asc, count, eq, type SQL } from 'drizzle-orm';
import type { ListSpecialtiesQuery, Paginated, Specialty } from '@clinic/shared';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { specialties } from '@api/database/schema';

/**
 * Specialties, read-only for now. Every role may read them (ROLES.md core
 * matrix); admin write endpoints land with the procedure catalog, which is the
 * feature that needs them.
 */
@Injectable()
export class SpecialtiesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

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
        .orderBy(asc(specialties.name))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(specialties).where(where),
    ]);

    return toPaginated(rows.map(toSpecialty), totals?.value ?? 0, query);
  }
}

function toSpecialty(row: typeof specialties.$inferSelect): Specialty {
  return {
    id: row.id,
    clinicId: row.clinicId,
    code: row.code,
    name: row.name,
    chartType: row.chartType,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
