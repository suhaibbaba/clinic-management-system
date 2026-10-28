CREATE TABLE "item_pack_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"unit" text NOT NULL,
	"units_per" numeric(12, 3) NOT NULL,
	"supplier_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "item_pack_sizes" ADD CONSTRAINT "item_pack_sizes_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pack_sizes" ADD CONSTRAINT "item_pack_sizes_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_pack_sizes" ADD CONSTRAINT "item_pack_sizes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_pack_sizes_active_uniq" ON "item_pack_sizes" USING btree ("clinic_id","item_id","unit",coalesce("supplier_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE archived_at is null;--> statement-breakpoint
CREATE TRIGGER item_pack_sizes_no_hard_delete BEFORE DELETE ON item_pack_sizes FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
