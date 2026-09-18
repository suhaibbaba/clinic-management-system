CREATE TABLE "translation_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"language" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "translation_overrides" ADD CONSTRAINT "translation_overrides_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "translation_overrides_key_uniq" ON "translation_overrides" USING btree ("clinic_id","language","key") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "translation_overrides_clinic_idx" ON "translation_overrides" USING btree ("clinic_id","language");