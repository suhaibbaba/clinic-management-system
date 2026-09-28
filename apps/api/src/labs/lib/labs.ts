import { labs } from "@api/database/schema";
import { type Lab } from "@clinic/shared";

export type LabRow = typeof labs.$inferSelect;

export function toLab(row: LabRow): Lab {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    phone: row.phone,
    address: row.address,
    contactPerson: row.contactPerson,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalise(value: string): string {
  const [whole = "0", fraction = ""] = value.split(".");

  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
