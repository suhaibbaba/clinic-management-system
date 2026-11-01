CREATE OR REPLACE FUNCTION localized_text_values(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(string_agg(t.v, ' ' ORDER BY t.k), '')
  FROM jsonb_each_text(coalesce(value, '{}'::jsonb)) AS t(k, v)
  WHERE btrim(t.v) <> '';
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION normalize_arabic(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        translate(
          regexp_replace(
            translate(lower(normalize(value, NFC)), E'ışğçöü̇', 'isgcou'),
            E'[ً-ٰٕۖ-ۭـء]', '', 'g'
          ),
          'أإآٱةىئؤ',
          'ااااهييو'
        ),
        E'\\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;
--> statement-breakpoint
DROP VIEW IF EXISTS ai_read.doctors;
--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "name" jsonb;
--> statement-breakpoint
UPDATE "clinics" SET "name" = jsonb_strip_nulls(jsonb_build_object('ar', nullif(btrim(name_ar), ''), 'en', nullif(btrim(name_en), '')));
--> statement-breakpoint
ALTER TABLE "clinics" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinics" DROP COLUMN "name_ar";
--> statement-breakpoint
ALTER TABLE "clinics" DROP COLUMN "name_en";
--> statement-breakpoint
ALTER TABLE "lookup_options" ADD COLUMN "name" jsonb;
--> statement-breakpoint
UPDATE "lookup_options" SET "name" = jsonb_strip_nulls(jsonb_build_object('ar', nullif(btrim(name_ar), ''), 'en', nullif(btrim(name_en), '')));
--> statement-breakpoint
ALTER TABLE "lookup_options" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "lookup_options" DROP COLUMN "name_ar";
--> statement-breakpoint
ALTER TABLE "lookup_options" DROP COLUMN "name_en";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "normalized_name";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" jsonb;
--> statement-breakpoint
UPDATE "users" SET
  "first_name" = jsonb_strip_nulls(jsonb_build_object('ar', nullif(btrim(first_name_ar), ''), 'en', nullif(btrim(first_name_en), ''))),
  "last_name" = jsonb_strip_nulls(jsonb_build_object('ar', nullif(btrim(last_name_ar), ''), 'en', nullif(btrim(last_name_en), ''))),
  "name" = jsonb_strip_nulls(jsonb_build_object('ar', nullif(btrim(name_ar), ''), 'en', nullif(btrim(name_en), '')));
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "first_name_ar";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_name_ar";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "first_name_en";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_name_en";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "name_ar";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "name_en";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (normalize_arabic(localized_text_values(name))) STORED;
--> statement-breakpoint
CREATE INDEX "users_normalized_name_idx" ON "users" USING btree ("clinic_id", "normalized_name" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX "users_normalized_name_trgm_idx" ON "users" USING gin ("normalized_name" gin_trgm_ops);
--> statement-breakpoint
UPDATE "patients" SET "full_name" = "full_name" WHERE "full_name" ~ '[ışğçöüİŞĞÇÖÜ]';
--> statement-breakpoint
UPDATE "labs" SET "name" = "name" WHERE "name" ~ '[ışğçöüİŞĞÇÖÜ]';
--> statement-breakpoint
UPDATE "suppliers" SET "name" = "name" WHERE "name" ~ '[ışğçöüİŞĞÇÖÜ]';
