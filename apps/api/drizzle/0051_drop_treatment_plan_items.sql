ALTER TABLE "performed_procedures" DROP CONSTRAINT "performed_procedures_plan_item_id_treatment_plan_items_id_fk";--> statement-breakpoint
DROP INDEX "performed_procedures_plan_item_uniq";--> statement-breakpoint
ALTER TABLE "performed_procedures" DROP COLUMN "plan_item_id";--> statement-breakpoint
DROP TABLE "treatment_plan_items";--> statement-breakpoint
DROP TYPE "public"."treatment_plan_item_status";
