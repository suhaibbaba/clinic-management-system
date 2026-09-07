CREATE TYPE "public"."item_category" AS ENUM('medication', 'consumable', 'tool', 'sterilization');--> statement-breakpoint
CREATE TYPE "public"."item_unit" AS ENUM('piece', 'box', 'pack', 'ml', 'g', 'ampoule');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('purchase', 'consume', 'adjust');--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"category" "item_category" NOT NULL,
	"unit" "item_unit" NOT NULL,
	"min_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"default_supplier_id" uuid,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(10, 2),
	"expiry_date" date,
	"batch_no" text,
	"supplier_id" uuid,
	"patient_id" uuid,
	"performed_procedure_id" uuid,
	"reason" text,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"contact_person" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_default_supplier_id_suppliers_id_fk" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_procedure_id_performed_procedures_id_fk" FOREIGN KEY ("performed_procedure_id") REFERENCES "public"."performed_procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_clinic_idx" ON "inventory_items" USING btree ("clinic_id","category","name_ar");--> statement-breakpoint
CREATE INDEX "inventory_items_supplier_idx" ON "inventory_items" USING btree ("default_supplier_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("clinic_id","item_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_supplier_idx" ON "stock_movements" USING btree ("clinic_id","supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_patient_idx" ON "stock_movements" USING btree ("clinic_id","patient_id");--> statement-breakpoint
CREATE INDEX "stock_movements_procedure_idx" ON "stock_movements" USING btree ("performed_procedure_id");--> statement-breakpoint
CREATE INDEX "stock_movements_expiry_idx" ON "stock_movements" USING btree ("clinic_id","item_id","expiry_date");--> statement-breakpoint
CREATE INDEX "stock_movements_reverses_idx" ON "stock_movements" USING btree ("reverses_id");--> statement-breakpoint
CREATE INDEX "suppliers_clinic_idx" ON "suppliers" USING btree ("clinic_id","name");