import { LOOKUP_LIST_KEYS, SYSTEM_LOOKUPS } from '@clinic/shared';
import { sql, type SQL } from 'drizzle-orm';

// Just enough of a drizzle handle to run one statement, so the migrator's bare connection and the
// API's typed database both satisfy it.
interface Executor {
  execute(query: SQL): Promise<{ readonly length: number }>;
}

// The row half of the enums-to-lookups migration, keyed by the same codes the columns already held.
// Idempotent on `(clinic_id, list_key, code)`; only `is_system` is forced.
export async function ensureSystemLookups(db: Executor, clinicId?: string): Promise<number> {
  const rows = LOOKUP_LIST_KEYS.flatMap((listKey) =>
    SYSTEM_LOOKUPS[listKey].map((row, index) => ({
      listKey,
      code: row.code,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      color: row.color ?? null,
      sortOrder: index,
      meta: JSON.stringify(row.meta ?? {}),
    })),
  );

  const values = sql.join(
    rows.map(
      // Every column is cast: a `values` list is typed by its first row, a bare parameter arrives
      // as text, and a `null` colour has no type at all.
      (row) => sql`(
        ${row.listKey}::text, ${row.code}::text, ${row.nameAr}::text, ${row.nameEn}::text,
        ${row.color}::text, ${row.sortOrder}::integer, ${row.meta}::jsonb
      )`,
    ),
    sql`, `,
  );

  const scope = clinicId ? sql`where c.id = ${clinicId}` : sql``;

  // One cross-join statement rather than a loop that can half-fail; `do update` touches only the
  // system flag, so a renamed option survives the next deploy.
  const result = await db.execute(sql`
    insert into lookup_options
      (clinic_id, list_key, code, name_ar, name_en, color, sort_order, is_system, meta)
    select c.id, v.list_key, v.code, v.name_ar, v.name_en, v.color, v.sort_order, true, v.meta
    from clinics c
    cross join (
      values ${values}
    ) as v(list_key, code, name_ar, name_en, color, sort_order, meta)
    ${scope}
    on conflict (clinic_id, list_key, code) do update set is_system = true
    returning id
  `);

  return result.length;
}
