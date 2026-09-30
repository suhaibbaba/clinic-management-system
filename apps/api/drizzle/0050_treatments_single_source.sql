DROP VIEW IF EXISTS ai_read.treatment_clinical;--> statement-breakpoint
ALTER TYPE "public"."performed_procedure_status" RENAME TO "performed_procedure_status_old";--> statement-breakpoint
CREATE TYPE "public"."performed_procedure_status" AS ENUM('planned', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
ALTER TABLE "performed_procedures" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "performed_procedures" ALTER COLUMN "status" TYPE "public"."performed_procedure_status" USING "status"::text::"public"."performed_procedure_status";--> statement-breakpoint
ALTER TABLE "performed_procedures" ALTER COLUMN "status" SET DEFAULT 'done';--> statement-breakpoint
DROP TYPE "public"."performed_procedure_status_old";--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD COLUMN "treatment_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_treatment_plan_id_treatment_plans_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "performed_procedures_plan_idx" ON "performed_procedures" USING btree ("treatment_plan_id");--> statement-breakpoint
UPDATE "performed_procedures" p
  SET "treatment_plan_id" = i."treatment_plan_id"
  FROM "treatment_plan_items" i
  WHERE p."plan_item_id" = i."id";--> statement-breakpoint
INSERT INTO "performed_procedures" (
  "clinic_id", "patient_id", "doctor_id", "procedure_id", "price", "discount", "status",
  "treatment_plan_id", "performed_at", "notes",
  "created_at", "updated_at", "created_by", "updated_by", "deleted_at"
)
SELECT
  i."clinic_id",
  t."patient_id",
  coalesce(i."performer_doctor_id", t."doctor_id"),
  i."procedure_id",
  i."estimated_price",
  '0.00',
  CASE WHEN i."status" = 'cancelled' THEN 'cancelled' ELSE 'planned' END::"public"."performed_procedure_status",
  i."treatment_plan_id",
  i."created_at",
  i."notes",
  i."created_at",
  i."updated_at",
  i."created_by",
  i."updated_by",
  i."deleted_at"
FROM "treatment_plan_items" i
JOIN "treatment_plans" t ON t."id" = i."treatment_plan_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "performed_procedures" p
  WHERE p."plan_item_id" = i."id" AND p."deleted_at" IS NULL
);--> statement-breakpoint
CREATE VIEW ai_read.treatment_clinical AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.visit_id AS visit_id,
    t.doctor_id AS doctor_id,
    p.name AS procedure_name,
    t.status AS status,
    t.performed_at AS performed_at,
    t.price AS price,
    t.discount AS discount,
    t.notes AS notes
  FROM public.performed_procedures t
  JOIN public.clinics c ON c.id = t.clinic_id
  LEFT JOIN public.procedure_catalog p ON p.id = t.procedure_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;--> statement-breakpoint
GRANT SELECT ON ai_read.treatment_clinical TO ai_reader;
