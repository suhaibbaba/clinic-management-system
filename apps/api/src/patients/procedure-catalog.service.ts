import { ConflictException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  USER_ROLE,
  type CreateProcedureCatalogItemInput,
  type ListProcedureCatalogQuery,
  type Paginated,
  type ProcedureCatalogItem,
  type ProcedureCatalogPriceView,
  type UpdateProcedureCatalogItemInput,
  type UserRole,
} from '@clinic/shared';
import { and, asc, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { procedureCatalog, specialties } from '@api/database/schema';

type CatalogRow = typeof procedureCatalog.$inferSelect;

export const PROCEDURE_CATALOG_ENTITY = 'procedure_catalog';

export type CatalogView = ProcedureCatalogItem | ProcedureCatalogPriceView;

/**
 * Priced procedures per specialty. Admin writes; every role reads, and a
 * receptionist receives names and prices only (ROLES.md core matrix).
 */
@Injectable()
export class ProcedureCatalogService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(PROCEDURE_CATALOG_ENTITY, async (id, clinicId) => {
      const row = await this.findRow(clinicId, id);
      return row ? { ...toCatalogItem(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListProcedureCatalogQuery,
  ): Promise<Paginated<CatalogView>> {
    const filters: (SQL | undefined)[] = [];

    if (query.specialtyId) {
      filters.push(eq(procedureCatalog.specialtyId, query.specialtyId));
    }
    if (query.isActive !== undefined) {
      filters.push(eq(procedureCatalog.isActive, query.isActive));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(
        or(
          sql`${procedureCatalog.nameAr} ilike ${pattern}`,
          sql`${procedureCatalog.nameEn} ilike ${pattern}`,
          sql`${procedureCatalog.code} ilike ${pattern}`,
        ),
      );
    }

    const where = this.scope.where(procedureCatalog, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(procedureCatalog)
        .where(where)
        .orderBy(asc(procedureCatalog.nameAr))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(procedureCatalog)
        .where(where),
    ]);

    return toPaginated(
      rows.map((row) => toRoleView(row, actor.role)),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<CatalogView> {
    return toRoleView(await this.requireRow(actor.clinicId, id), actor.role);
  }

  /** Snapshot source for plan items and performed procedures. */
  async requirePriced(clinicId: string, id: string): Promise<CatalogRow> {
    return this.requireRow(clinicId, id);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateProcedureCatalogItemInput,
  ): Promise<CatalogView> {
    await this.requireSpecialty(actor, input.specialtyId);
    await this.assertCodeIsFree(actor.clinicId, input.code);

    const [row] = await this.db
      .insert(procedureCatalog)
      .values({
        clinicId: actor.clinicId,
        specialtyId: input.specialtyId,
        code: input.code,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        defaultPrice: input.defaultPrice,
        chartOutcome: input.chartOutcome ?? null,
        isActive: input.isActive,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create catalog item');
    }

    return toRoleView(row, actor.role);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateProcedureCatalogItemInput,
  ): Promise<CatalogView> {
    await this.requireRow(actor.clinicId, id);

    if (input.specialtyId) {
      await this.requireSpecialty(actor, input.specialtyId);
    }
    if (input.code) {
      await this.assertCodeIsFree(actor.clinicId, input.code, id);
    }

    const [row] = await this.db
      .update(procedureCatalog)
      .set({
        ...(input.specialtyId !== undefined && { specialtyId: input.specialtyId }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.nameAr !== undefined && { nameAr: input.nameAr }),
        ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
        ...(input.defaultPrice !== undefined && { defaultPrice: input.defaultPrice }),
        ...(input.chartOutcome !== undefined && { chartOutcome: input.chartOutcome ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(procedureCatalog, actor.clinicId, eq(procedureCatalog.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new Error('Failed to update catalog item');
    }

    return toRoleView(row, actor.role);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(procedureCatalog)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(procedureCatalog, actor.clinicId, eq(procedureCatalog.id, id)));
  }

  private async findRow(clinicId: string, id: string): Promise<CatalogRow | undefined> {
    const [row] = await this.db
      .select()
      .from(procedureCatalog)
      .where(this.scope.where(procedureCatalog, clinicId, eq(procedureCatalog.id, id)))
      .limit(1);

    return row;
  }

  private async requireRow(clinicId: string, id: string): Promise<CatalogRow> {
    return this.scope.findOneOrFail<CatalogRow>(procedureCatalog, clinicId, id);
  }

  private async requireSpecialty(actor: AuthenticatedUser, specialtyId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(this.scope.where(specialties, actor.clinicId, eq(specialties.id, specialtyId)))
      .limit(1);

    if (!row) {
      throw new ConflictException('Specialty not found in this clinic');
    }
  }

  private async assertCodeIsFree(
    clinicId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const [clash] = await this.db
      .select({ id: procedureCatalog.id })
      .from(procedureCatalog)
      .where(
        and(
          eq(procedureCatalog.clinicId, clinicId),
          eq(procedureCatalog.code, code),
          isNull(procedureCatalog.deletedAt),
          excludeId ? ne(procedureCatalog.id, excludeId) : undefined,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException('Procedure code is already in use');
    }
  }
}

function toCatalogItem(row: CatalogRow): ProcedureCatalogItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    specialtyId: row.specialtyId,
    code: row.code,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    defaultPrice: row.defaultPrice,
    chartOutcome: row.chartOutcome,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Receptionists get names and prices only (ROLES.md core matrix). */
function toRoleView(row: CatalogRow, role: UserRole): CatalogView {
  if (role === USER_ROLE.RECEPTIONIST) {
    return {
      id: row.id,
      code: row.code,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      defaultPrice: row.defaultPrice,
    };
  }

  return toCatalogItem(row);
}
