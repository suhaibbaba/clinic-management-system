import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { clinics, users } from '@api/database/schema/core';

// The clinic's noticeboard. `author_id` is nullable and not cascaded: a note outlives the account
// that wrote it, and losing the line because somebody left is worse than losing the attribution.
export const clinicNotes = pgTable(
  'clinic_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    body: text('body').notNull(),
    authorId: uuid('author_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('clinic_notes_recent_idx').on(table.clinicId, table.createdAt)],
);
