import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import { DATABASE, type Database } from '@api/database/database.module';

export type ClinicScopedTable = PgTable & {
  id: PgColumn;
  clinicId: PgColumn;
  deletedAt: PgColumn;
};

// The one place a `clinic_id` predicate is added, always from the verified token. Another clinic's
// row is 404, not 403 — a 403 confirms the id exists somewhere.
@Injectable()
export class ClinicScopeService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Every query against a scoped table must go through this. */
  where(table: ClinicScopedTable, clinicId: string, ...conditions: (SQL | undefined)[]): SQL {
    const scoped = and(eq(table.clinicId, clinicId), isNull(table.deletedAt), ...conditions);

    /* istanbul ignore next -- `and` only returns undefined with no arguments. */
    if (!scoped) {
      throw new Error('Failed to build a clinic-scoped predicate');
    }

    return scoped;
  }

  /** Same predicate, but including soft-deleted rows (admin restore flows). */
  whereIncludingDeleted(
    table: ClinicScopedTable,
    clinicId: string,
    ...conditions: (SQL | undefined)[]
  ): SQL {
    const scoped = and(eq(table.clinicId, clinicId), ...conditions);

    /* istanbul ignore next */
    if (!scoped) {
      throw new Error('Failed to build a clinic-scoped predicate');
    }

    return scoped;
  }

  async findOneOrFail<TRow extends Record<string, unknown>>(
    table: ClinicScopedTable,
    clinicId: string,
    id: string,
  ): Promise<TRow> {
    const rows = (await this.db
      .select()
      .from(table)
      .where(this.where(table, clinicId, eq(table.id, id)))
      .limit(1)) as TRow[];

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return row;
  }
}
