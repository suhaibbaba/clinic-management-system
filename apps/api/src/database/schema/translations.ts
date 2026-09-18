import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { clinics } from "@api/database/schema/core";

// Only the strings a clinic changed. The locale files remain the default for everything else, so
// wording improved in a deploy still reaches a clinic that never touched that key.
export const translationOverrides = pgTable(
  "translation_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    language: text("language").notNull(),
    /** The dotted path into the locale files, e.g. `labs.orders.title`. */
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Partial, unlike `lookup_options`: a deleted override means "back to the shipped default", so
    // the key is free to be overridden again rather than staying spoken for.
    uniqueIndex("translation_overrides_key_uniq")
      .on(table.clinicId, table.language, table.key)
      .where(sql`deleted_at is null`),
    index("translation_overrides_clinic_idx").on(table.clinicId, table.language),
  ],
);
