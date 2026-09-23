ALTER TYPE "public"."ai_proposal_kind" ADD VALUE 'extra_hours_create';--> statement-breakpoint
ALTER TYPE "public"."ai_proposal_kind" ADD VALUE 'plan';--> statement-breakpoint
CREATE TABLE "doctor_extra_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"date" date NOT NULL,
	"ranges" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "doctor_extra_hours" ADD CONSTRAINT "doctor_extra_hours_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_extra_hours" ADD CONSTRAINT "doctor_extra_hours_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doctor_extra_hours_clinic_idx" ON "doctor_extra_hours" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "doctor_extra_hours_doctor_date_idx" ON "doctor_extra_hours" USING btree ("doctor_id","date");