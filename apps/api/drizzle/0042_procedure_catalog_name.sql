-- A treatment has one name, in English. The ai_read views read the old columns, so they go first
-- and 0043 recreates them from the catalogue.
DROP SCHEMA IF EXISTS ai_read CASCADE;--> statement-breakpoint
ALTER TABLE "procedure_catalog" DROP COLUMN "name_ar";--> statement-breakpoint
ALTER TABLE "procedure_catalog" RENAME COLUMN "name_en" TO "name";
