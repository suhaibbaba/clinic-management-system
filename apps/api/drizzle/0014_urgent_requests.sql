CREATE TYPE "public"."waiting_list_source" AS ENUM('reception', 'online');--> statement-breakpoint
CREATE TYPE "public"."waiting_list_status" AS ENUM('pending', 'contacted', 'scheduled', 'declined');--> statement-breakpoint
ALTER TYPE "public"."notification_template" ADD VALUE 'urgent_received';--> statement-breakpoint
ALTER TYPE "public"."notification_template" ADD VALUE 'urgent_scheduled';--> statement-breakpoint
ALTER TYPE "public"."notification_template" ADD VALUE 'urgent_declined';--> statement-breakpoint
ALTER TABLE "waiting_list" ADD COLUMN "source" "waiting_list_source" DEFAULT 'reception' NOT NULL;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD COLUMN "status" "waiting_list_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "waiting_list" ADD COLUMN "declined_reason" text;--> statement-breakpoint
CREATE INDEX "waiting_list_source_status_idx" ON "waiting_list" USING btree ("clinic_id","source","status");--> statement-breakpoint
/*
 * The rows that already exist carry their outcome in `resolved_at` and `appointment_id`; this is
 * the same fact spelled as the status. Everything else was, and stays, pending.
 *
 * `ALTER TYPE ... ADD VALUE` above cannot be used in the transaction that added it, so the enum
 * literals here are cast from text rather than written directly.
 */
UPDATE "waiting_list"
SET "status" = (CASE WHEN "appointment_id" IS NOT NULL THEN 'scheduled' ELSE 'declined' END)::"public"."waiting_list_status"
WHERE "resolved_at" IS NOT NULL;
