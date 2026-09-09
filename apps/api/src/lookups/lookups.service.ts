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

/**
 * The editable lists, and the one place that decides what may be done to them.
 *
 * Reading is open to every signed-in role: a dropdown is not a permission, and
 * every screen in the app needs these. Writing is admin-only (ROLES.md core
 * matrix, "Clinic settings, templates") — a list is settings.
 *
 * Every row of every list is the clinic's to rename, recolour, switch off or
 * remove — the built-in ones included. `is_system` survives as a *label*: it
 * says the application ships behaviour keyed to that code, so the screen can
 * warn before it goes, but it no longer refuses anything. A clinic that never
 * takes an X-ray should be able to empty that list, and the alternative was a
 * settings screen with rows nobody could explain away.
 *
 * What removing one costs is worth stating plainly, because it is the price of
 * the freedom: records already holding the code keep it and fall back to
 * showing the code where the name used to be, new records may no longer be
 * written with it (`assertCode` reads the live list), and the tooth chart's
 * special drawing for `missing`, `implant` and `bridge` has nothing left to
 * attach to. Nothing is corrupted; a name simply stops resolving.
 */
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

  /**
   * Every list at once, keyed by list.
   *
   * The client caches this whole bundle rather than asking per dropdown: it is
   * a few kilobytes, nearly every screen needs some of it, and one response
   * invalidated as a unit cannot leave two dropdowns disagreeing about the
   * same list.
   */
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

  /**
   * Name, colour and whether it is offered at all — on every row, built-in ones
   * included. "نقداً" may well be "خالص" in this clinic, and a clinic that
   * never fits a bridge should not have to keep it in the dropdown.
   *
   * The code is the one thing `updateLookupOptionSchema` does not accept, and
   * that is what makes the rest safe: an option switched off still resolves to
   * a name for every record that already refers to it.
   */
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

  /**
   * The order the list is drawn in, sent back whole after a drag.
   *
   * Whole rather than "move this one to position 4": two people reordering at
   * once would otherwise interleave into an order neither of them chose, and
   * the payload is a handful of ids.
   */
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

  /**
   * Soft delete, on any row.
   *
   * Soft because the code is still spoken for: rows elsewhere hold it and the
   * unique index keeps reserving it, so it can never be handed to a second
   * option and start meaning two things.
   *
   * It is the heavier of the two ways to retire an option, and the screen says
   * so. **Switching one off** takes it out of every dropdown but leaves it
   * resolving to its name, so last year's receipt still reads "نقداً".
   * **Deleting** it takes the name with it, and records that hold the code fall
   * back to printing the code. Both are the clinic's call to make.
   */
  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(lookupOptions)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(lookupOptions, actor.clinicId, eq(lookupOptions.id, id)));
  }

  /**
   * Refuses a code that is not on this clinic's list.
   *
   * The Zod schemas accept any well-formed code — they cannot know what a
   * given clinic holds — so this is where "is that a real appointment type"
   * is actually answered, next to the data that answers it.
   */
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

  /**
   * The same check for a procedure's chart outcome, plus the one thing that
   * distinguishes it: a procedure may not leave a tooth `healthy`.
   *
   * The chart's states and the outcomes a procedure produces are one list — a
   * clinic that adds "veneer" wants it painted *and* selectable — but three of
   * the built-in rows describe a tooth rather than something done to one, and
   * they say so in their own `chartBehavior.stateOnly`. Read from the row
   * rather than from a second hardcoded list, so a clinic that renames
   * "سليم" does not quietly re-open it as an outcome.
   */
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

  /** Same check, for an optional field. */
  async assertOptionalCode(
    clinicId: string,
    listKey: LookupListKey,
    code: string | null | undefined,
  ): Promise<void> {
    if (code !== null && code !== undefined && code !== '') {
      await this.assertCode(clinicId, listKey, code);
    }
  }

  /**
   * Code → label, in one language, for one list.
   *
   * What the printed documents use: a receipt says "نقداً" because that is
   * what this clinic calls `cash`, and an English receipt says whatever they
   * called it in English.
   */
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

  /**
   * A code is unique per list per clinic — including against soft-deleted rows,
   * because a deleted row's code may still be sitting in an appointment.
   */
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

/**
 * "Night guard" → `night_guard`.
 *
 * Derived rather than demanded: a person adding a payment method should not
 * have to invent an identifier, and the one they would invent is this. Falls
 * back to a timestamped code when the name is entirely non-Latin — an Arabic
 * name transliterates to nothing useful, and a code is not read by anybody.
 */
function deriveCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return slug === '' ? `opt_${Date.now().toString(36)}` : slug;
}

/** Reads the chart's half of a tooth-state row's `meta`, if it has one. */
function chartBehaviour(meta: unknown): ToothChartBehaviour | undefined {
  const behaviour = (meta as { chartBehavior?: unknown } | null)?.chartBehavior;

  return typeof behaviour === 'object' && behaviour !== null
    ? (behaviour as ToothChartBehaviour)
    : undefined;
}
