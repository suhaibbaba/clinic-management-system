import { suppliers } from "@api/database/schema";
import { type Supplier } from "@clinic/shared";

export type SupplierRow = typeof suppliers.$inferSelect;

export function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    phone: row.phone,
    contactPerson: row.contactPerson,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMoneyString(value: string): string {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const thousandths = Math.round(Number(`0.${fraction || "0"}`) * 100);
  const carried = Number(whole) + Math.floor(thousandths / 100);

  return `${negative ? "-" : ""}${carried}.${String(thousandths % 100).padStart(2, "0")}`;
}
