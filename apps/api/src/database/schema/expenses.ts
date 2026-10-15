import { date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinics, users } from "@api/database/schema/core";

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    spentOn: date("spent_on").notNull(),
    category: text("category").notNull(),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    paidBy: uuid("paid_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("expenses_month_idx").on(table.clinicId, table.spentOn),
    index("expenses_reverses_idx").on(table.reversesId),
  ],
);
