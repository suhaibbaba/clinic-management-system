-- One name, written in English: an item and a lab's work type are named as the pack and the lab
-- name them. A rename, so every row keeps its name and the ai_read view follows the column.
ALTER TABLE "inventory_items" RENAME COLUMN "name_ar" TO "name";--> statement-breakpoint
ALTER TABLE "lab_work_types" RENAME COLUMN "name_ar" TO "name";
