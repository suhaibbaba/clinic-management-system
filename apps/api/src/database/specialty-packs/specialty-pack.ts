import { and, eq, isNull, max } from "drizzle-orm";
import {
  SPECIALTY_CODE,
  type LocalizedText,
  type LookupListKey,
  type SpecialtyCode,
  type SystemLookupRow,
} from "@clinic/shared";
import type { DatabaseExecutor } from "@api/database/database.module";
import { lookupOptions, procedureCatalog, specialties } from "@api/database/schema";
import { ORTHOPEDIC_PACK } from "@api/database/specialty-packs/orthopedic";

export interface SpecialtyPack {
  readonly procedures: readonly { readonly code: string; readonly name: LocalizedText }[];
  readonly lookups: Partial<Record<LookupListKey, readonly SystemLookupRow[]>>;
}

export interface PackResult {
  readonly procedures: number;
  readonly lookups: number;
}

const PACKS: Partial<Record<SpecialtyCode, SpecialtyPack>> = {
  [SPECIALTY_CODE.ORTHOPEDIC]: ORTHOPEDIC_PACK,
};

export async function applySpecialtyPack(
  db: DatabaseExecutor,
  clinicId: string,
  code: SpecialtyCode,
): Promise<PackResult> {
  const pack = PACKS[code];

  if (!pack) {
    return { procedures: 0, lookups: 0 };
  }

  const [specialty] = await db
    .select({ id: specialties.id })
    .from(specialties)
    .where(
      and(
        eq(specialties.clinicId, clinicId),
        eq(specialties.code, code),
        isNull(specialties.deletedAt),
      ),
    )
    .limit(1);

  if (!specialty) {
    throw new Error(`The clinic has no "${code}" specialty to attach its procedures to`);
  }

  let lookups = 0;
  for (const [listKey, rows] of Object.entries(pack.lookups) as [
    LookupListKey,
    readonly SystemLookupRow[],
  ][]) {
    const [last] = await db
      .select({ value: max(lookupOptions.sortOrder) })
      .from(lookupOptions)
      .where(and(eq(lookupOptions.clinicId, clinicId), eq(lookupOptions.listKey, listKey)));
    const start = (last?.value ?? -1) + 1;

    const inserted = await db
      .insert(lookupOptions)
      .values(
        rows.map((row, index) => ({
          clinicId,
          listKey,
          code: row.code,
          name: row.name,
          color: row.color ?? null,
          sortOrder: start + index,
          meta: row.meta ?? {},
        })),
      )
      .onConflictDoNothing({
        target: [lookupOptions.clinicId, lookupOptions.listKey, lookupOptions.code],
      })
      .returning({ id: lookupOptions.id });
    lookups += inserted.length;
  }

  let procedures = 0;
  for (const procedure of pack.procedures) {
    const [taken] = await db
      .select({ id: procedureCatalog.id })
      .from(procedureCatalog)
      .where(
        and(
          eq(procedureCatalog.clinicId, clinicId),
          eq(procedureCatalog.code, procedure.code),
          isNull(procedureCatalog.deletedAt),
        ),
      )
      .limit(1);

    if (taken) {
      continue;
    }

    await db.insert(procedureCatalog).values({
      clinicId,
      specialtyId: specialty.id,
      code: procedure.code,
      name: procedure.name,
      defaultPrice: "0.00",
      isActive: false,
    });
    procedures += 1;
  }

  return { procedures, lookups };
}
