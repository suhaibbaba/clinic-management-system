import { LOOKUP_LIST_KEYS, SYSTEM_LOOKUPS } from '@clinic/shared';
import { sql, type SQL } from 'drizzle-orm';

/**
 * Just enough of a drizzle handle to run one statement — so the migrator's
 * bare connection and the API's schema-typed database both satisfy it.
 */
interface Executor {
  execute(query: SQL): Promise<{ readonly length: number }>;
}

/**
 * Writes the built-in rows of every editable list, for one clinic or for all
 * of them.
 *
 * This is the other half of the migration that widened the choice columns from
 * enums to text. The SQL kept every value those columns held; this puts a row
 * behind each of those values, with the same `code`, so nothing that referred
 * to `cash` or `xray_panoramic` or `implant` stopped meaning anything. The
 * mapping is the code itself — which is why codes are never edited.
 *
 * It is idempotent by `(clinic_id, list_key, code)`: running it again updates
 * nothing a clinic has changed. Only `is_system` is forced true, because a row
 * the application draws special behaviour from must stay marked as one.
 *
 * Called from three places, all of which need exactly this: the migration
 * runner (existing clinics), the seed (a fresh database) and clinic creation
 * (a new tenant starts with working lists rather than empty dropdowns).
 */
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
      /*
       * Every column is cast: a `values` list is typed by its first row, and a
       * bare parameter arrives as text — which the integer `sort_order` and
       * the jsonb `meta` both reject, and a `null` colour has no type at all.
       */
      (row) => sql`(
        ${row.listKey}::text, ${row.code}::text, ${row.nameAr}::text, ${row.nameEn}::text,
        ${row.color}::text, ${row.sortOrder}::integer, ${row.meta}::jsonb
      )`,
    ),
    sql`, `,
  );

  const scope = clinicId ? sql`where c.id = ${clinicId}` : sql``;

  /*
   * One statement for every clinic and every row: the cross join is what makes
   * "each tenant starts with the same lists" a fact rather than a loop that
   * can half-fail. `do update` only touches the system flag, so a clinic that
   * renamed "نقداً" to "خالص" keeps its name through the next deploy.
   */
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
