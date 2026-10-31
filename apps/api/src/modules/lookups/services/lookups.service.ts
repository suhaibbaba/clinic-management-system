import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  BODY_SIDE,
  LOOKUP_LIST,
  LOOKUP_LIST_KEYS,
  PAIRED_SIDES,
  isPairedRegion,
  lookupLabel,
  offersLookup,
  type BodyRegionLocation,
  type CreateLookupOptionInput,
  type ListLookupOptionsQuery,
  type LookupBundle,
  type LookupListKey,
  type LookupOption,
  type ReorderLookupOptionsInput,
  type UpdateLookupOptionInput,
} from "@clinic/shared";
import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { clinicChartTypes } from "@api/common/lib/clinic-charts";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { lookupOptions } from "@api/database/schema";
import { LOOKUP_OPTIONS_ENTITY } from "@api/common/constants/audit-entities";
import {
  toLookupOption,
  deriveCode,
  chartBehaviour,
  LookupRow,
} from "@api/modules/lookups/lib/lookups";

@Injectable()
export class LookupsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(LOOKUP_OPTIONS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(lookupOptions)
        .where(this.scope.where(lookupOptions, clinicId, eq(lookupOptions.id, id)))
        .limit(1);

      return row ? { ...toLookupOption(row) } : null;
    });
  }

  async bundle(actor: AuthenticatedUser, query: ListLookupOptionsQuery): Promise<LookupBundle> {
    const filters: (SQL | undefined)[] = [];

    if (query.listKey) {
      filters.push(eq(lookupOptions.listKey, query.listKey));
    }
    if (!query.includeInactive) {
      filters.push(eq(lookupOptions.isActive, true));
    }

    const [rows, charts] = await Promise.all([
      this.db
        .select()
        .from(lookupOptions)
        .where(this.scope.where(lookupOptions, actor.clinicId, ...filters))
        .orderBy(asc(lookupOptions.listKey), asc(lookupOptions.sortOrder), asc(lookupOptions.code)),
      clinicChartTypes(this.db, actor.clinicId),
    ]);

    const bundle: Record<string, LookupOption[]> = {};

    for (const key of query.listKey ? [query.listKey] : LOOKUP_LIST_KEYS) {
      bundle[key] = [];
    }

    for (const row of rows) {
      const option = toLookupOption(row);

      if (offersLookup(charts, option)) {
        (bundle[row.listKey] ??= []).push(option);
      }
    }

    return bundle;
  }

  async create(actor: AuthenticatedUser, input: CreateLookupOptionInput): Promise<LookupOption> {
    const code = input.code ?? deriveCode(input.nameEn || input.nameAr);
    const charts = await clinicChartTypes(this.db, actor.clinicId);

    if (!offersLookup(charts, { listKey: input.listKey, code, isSystem: false })) {
      throw new NotFoundException("Resource not found");
    }

    await this.assertCodeIsFree(actor.clinicId, input.listKey, code);

    const [{ next } = { next: 0 }] = await this.db
      .select({ next: sql<number>`coalesce(max(${lookupOptions.sortOrder}), -1) + 1` })
      .from(lookupOptions)
      .where(
        and(
          eq(lookupOptions.clinicId, actor.clinicId),
          eq(lookupOptions.listKey, input.listKey),
          isNull(lookupOptions.deletedAt),
        ),
      );

    const [row] = await this.db
      .insert(lookupOptions)
      .values({
        clinicId: actor.clinicId,
        listKey: input.listKey,
        code,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        color: input.color ?? null,
        sortOrder: Number(next),
        isSystem: false,
        meta: input.meta ?? {},
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create the list option");
    }

    return toLookupOption(row);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateLookupOptionInput,
  ): Promise<LookupOption> {
    await this.requireRow(actor.clinicId, id);

    const [row] = await this.db
      .update(lookupOptions)
      .set({
        ...(input.nameAr !== undefined && { nameAr: input.nameAr }),
        ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
        ...(input.color !== undefined && { color: input.color ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.meta !== undefined && { meta: input.meta }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(lookupOptions, actor.clinicId, eq(lookupOptions.id, id)))
      .returning();

    if (!row) {
      throw new Error("Failed to update the list option");
    }

    return toLookupOption(row);
  }

  async reorder(
    actor: AuthenticatedUser,
    input: ReorderLookupOptionsInput,
  ): Promise<LookupOption[]> {
    const rows = await this.db
      .select()
      .from(lookupOptions)
      .where(
        this.scope.where(
          lookupOptions,
          actor.clinicId,
          eq(lookupOptions.listKey, input.listKey),
          inArray(lookupOptions.id, input.ids),
        ),
      );

    if (rows.length !== input.ids.length) {
      throw new NotFoundException("Resource not found");
    }

    await this.db.transaction(async (tx) => {
      for (const [index, id] of input.ids.entries()) {
        await tx
          .update(lookupOptions)
          .set({ sortOrder: index, updatedAt: new Date(), updatedBy: actor.id })
          .where(eq(lookupOptions.id, id));
      }
    });

    return (await this.bundle(actor, { listKey: input.listKey, includeInactive: true }))[
      input.listKey
    ] as LookupOption[];
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(lookupOptions)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(lookupOptions, actor.clinicId, eq(lookupOptions.id, id)));
  }

  async assertCode(clinicId: string, listKey: LookupListKey, code: string): Promise<void> {
    const [row] = await this.db
      .select({ isSystem: lookupOptions.isSystem })
      .from(lookupOptions)
      .where(
        this.scope.where(
          lookupOptions,
          clinicId,
          eq(lookupOptions.listKey, listKey),
          eq(lookupOptions.code, code),
          eq(lookupOptions.isActive, true),
        ),
      )
      .limit(1);

    if (
      !row ||
      !offersLookup(await clinicChartTypes(this.db, clinicId), {
        listKey,
        code,
        isSystem: row.isSystem,
      })
    ) {
      throw new BadRequestException(`Unknown ${listKey}: ${code}`);
    }
  }

  async assertChartOutcome(clinicId: string, code: string | null | undefined): Promise<void> {
    if (code === null || code === undefined || code === "") {
      return;
    }

    await this.assertCode(clinicId, LOOKUP_LIST.TOOTH_STATE, code);

    const [row] = await this.db
      .select({ meta: lookupOptions.meta })
      .from(lookupOptions)
      .where(
        this.scope.where(
          lookupOptions,
          clinicId,
          eq(lookupOptions.listKey, LOOKUP_LIST.TOOTH_STATE),
          eq(lookupOptions.code, code),
        ),
      )
      .limit(1);

    if (chartBehaviour(row?.meta)?.stateOnly === true) {
      throw new BadRequestException(`${code} is a tooth state, not a procedure outcome`);
    }
  }

  async assertBodyRegions(
    clinicId: string,
    locations: readonly BodyRegionLocation[],
  ): Promise<void> {
    if (locations.length === 0) {
      return;
    }

    const codes = [...new Set(locations.map((location) => location.region))];
    const rows = await this.db
      .select({ code: lookupOptions.code, meta: lookupOptions.meta })
      .from(lookupOptions)
      .where(
        this.scope.where(
          lookupOptions,
          clinicId,
          eq(lookupOptions.listKey, LOOKUP_LIST.BODY_REGION),
          eq(lookupOptions.isActive, true),
          inArray(lookupOptions.code, codes),
        ),
      );
    const paired = new Map(rows.map((row) => [row.code, isPairedRegion(row.meta)]));

    for (const location of locations) {
      const isPaired = paired.get(location.region);

      if (isPaired === undefined) {
        throw new BadRequestException(`Unknown ${LOOKUP_LIST.BODY_REGION}: ${location.region}`);
      }

      const side = location.side ?? BODY_SIDE.MIDLINE;
      if (isPaired !== PAIRED_SIDES.includes(side)) {
        throw new BadRequestException(`${location.region} cannot be marked on side ${side}`);
      }
    }
  }

  async assertOptionalCode(
    clinicId: string,
    listKey: LookupListKey,
    code: string | null | undefined,
  ): Promise<void> {
    if (code !== null && code !== undefined && code !== "") {
      await this.assertCode(clinicId, listKey, code);
    }
  }

  async labels(
    clinicId: string,
    listKey: LookupListKey,
    language: string,
  ): Promise<Map<string, string>> {
    const rows = await this.db
      .select({
        code: lookupOptions.code,
        nameAr: lookupOptions.nameAr,
        nameEn: lookupOptions.nameEn,
      })
      .from(lookupOptions)
      .where(this.scope.where(lookupOptions, clinicId, eq(lookupOptions.listKey, listKey)))
      .orderBy(asc(lookupOptions.sortOrder));

    return new Map(rows.map((row) => [row.code, lookupLabel(row, language)]));
  }

  private async requireRow(clinicId: string, id: string): Promise<LookupRow> {
    return this.scope.findOneOrFail<LookupRow>(lookupOptions, clinicId, id);
  }

  private async assertCodeIsFree(
    clinicId: string,
    listKey: LookupListKey,
    code: string,
  ): Promise<void> {
    const [clash] = await this.db
      .select({ id: lookupOptions.id })
      .from(lookupOptions)
      .where(
        and(
          eq(lookupOptions.clinicId, clinicId),
          eq(lookupOptions.listKey, listKey),
          eq(lookupOptions.code, code),
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException("An option with this code already exists in this list");
    }
  }
}
