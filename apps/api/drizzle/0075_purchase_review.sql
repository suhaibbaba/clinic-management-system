ALTER TABLE "stock_receipts" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
DROP TRIGGER stock_receipts_document ON stock_receipts;
--> statement-breakpoint
CREATE TRIGGER stock_receipts_document BEFORE UPDATE ON stock_receipts FOR EACH ROW EXECUTE FUNCTION guard_document_row('status', 'void_reason', 'voided_at', 'voided_by', 'note', 'reviewed_at', 'reviewed_by', 'updated_at', 'updated_by');
--> statement-breakpoint
DROP TRIGGER supplier_invoices_document ON supplier_invoices;
--> statement-breakpoint
CREATE TRIGGER supplier_invoices_document BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION guard_document_row('status', 'void_reason', 'voided_at', 'voided_by', 'note', 'supplier_ref', 'reviewed_at', 'reviewed_by', 'updated_at', 'updated_by');
