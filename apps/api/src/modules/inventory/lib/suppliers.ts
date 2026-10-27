import { suppliers } from "@api/database/schema";
import { addMoney, subtractMoney, type Supplier, type SupplierSummary } from "@clinic/shared";

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

export type SupplierAccount = Pick<
  SupplierSummary,
  "openingBalance" | "purchased" | "paid" | "balance" | "lastPurchaseAt"
>;

export const EMPTY_ACCOUNT: SupplierAccount = {
  openingBalance: "0.00",
  purchased: "0.00",
  paid: "0.00",
  balance: "0.00",
  lastPurchaseAt: null,
};

export function toAccount(
  opening: string,
  purchased: string,
  paid: string,
  lastPurchaseAt: Date | string | null,
): SupplierAccount {
  const openingBalance = toMoneyString(opening);
  const bought = toMoneyString(purchased);
  const settled = toMoneyString(paid);

  return {
    openingBalance,
    purchased: bought,
    paid: settled,
    balance: subtractMoney(addMoney(openingBalance, bought), settled),
    lastPurchaseAt: lastPurchaseAt ? new Date(lastPurchaseAt).toISOString() : null,
  };
}
