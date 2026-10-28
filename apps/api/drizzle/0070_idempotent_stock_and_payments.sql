ALTER TABLE "stock_movements" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_request_uniq" ON "stock_movements" USING btree ("clinic_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_payments_request_uniq" ON "supplier_payments" USING btree ("clinic_id","request_id") WHERE request_id is not null;