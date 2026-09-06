CREATE TYPE "public"."appointment_status" AS ENUM('requested', 'confirmed', 'arrived', 'in_progress', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('checkup', 'treatment', 'followup', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."waiting_list_priority" AS ENUM('normal', 'high', 'urgent');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"type" "appointment_type" DEFAULT 'checkup' NOT NULL,
	"status" "appointment_status" DEFAULT 'confirmed' NOT NULL,
	"reason" text,
	"notes" text,
	"visit_id" uuid,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waiting_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"reason" text,
	"priority" "waiting_list_priority" DEFAULT 'normal' NOT NULL,
	"resolved_at" timestamp with time zone,
	"appointment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_clinic_idx" ON "appointments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "appointments_doctor_starts_idx" ON "appointments" USING btree ("clinic_id","doctor_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_starts_idx" ON "appointments" USING btree ("clinic_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("clinic_id","patient_id");--> statement-breakpoint
CREATE INDEX "waiting_list_clinic_idx" ON "waiting_list" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "waiting_list_open_idx" ON "waiting_list" USING btree ("clinic_id","priority","created_at") WHERE resolved_at is null and deleted_at is null;--> statement-breakpoint
/*
 * Hard double-booking prevention.
 *
 * Appended by hand: drizzle-kit cannot express `EXCLUDE`, and a check in the
 * service could not do this job at all. Between reading "the slot is free" and
 * inserting, another request can insert the same slot — only a constraint
 * holds under concurrency. So the constraint, not the service, is what rejects
 * the second booking; the service turns the resulting 23P01 into a 409.
 *
 * `btree_gist` is what lets a plain-equality column (`doctor_id`) sit in a
 * GiST index next to a range.
 */
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
/*
 * The span of an appointment, as a half-open range.
 *
 * A function rather than the expression inline, because an index expression
 * must be IMMUTABLE and `timestamptz + interval` is only STABLE: adding an
 * interval that carries months or days to a timestamptz depends on the session
 * timezone, so Postgres marks the whole operator stable.
 *
 * The promise made here is nonetheless true. `make_interval(mins => n)`
 * produces an interval with no month and no day component, and adding one of
 * those to a timestamptz is plain microsecond arithmetic — the same answer in
 * every timezone. This is the one case where the general rule is stricter than
 * it needs to be, and the reason the function is safe to mark immutable.
 *
 * It also keeps the end of an appointment out of the table: `ends_at` is
 * derived here from the same two columns the application derives it from, so
 * there is no second copy of the fact to fall out of step after a rescheduling
 * bug.
 *
 * `'[)'` is half-open on purpose: an appointment ending at 10:00 and one
 * starting at 10:00 do not overlap, which is what back-to-back means.
 */
CREATE OR REPLACE FUNCTION appointment_span(starts_at timestamptz, duration_minutes integer)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT tstzrange(starts_at, starts_at + make_interval(mins => duration_minutes), '[)')
$$;--> statement-breakpoint
/*
 * The predicate is why a cancelled or missed appointment frees its slot, and
 * it is the same rule as `occupiesSlot` in @clinic/shared. The two are written
 * twice — once in SQL, once in TypeScript — so a change has to be made in
 * both; `appointments.e2e-spec.ts` asserts they still agree.
 */
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING gist (
  "doctor_id" WITH =,
  appointment_span("starts_at", "duration_minutes") WITH &&
) WHERE ("deleted_at" IS NULL AND "status" NOT IN ('cancelled', 'no_show'));
