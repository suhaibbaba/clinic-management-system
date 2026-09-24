ALTER TABLE "users" ADD COLUMN "first_name_ar" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name_ar" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name_en" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name_en" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "last_name" text;--> statement-breakpoint
/* Existing names split on spaces: for a patient the first word, the last, and what lies between;
   for staff the first word and the rest, without a leading title. The full-name columns are left as they are. */
UPDATE "patients" SET
  "first_name" = split_part(btrim("full_name"), ' ', 1),
  "last_name" = CASE WHEN btrim("full_name") ~ '\s' THEN regexp_replace(btrim("full_name"), '^.*\s', '') ELSE '' END,
  "middle_name" = nullif(btrim(regexp_replace(regexp_replace(btrim("full_name"), '^\S+', ''), '\S+$', '')), '');--> statement-breakpoint
UPDATE "users" SET
  "first_name_ar" = split_part(btrim(regexp_replace("name_ar", '^\s*(د\.|Dr\.)\s*', '')), ' ', 1),
  "last_name_ar" = btrim(regexp_replace(btrim(regexp_replace("name_ar", '^\s*(د\.|Dr\.)\s*', '')), '^\S+', '')),
  "first_name_en" = split_part(btrim(regexp_replace("name_en", '^\s*(د\.|Dr\.)\s*', '')), ' ', 1),
  "last_name_en" = btrim(regexp_replace(btrim(regexp_replace("name_en", '^\s*(د\.|Dr\.)\s*', '')), '^\S+', ''));--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name_ar" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name_ar" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name_en" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name_en" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "last_name" SET NOT NULL;
