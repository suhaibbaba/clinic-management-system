CREATE TYPE "public"."supplier_document_kind" AS ENUM('invoice', 'credit_note', 'supplementary');--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'write_off';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'return';--> statement-breakpoint
ALTER TYPE "public"."receipt_kind" ADD VALUE 'return';--> statement-breakpoint
CREATE TABLE "lot_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_no" text NOT NULL,
	"reason" text NOT NULL,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid,
	"lift_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "supplier_allocations" ALTER COLUMN "payment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "has_expiry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "sensitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "measured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "supplier_allocations" ADD COLUMN "credit_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "kind" "supplier_document_kind" DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "credits_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "variance" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "lot_blocks" ADD CONSTRAINT "lot_blocks_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_blocks" ADD CONSTRAINT "lot_blocks_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lot_blocks_active_uniq" ON "lot_blocks" USING btree ("clinic_id","item_id","batch_no") WHERE lifted_at is null;--> statement-breakpoint
CREATE INDEX "lot_blocks_item_idx" ON "lot_blocks" USING btree ("clinic_id","item_id");--> statement-breakpoint
ALTER TABLE "supplier_allocations" ADD CONSTRAINT "supplier_allocations_credit_id_supplier_invoices_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_allocations_credit_idx" ON "supplier_allocations" USING btree ("credit_id");--> statement-breakpoint
ALTER TABLE "supplier_allocations" ADD CONSTRAINT "supplier_allocations_one_source" CHECK ((payment_id is null) <> (credit_id is null));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_lot_block() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.lifted_at IS NOT NULL THEN
    RAISE EXCEPTION 'lot_blocks: a lifted block stays lifted' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF (to_jsonb(NEW) - 'lifted_at' - 'lifted_by' - 'lift_reason')
       IS DISTINCT FROM (to_jsonb(OLD) - 'lifted_at' - 'lifted_by' - 'lift_reason') THEN
    RAISE EXCEPTION 'lot_blocks: only the lift may be recorded' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER lot_blocks_append_only BEFORE UPDATE ON lot_blocks FOR EACH ROW EXECUTE FUNCTION guard_lot_block();
--> statement-breakpoint
CREATE TRIGGER lot_blocks_no_hard_delete BEFORE DELETE ON lot_blocks FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
CREATE TRIGGER lot_blocks_no_truncate BEFORE TRUNCATE ON lot_blocks FOR EACH STATEMENT EXECUTE FUNCTION forbid_hard_delete();
