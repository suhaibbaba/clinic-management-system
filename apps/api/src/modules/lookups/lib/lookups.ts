import { lookupOptions } from "@api/database/schema";
import { type LookupOption, type ToothChartBehaviour } from "@clinic/shared";

export type LookupRow = typeof lookupOptions.$inferSelect;

export function toLookupOption(row: LookupRow): LookupOption {
  return {
    id: row.id,
    clinicId: row.clinicId,
    listKey: row.listKey as LookupOption["listKey"],
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

export function deriveCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return slug === "" ? `opt_${Date.now().toString(36)}` : slug;
}

export function chartBehaviour(meta: unknown): ToothChartBehaviour | undefined {
  const behaviour = (meta as { chartBehavior?: unknown } | null)?.chartBehavior;

  return typeof behaviour === "object" && behaviour !== null
    ? (behaviour as ToothChartBehaviour)
    : undefined;
}
