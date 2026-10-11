import { procedureCatalog } from "@api/database/schema";
import { type ProcedureCatalogItem, type ProcedureCatalogPriceView } from "@clinic/shared";

export type CatalogRow = typeof procedureCatalog.$inferSelect;

export type CatalogView = ProcedureCatalogItem | ProcedureCatalogPriceView;

export function toCatalogItem(row: CatalogRow): ProcedureCatalogItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    specialtyId: row.specialtyId,
    code: row.code,
    name: row.name,
    defaultPrice: row.defaultPrice,
    chartOutcome: row.chartOutcome,
    taxExempt: row.taxExempt,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CatalogAccess {
  readonly details: boolean;
  readonly chart: boolean;
}

export function toRoleView(row: CatalogRow, access: CatalogAccess): CatalogView {
  if (!access.details) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      defaultPrice: row.defaultPrice,
      ...(access.chart && { chartOutcome: row.chartOutcome }),
    };
  }

  return toCatalogItem(row);
}
