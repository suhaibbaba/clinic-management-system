CREATE TYPE "public"."supplier_payment_direction" AS ENUM('paid', 'refund');--> statement-breakpoint
CREATE TYPE "public"."purchase_document_status" AS ENUM('posted', 'void');--> statement-breakpoint
CREATE TYPE "public"."receipt_kind" AS ENUM('receipt', 'opening');--> statement-breakpoint
CREATE TABLE "document_counters" (
	"clinic_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_counters_clinic_id_kind_year_pk" PRIMARY KEY("clinic_id","kind","year")
);
--> statement-breakpoint
CREATE TABLE "stock_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"free_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(12, 2),
	"purchase_unit" text,
	"units_per_purchase_unit" numeric(12, 3) DEFAULT '1' NOT NULL,
	"batch_no" text,
	"expiry_date" date,
	"movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"number" text NOT NULL,
	"kind" "receipt_kind" DEFAULT 'receipt' NOT NULL,
	"supplier_id" uuid,
	"received_on" date NOT NULL,
	"note" text,
	"request_id" uuid,
	"status" "purchase_document_status" DEFAULT 'posted' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"receipt_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"free_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_kind" text,
	"discount_value" numeric(12, 2),
	"gift" boolean DEFAULT false NOT NULL,
	"gross" numeric(12, 2) NOT NULL,
	"line_discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net" numeric(12, 2) NOT NULL,
	"allocation" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost" numeric(12, 2) NOT NULL,
	"variance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_ref" text,
	"invoice_date" date NOT NULL,
	"discount_kind" text,
	"discount_value" numeric(12, 2),
	"charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2),
	"tax_amount" numeric(12, 2),
	"subtotal" numeric(12, 2) NOT NULL,
	"invoice_discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"note" text,
	"request_id" uuid,
	"status" "purchase_document_status" DEFAULT 'posted' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unknown_quantity" numeric(12, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "receipt_line_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "occurred_on" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "paid_on" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "direction" "supplier_payment_direction" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_lines" ADD CONSTRAINT "stock_receipt_lines_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_lines" ADD CONSTRAINT "stock_receipt_lines_receipt_id_stock_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_lines" ADD CONSTRAINT "stock_receipt_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_lines" ADD CONSTRAINT "stock_receipt_lines_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_allocations" ADD CONSTRAINT "supplier_allocations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_allocations" ADD CONSTRAINT "supplier_allocations_payment_id_supplier_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_allocations" ADD CONSTRAINT "supplier_allocations_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_receipt_line_id_stock_receipt_lines_id_fk" FOREIGN KEY ("receipt_line_id") REFERENCES "public"."stock_receipt_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_receipt_lines_receipt_idx" ON "stock_receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_receipt_lines_movement_uniq" ON "stock_receipt_lines" USING btree ("movement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_receipts_number_uniq" ON "stock_receipts" USING btree ("clinic_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_receipts_request_uniq" ON "stock_receipts" USING btree ("clinic_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE INDEX "stock_receipts_supplier_idx" ON "stock_receipts" USING btree ("clinic_id","supplier_id","received_on");--> statement-breakpoint
CREATE INDEX "supplier_allocations_payment_idx" ON "supplier_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "supplier_allocations_invoice_idx" ON "supplier_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_lines_invoice_idx" ON "supplier_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_lines_receipt_line_idx" ON "supplier_invoice_lines" USING btree ("receipt_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_number_uniq" ON "supplier_invoices" USING btree ("clinic_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_request_uniq" ON "supplier_invoices" USING btree ("clinic_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_reference_uniq" ON "supplier_invoices" USING btree ("clinic_id","supplier_id",lower("supplier_ref")) WHERE status = 'posted' and supplier_ref is not null;--> statement-breakpoint
CREATE INDEX "supplier_invoices_supplier_idx" ON "supplier_invoices" USING btree ("clinic_id","supplier_id","invoice_date");