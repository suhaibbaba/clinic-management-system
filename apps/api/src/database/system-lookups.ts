import { LOOKUP_LIST_KEYS, SYSTEM_LOOKUPS, lookupChart } from "@clinic/shared";
import { sql, type SQL } from "drizzle-orm";

interface Executor {
  execute(query: SQL): Promise<{ readonly length: number }>;
}

export async function ensureSystemLookups(db: Executor, clinicId?: string): Promise<number> {
  const rows = LOOKUP_LIST_KEYS.flatMap((listKey) =>
    SYSTEM_LOOKUPS[listKey].map((row, index) => ({
      listKey,
      code: row.code,
      name: JSON.stringify(row.name),
      color: row.color ?? null,
      sortOrder: index,
      meta: JSON.stringify(row.meta ?? {}),
      chart: lookupChart(listKey, row.code, true) ?? null,
    })),
  );

  const values = sql.join(
    rows.map(
      (row) => sql`(
        ${row.listKey}::text, ${row.code}::text, ${row.name}::jsonb,
        ${row.color}::text, ${row.sortOrder}::integer, ${row.meta}::jsonb, ${row.chart}::text
      )`,
    ),
    sql`, `,
  );

  const scope = clinicId ? sql`and c.id = ${clinicId}` : sql``;

  const result = await db.execute(sql`
    insert into lookup_options
      (clinic_id, list_key, code, name, color, sort_order, is_system, meta)
    select c.id, v.list_key, v.code, v.name, v.color, v.sort_order, true, v.meta
    from clinics c
    cross join (
      values ${values}
    ) as v(list_key, code, name, color, sort_order, meta, chart)
    where (
      v.chart is null
      or exists (
        select 1 from specialties s
        where s.clinic_id = c.id
          and s.chart_type::text = v.chart
          and s.is_active
          and s.deleted_at is null
      )
    )
    ${scope}
    on conflict (clinic_id, list_key, code) do update set is_system = true
    returning id
  `);

  return result.length;
}
