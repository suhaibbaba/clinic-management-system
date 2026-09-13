/*
 * Names are written down the way they were heard. "محمود عودة" is filed under "محمود عوده", أحمد
 * loses its hamza at the desk, and a search that only matches the bytes finds neither.
 *
 * This function is the SQL half of `normalizeArabic()` in @clinic/shared: the column below is
 * generated with it and every query is folded with the TypeScript one, so the two have to agree —
 * `arabic-search.e2e-spec.ts` runs the same table of names through both.
 *
 * Changing the body does NOT recompute stored values; a change here needs a migration that rewrites
 * each table (ALTER TABLE ... ALTER COLUMN normalized_name DROP EXPRESSION, then re-add it).
 */
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
          -- Tashkeel, the superscript alef, Quranic marks, tatweel and the standalone hamza.
          regexp_replace(lower(normalize(value, NFC)), E'[ً-ٰٕۖ-ۭـء]', '', 'g'),
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
ALTER TABLE "users" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (normalize_arabic(name_ar || ' ' || name_en)) STORED;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (normalize_arabic(full_name)) STORED;--> statement-breakpoint
ALTER TABLE "labs" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (normalize_arabic(name)) STORED;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "normalized_name" text GENERATED ALWAYS AS (normalize_arabic(name)) STORED;--> statement-breakpoint
/*
 * Two shapes per table, because the search asks the same column two questions.
 *
 * `text_pattern_ops` is what lets `normalized_name LIKE 'محمود%'` be an index scan — the default
 * collation's btree cannot answer a prefix. gin_trgm_ops backs the substring half, `LIKE '%…%'`.
 * The typo half compares `word_similarity` against a threshold written into the query itself
 * (see arabic-search.ts), so it is a filter within the clinic rather than an index scan.
 *
 * The stored column is computed for every existing row as Postgres rewrites each table here, so
 * there is no separate backfill to run.
 */
CREATE INDEX "users_normalized_name_idx" ON "users" USING btree ("clinic_id", "normalized_name" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "patients_normalized_name_idx" ON "patients" USING btree ("clinic_id", "normalized_name" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "labs_normalized_name_idx" ON "labs" USING btree ("clinic_id", "normalized_name" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "suppliers_normalized_name_idx" ON "suppliers" USING btree ("clinic_id", "normalized_name" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "users_normalized_name_trgm_idx" ON "users" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "patients_normalized_name_trgm_idx" ON "patients" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "labs_normalized_name_trgm_idx" ON "labs" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "suppliers_normalized_name_trgm_idx" ON "suppliers" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
/* Nothing searches `full_name` directly any more; the folded column carries both halves. */
DROP INDEX IF EXISTS "patients_full_name_trgm_idx";
