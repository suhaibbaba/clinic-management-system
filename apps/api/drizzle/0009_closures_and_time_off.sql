CREATE TABLE "clinic_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text NOT NULL,
	"is_annual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "doctor_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clinic_closures" ADD CONSTRAINT "clinic_closures_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_time_off" ADD CONSTRAINT "doctor_time_off_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_time_off" ADD CONSTRAINT "doctor_time_off_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinic_closures_clinic_idx" ON "clinic_closures" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "clinic_closures_range_idx" ON "clinic_closures" USING btree ("clinic_id","ends_on","starts_on");--> statement-breakpoint
CREATE INDEX "doctor_time_off_clinic_idx" ON "doctor_time_off" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "doctor_time_off_doctor_starts_idx" ON "doctor_time_off" USING btree ("doctor_id","starts_at");--> statement-breakpoint
-- The dates that used to live in `clinics.settings.holidays`, as real rows.
--
-- That array is gone: it could hold no reason, was never audited, and had no
-- id for an appointment cancelled by it to point back at. Each date becomes a
-- one-day closure so a clinic that had configured its holidays keeps them.
INSERT INTO "clinic_closures" ("clinic_id", "starts_on", "ends_on", "reason", "is_annual")
SELECT
  c."id",
  holiday::date,
  holiday::date,
  'holiday',
  false
FROM "clinics" c
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(c."settings" -> 'holidays') = 'array' THEN c."settings" -> 'holidays'
    ELSE '[]'::jsonb
  END
) AS holiday
WHERE holiday ~ '^\d{4}-\d{2}-\d{2}$';--> statement-breakpoint

UPDATE "clinics" SET "settings" = "settings" - 'holidays' WHERE "settings" ? 'holidays';
