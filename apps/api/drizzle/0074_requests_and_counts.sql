CREATE TYPE "public"."purchase_request_status" AS ENUM('requested', 'ordered', 'partly_received', 'received', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_count_status" AS ENUM('open', 'posted', 'cancelled');--> statement-breakpoint
CREATE TABLE "purchase_request_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"note" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" "purchase_request_status" DEFAULT 'requested' NOT NULL,
	"supplier_id" uuid,
	"needed_by" date,
	"note" text,
	"sent_at" timestamp with time zone,
	"sent_to" text,
	"sent_by" uuid,
	"cancel_reason" text,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"count_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"expected" numeric(12, 3) NOT NULL,
	"counted" numeric(12, 3),
	"movement_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" "stock_count_status" DEFAULT 'open' NOT NULL,
	"note" text,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "stock_receipt_lines" ADD COLUMN "request_line_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_stock_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."stock_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_request_lines_request_idx" ON "purchase_request_lines" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requests_number_uniq" ON "purchase_requests" USING btree ("clinic_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requests_request_uniq" ON "purchase_requests" USING btree ("clinic_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests" USING btree ("clinic_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_lines_item_uniq" ON "stock_count_lines" USING btree ("count_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_counts_number_uniq" ON "stock_counts" USING btree ("clinic_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_counts_open_uniq" ON "stock_counts" USING btree ("clinic_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "stock_receipt_lines_request_line_idx" ON "stock_receipt_lines" USING btree ("request_line_id");--> statement-breakpoint
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['purchase_requests', 'purchase_request_lines', 'stock_counts', 'stock_count_lines'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete()',
      target || '_no_hard_delete', target
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_hard_delete()',
      target || '_no_truncate', target
    );
  END LOOP;
END;
$$;
