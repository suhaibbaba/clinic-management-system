import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import { DATABASE, type Database } from '@api/database/database.module';

/** A domain table: carries `clinic_id` and is only ever soft-deleted. */
export type ClinicScopedTable = PgTable & {
  id: PgColumn;
  clinicId: PgColumn;
  deletedAt: PgColumn;
};

/**
 * The single place a `clinic_id` predicate is added to a query
 * (ROLES.md global rule 1, enforcement step 3).
 *
 * The clinic id always comes from the caller's verified access token. No
 * controller, service or repository accepts one from the client, so
 * cross-clinic access is impossible regardless of role.
 *
 * A row belonging to another clinic is reported as **404, not 403** — a 403
 * would confirm that the id exists somewhere, which leaks across tenants.
 */
@Injectable()
export class ClinicScopeService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Predicate restricting a table to one clinic's live rows, plus any extra
   * conditions. Every query against a scoped table must go through this.
   */
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

  /**
   * Loads one row by id within the caller's clinic, or throws 404 — used by
   * every "get / update / delete by id" path so an id from another clinic is
   * indistinguishable from one that does not exist.
   */
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
