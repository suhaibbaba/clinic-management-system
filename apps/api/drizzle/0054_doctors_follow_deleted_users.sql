UPDATE "doctors"
SET "deleted_at" = "users"."deleted_at", "updated_at" = now()
FROM "users"
WHERE "users"."id" = "doctors"."user_id"
  AND "users"."deleted_at" IS NOT NULL
  AND "doctors"."deleted_at" IS NULL;
