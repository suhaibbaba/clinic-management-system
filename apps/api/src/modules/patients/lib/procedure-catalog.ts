import { procedureCatalog } from "@api/database/schema";
import {
  type ProcedureCatalogItem,
  type ProcedureCatalogPriceView,
} from "@clinic/shared";

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
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRoleView(row: CatalogRow, details: boolean): CatalogView {
  if (!details) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      defaultPrice: row.defaultPrice,
    };
  }

  return toCatalogItem(row);
}
