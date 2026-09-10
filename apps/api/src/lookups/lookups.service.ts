import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  LOOKUP_LIST,
  LOOKUP_LIST_KEYS,
  lookupLabel,
  type CreateLookupOptionInput,
  type ListLookupOptionsQuery,
  type LookupBundle,
  type LookupListKey,
  type LookupOption,
  type ReorderLookupOptionsInput,
  type ToothChartBehaviour,
  type UpdateLookupOptionInput,
} from '@clinic/shared';
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { lookupOptions } from '@api/database/schema';
import { ensureSystemLookups } from '@api/database/system-lookups';

type LookupRow = typeof lookupOptions.$inferSelect;

export const LOOKUP_OPTIONS_ENTITY = 'lookup_options';

// Every row is the clinic's to rename, switch off or delete, built-in ones included: `is_system` is
// a label the screen warns on, not a lock. A deleted code stops resolving; nothing is corrupted.
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

  // One cached bundle rather than a request per dropdown: a few kilobytes, and one response
  // invalidated as a unit cannot leave two dropdowns disagreeing.
  async bundle(actor: AuthenticatedUser, query: ListLookupOptionsQuery): Promise<LookupBundle> {
    const filters: (SQL | undefined)[] = [];

    if (query.listKey) {
      filters.push(eq(lookupOptions.listKey, query.listKey));
    }
    if (!query.includeInactive) {
      filters.push(eq(lookupOptions.isActive, true));
    }

    const rows = await this.db
      .select()
      .from(lookupOptions)
      .where(this.scope.where(lookupOptions, actor.clinicId, ...filters))
      .orderBy(asc(lookupOptions.listKey), asc(lookupOptions.sortOrder), asc(lookupOptions.code));

    const bundle: Record<string, LookupOption[]> = {};

    // Every known key is present even when empty, so a client can tell "this
    // clinic has no shades" from "the response did not include shades".
    for (const key of query.listKey ? [query.listKey] : LOOKUP_LIST_KEYS) {
      bundle[key] = [];
    }

    for (const row of rows) {
      (bundle[row.listKey] ??= []).push(toLookupOption(row));
    }

    return bundle;
  }

  async create(actor: AuthenticatedUser, input: CreateLookupOptionInput): Promise<LookupOption> {
    const code = input.code ?? deriveCode(input.nameEn || input.nameAr);

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
        // Only the seed writes system rows. Anything created through the API
        // is the clinic's own, and stays deletable.
        isSystem: false,
        meta: input.meta ?? {},
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the list option');
    }

    return toLookupOption(row);
  }

  // The code is the one thing the update schema does not accept, which is what makes the rest safe:
  // a switched-off option still resolves to a name.
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

    /* istanbul ignore next -- the row was just read under the same scope. */
    if (!row) {
      throw new Error('Failed to update the list option');
    }

    return toLookupOption(row);
  }

  // Sent back whole rather than "move this to 4": two people reordering at once would otherwise
  // interleave into an order neither chose.
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
      throw new NotFoundException('Resource not found');
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

  // Soft, because the code is still spoken for and the unique index keeps reserving it. Switching
  // off leaves the name resolving; deleting takes it, and records fall back to the code.
  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(lookupOptions)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(lookupOptions, actor.clinicId, eq(lookupOptions.id, id)));
  }

  // The Zod schemas accept any well-formed code — they cannot know what a clinic holds — so "is
  // that a real appointment type" is answered here.
  async assertCode(clinicId: string, listKey: LookupListKey, code: string): Promise<void> {
    const [row] = await this.db
      .select({ id: lookupOptions.id })
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

    if (!row) {
      throw new BadRequestException(`Unknown ${listKey}: ${code}`);
    }
  }

  // A procedure may not leave a tooth `healthy`: the state-only rows say so in their own
  // `chartBehavior`, read from the row rather than a second hardcoded list.
  async assertChartOutcome(clinicId: string, code: string | null | undefined): Promise<void> {
    if (code === null || code === undefined || code === '') {
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

  async assertOptionalCode(
    clinicId: string,
    listKey: LookupListKey,
    code: string | null | undefined,
  ): Promise<void> {
    if (code !== null && code !== undefined && code !== '') {
      await this.assertCode(clinicId, listKey, code);
    }
  }

  // What the printed documents use: a receipt says whatever this clinic calls `cash`, in the
  // document's language.
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

  /** Gives a brand-new clinic the built-in lists, so no dropdown starts empty. */
  async seedClinic(clinicId: string): Promise<void> {
    await ensureSystemLookups(this.db, clinicId);
  }

  private async requireRow(clinicId: string, id: string): Promise<LookupRow> {
    return this.scope.findOneOrFail<LookupRow>(lookupOptions, clinicId, id);
  }

  // Unique per list per clinic including against soft-deleted rows — a deleted row's code may still
  // be sitting in an appointment.
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
      throw new ConflictException('An option with this code already exists in this list');
    }
  }
}

export function toLookupOption(row: LookupRow): LookupOption {
  return {
    id: row.id,
    clinicId: row.clinicId,
    listKey: row.listKey as LookupOption['listKey'],
    code: row.code,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    color: row.color,
    sortOrder: row.sortOrder,
    isSystem: row.isSystem,
    isActive: row.isActive,
    meta: row.meta,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Derived rather than demanded — nobody adding a payment method should have to invent an
// identifier. A wholly non-Latin name falls back to a timestamped code.
function deriveCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return slug === '' ? `opt_${Date.now().toString(36)}` : slug;
}

function chartBehaviour(meta: unknown): ToothChartBehaviour | undefined {
  const behaviour = (meta as { chartBehavior?: unknown } | null)?.chartBehavior;

  return typeof behaviour === 'object' && behaviour !== null
    ? (behaviour as ToothChartBehaviour)
    : undefined;
}
