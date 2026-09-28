import { procedureCatalog } from "@api/database/schema";
import {
  type ProcedureCatalogItem,
  type ProcedureCatalogPriceView,
  type UserRole,
  USER_ROLE,
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

export function toRoleView(row: CatalogRow, role: UserRole): CatalogView {
  if (role === USER_ROLE.RECEPTIONIST) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      defaultPrice: row.defaultPrice,
    };
  }

  return toCatalogItem(row);
}
