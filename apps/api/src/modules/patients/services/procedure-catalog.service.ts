import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  RULE,
  type CreateProcedureCatalogItemInput,
  type ListProcedureCatalogQuery,
  type Paginated,
  type RemoveProcedureCatalogItemsInput,
  type SetProcedureCatalogItemsActiveInput,
  type UpdateProcedureCatalogItemInput,
} from "@clinic/shared";
import { and, eq, inArray, isNull, ne, or, sql, type SQL, desc } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { procedureCatalog, specialties } from "@api/database/schema";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { PROCEDURE_CATALOG_ENTITY } from "@api/common/constants/audit-entities";
import {
  toCatalogItem,
  CatalogView,
  toRoleView,
  CatalogRow,
  type CatalogAccess,
} from "@api/modules/patients/lib/procedure-catalog";

@Injectable()
export class ProcedureCatalogService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
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
          sql`localized_text_values(${procedureCatalog.name}) ilike ${pattern}`,
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
        .orderBy(desc(procedureCatalog.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(procedureCatalog)
        .where(where),
    ]);
    const access = await this.catalogAccess(actor);

    return toPaginated(
      rows.map((row) => toRoleView(row, access)),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<CatalogView> {
    return toRoleView(await this.requireRow(actor.clinicId, id), await this.catalogAccess(actor));
  }

  async requirePriced(clinicId: string, id: string): Promise<CatalogRow> {
    return this.requireRow(clinicId, id);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateProcedureCatalogItemInput,
  ): Promise<CatalogView> {
    await this.lookups.assertChartOutcome(actor.clinicId, input.chartOutcome);

    await this.requireSpecialty(actor, input.specialtyId);
    await this.assertCodeIsFree(actor.clinicId, input.code);

    const [row] = await this.db
      .insert(procedureCatalog)
      .values({
        clinicId: actor.clinicId,
        specialtyId: input.specialtyId,
        code: input.code,
        name: input.name,
        defaultPrice: input.defaultPrice,
        chartOutcome: input.chartOutcome ?? null,
        taxExempt: input.taxExempt,
        isActive: input.isActive,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create catalog item");
    }

    return toRoleView(row, await this.catalogAccess(actor));
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateProcedureCatalogItemInput,
  ): Promise<CatalogView> {
    await this.lookups.assertChartOutcome(actor.clinicId, input.chartOutcome);

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
        ...(input.name !== undefined && { name: input.name }),
        ...(input.defaultPrice !== undefined && { defaultPrice: input.defaultPrice }),
        ...(input.chartOutcome !== undefined && { chartOutcome: input.chartOutcome ?? null }),
        ...(input.taxExempt !== undefined && { taxExempt: input.taxExempt }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(procedureCatalog, actor.clinicId, eq(procedureCatalog.id, id)))
      .returning();

    if (!row) {
      throw new Error("Failed to update catalog item");
    }

    return toRoleView(row, await this.catalogAccess(actor));
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(procedureCatalog)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(procedureCatalog, actor.clinicId, eq(procedureCatalog.id, id)));
  }

  async setActive(
    actor: AuthenticatedUser,
    input: SetProcedureCatalogItemsActiveInput,
  ): Promise<CatalogView[]> {
    const before = await this.requireRows(actor.clinicId, input.ids);
    const access = await this.catalogAccess(actor);

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(procedureCatalog)
        .set({ isActive: input.isActive, updatedAt: new Date(), updatedBy: actor.id })
        .where(
          this.scope.where(
            procedureCatalog,
            actor.clinicId,
            inArray(procedureCatalog.id, [...before.keys()]),
          ),
        )
        .returning();

      for (const row of rows) {
        const old = before.get(row.id);

        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.UPDATE,
            entity: PROCEDURE_CATALOG_ENTITY,
            entityId: row.id,
            oldValue: old ? { ...toCatalogItem(old) } : null,
            newValue: { ...toCatalogItem(row) },
          },
          tx,
        );
      }

      return rows.map((row) => toRoleView(row, access));
    });
  }

  async softDeleteMany(
    actor: AuthenticatedUser,
    input: RemoveProcedureCatalogItemsInput,
  ): Promise<void> {
    const before = await this.requireRows(actor.clinicId, input.ids);

    await this.db.transaction(async (tx) => {
      await tx
        .update(procedureCatalog)
        .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(
          this.scope.where(
            procedureCatalog,
            actor.clinicId,
            inArray(procedureCatalog.id, [...before.keys()]),
          ),
        );

      for (const row of before.values()) {
        await this.audit.record(
          {
            clinicId: actor.clinicId,
            userId: actor.id,
            action: AUDIT_ACTION.DELETE,
            entity: PROCEDURE_CATALOG_ENTITY,
            entityId: row.id,
            oldValue: { ...toCatalogItem(row) },
            newValue: null,
          },
          tx,
        );
      }
    });
  }

  private async requireRows(
    clinicId: string,
    ids: readonly string[],
  ): Promise<Map<string, CatalogRow>> {
    const unique = [...new Set(ids)];
    const rows = await this.db
      .select()
      .from(procedureCatalog)
      .where(this.scope.where(procedureCatalog, clinicId, inArray(procedureCatalog.id, unique)));

    if (rows.length !== unique.length) {
      throw new NotFoundException("Resource not found");
    }

    return new Map(rows.map((row) => [row.id, row]));
  }

  private async catalogAccess(actor: AuthenticatedUser): Promise<CatalogAccess> {
    const [details, chart] = await Promise.all([
      this.permissions.can(actor, RULE.CATALOG_DETAILS),
      this.permissions.can(actor, RULE.PATIENTS_CLINICAL),
    ]);

    return { details, chart };
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
      throw new ConflictException("Specialty not found in this clinic");
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
      throw new ConflictException("Procedure code is already in use");
    }
  }
}
