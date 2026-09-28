import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clinics } from "@api/database/schema/core";

export const lookupOptions = pgTable(
  "lookup_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    listKey: text("list_key").notNull(),
    code: text("code").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("lookup_options_list_idx").on(table.clinicId, table.listKey, table.sortOrder),
    uniqueIndex("lookup_options_code_idx").on(table.clinicId, table.listKey, table.code),
  ],
);
