ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_ledger;
--> statement-breakpoint
ALTER TABLE supplier_payments DISABLE TRIGGER supplier_payments_ledger;
--> statement-breakpoint
UPDATE stock_movements SET occurred_on = (created_at AT TIME ZONE 'Asia/Hebron')::date;
--> statement-breakpoint
UPDATE supplier_payments
   SET paid_on = (created_at AT TIME ZONE 'Asia/Hebron')::date,
       direction = 'paid';
--> statement-breakpoint
UPDATE stock_movements m
   SET value = round(m.quantity * m.unit_price, 2), unknown_quantity = 0
 WHERE m.type = 'purchase' AND m.reverses_id IS NULL AND m.unit_price IS NOT NULL;
--> statement-breakpoint
UPDATE stock_movements m
   SET value = 0, unknown_quantity = m.quantity
 WHERE m.reverses_id IS NULL
   AND ((m.type = 'purchase' AND m.unit_price IS NULL) OR (m.type = 'adjust' AND m.quantity > 0));
--> statement-breakpoint
UPDATE stock_movements m
   SET value = -round(abs(m.quantity) * (
         SELECT b.unit_price
           FROM stock_movements b
          WHERE b.item_id = m.item_id AND b.type = 'purchase' AND b.unit_price IS NOT NULL
            AND b.reverses_id IS NULL AND b.reversed_at IS NULL AND b.created_at <= m.created_at
          ORDER BY b.created_at DESC
          LIMIT 1
       ), 2),
       unknown_quantity = 0
 WHERE m.reverses_id IS NULL AND m.quantity < 0
   AND EXISTS (
         SELECT 1 FROM stock_movements b
          WHERE b.item_id = m.item_id AND b.type = 'purchase' AND b.unit_price IS NOT NULL
            AND b.reverses_id IS NULL AND b.reversed_at IS NULL AND b.created_at <= m.created_at
       );
--> statement-breakpoint
UPDATE stock_movements m
   SET value = 0, unknown_quantity = m.quantity
 WHERE m.reverses_id IS NULL AND m.quantity < 0
   AND NOT EXISTS (
         SELECT 1 FROM stock_movements b
          WHERE b.item_id = m.item_id AND b.type = 'purchase' AND b.unit_price IS NOT NULL
            AND b.reverses_id IS NULL AND b.reversed_at IS NULL AND b.created_at <= m.created_at
       );
--> statement-breakpoint
UPDATE stock_movements r
   SET value = -o.value, unknown_quantity = -o.unknown_quantity
  FROM stock_movements o
 WHERE r.reverses_id = o.id;
--> statement-breakpoint
CREATE TEMP TABLE legacy_purchase ON COMMIT DROP AS
SELECT m.id AS movement_id,
       m.clinic_id,
       m.item_id,
       m.quantity,
       m.unit_price,
       m.supplier_id,
       m.batch_no,
       m.expiry_date,
       m.occurred_on,
       m.created_at,
       m.created_by,
       m.reversed_at,
       rev.reason AS void_reason,
       rev.created_by AS voided_by,
       (m.unit_price IS NULL AND m.supplier_id IS NULL) AS opening,
       (m.unit_price IS NOT NULL AND m.supplier_id IS NOT NULL) AS invoiced,
       gen_random_uuid() AS line_id
  FROM stock_movements m
  LEFT JOIN stock_movements rev ON rev.reverses_id = m.id
 WHERE m.type = 'purchase' AND m.reverses_id IS NULL;
--> statement-breakpoint
CREATE TEMP TABLE legacy_receipt ON COMMIT DROP AS
SELECT gen_random_uuid() AS receipt_id, g.*
  FROM (
    SELECT DISTINCT ON (clinic_id, CASE WHEN opening THEN occurred_on::text ELSE movement_id::text END)
           clinic_id,
           opening,
           CASE WHEN opening THEN NULL ELSE movement_id END AS movement_id,
           occurred_on,
           supplier_id,
           created_at,
           created_by,
           CASE WHEN opening THEN NULL ELSE reversed_at END AS voided_at,
           CASE WHEN opening THEN NULL ELSE void_reason END AS void_reason,
           CASE WHEN opening THEN NULL ELSE voided_by END AS voided_by
      FROM legacy_purchase
     ORDER BY clinic_id, CASE WHEN opening THEN occurred_on::text ELSE movement_id::text END, created_at
  ) g;
--> statement-breakpoint
INSERT INTO stock_receipts (id, clinic_id, number, kind, supplier_id, received_on, status, void_reason, voided_at, voided_by, created_at, updated_at, created_by, updated_by)
SELECT r.receipt_id,
       r.clinic_id,
       CASE WHEN r.opening THEN 'OS-' ELSE 'GR-' END
         || extract(year FROM r.occurred_on)::int || '-'
         || lpad(row_number() OVER (PARTITION BY r.clinic_id, r.opening, extract(year FROM r.occurred_on) ORDER BY r.created_at)::text, 4, '0'),
       CASE WHEN r.opening THEN 'opening'::receipt_kind ELSE 'receipt'::receipt_kind END,
       r.supplier_id,
       r.occurred_on,
       CASE WHEN r.voided_at IS NULL THEN 'posted'::purchase_document_status ELSE 'void'::purchase_document_status END,
       r.void_reason,
       r.voided_at,
       r.voided_by,
       r.created_at,
       r.created_at,
       r.created_by,
       r.created_by
  FROM legacy_receipt r;
--> statement-breakpoint
INSERT INTO stock_receipt_lines (id, clinic_id, receipt_id, item_id, quantity, unit_price, batch_no, expiry_date, movement_id, created_at)
SELECT p.line_id, p.clinic_id, r.receipt_id, p.item_id, p.quantity, p.unit_price, p.batch_no, p.expiry_date, p.movement_id, p.created_at
  FROM legacy_purchase p
  JOIN legacy_receipt r
    ON r.clinic_id = p.clinic_id
   AND ((p.opening AND r.opening AND r.occurred_on = p.occurred_on) OR (NOT p.opening AND r.movement_id = p.movement_id));
--> statement-breakpoint
UPDATE stock_movements m SET receipt_line_id = p.line_id FROM legacy_purchase p WHERE m.id = p.movement_id;
--> statement-breakpoint
CREATE TEMP TABLE legacy_invoice ON COMMIT DROP AS
SELECT gen_random_uuid() AS invoice_id, p.*, round(p.quantity * p.unit_price, 2) AS amount
  FROM legacy_purchase p
 WHERE p.invoiced;
--> statement-breakpoint
INSERT INTO supplier_invoices (id, clinic_id, number, supplier_id, invoice_date, subtotal, total, status, void_reason, voided_at, voided_by, created_at, updated_at, created_by, updated_by)
SELECT i.invoice_id,
       i.clinic_id,
       'PI-' || extract(year FROM i.occurred_on)::int || '-'
         || lpad(row_number() OVER (PARTITION BY i.clinic_id, extract(year FROM i.occurred_on) ORDER BY i.created_at)::text, 4, '0'),
       i.supplier_id,
       i.occurred_on,
       i.amount,
       i.amount,
       CASE WHEN i.reversed_at IS NULL THEN 'posted'::purchase_document_status ELSE 'void'::purchase_document_status END,
       i.void_reason,
       i.reversed_at,
       i.voided_by,
       i.created_at,
       i.created_at,
       i.created_by,
       i.created_by
  FROM legacy_invoice i;
--> statement-breakpoint
INSERT INTO supplier_invoice_lines (clinic_id, invoice_id, receipt_line_id, item_id, quantity, unit_price, gross, net, cost, created_at)
SELECT i.clinic_id, i.invoice_id, i.line_id, i.item_id, i.quantity, i.unit_price, i.amount, i.amount, i.amount, i.created_at
  FROM legacy_invoice i;
--> statement-breakpoint
INSERT INTO document_counters (clinic_id, kind, year, last)
SELECT clinic_id, split_part(number, '-', 1), split_part(number, '-', 2)::int, max(split_part(number, '-', 3)::int)
  FROM (SELECT clinic_id, number FROM stock_receipts UNION ALL SELECT clinic_id, number FROM supplier_invoices) n
 GROUP BY 1, 2, 3;
--> statement-breakpoint
DO $$
DECLARE
  payment record;
  invoice record;
  left_over numeric(12, 2);
  taking numeric(12, 2);
BEGIN
  FOR payment IN
    SELECT * FROM supplier_payments
     WHERE reverses_id IS NULL AND reversed_at IS NULL AND deleted_at IS NULL AND amount > 0
     ORDER BY paid_on, created_at
  LOOP
    left_over := payment.amount;

    FOR invoice IN
      SELECT si.id, si.total - coalesce((
               SELECT sum(a.amount) FROM supplier_allocations a
                WHERE a.invoice_id = si.id AND a.reverses_id IS NULL AND a.reversed_at IS NULL
             ), 0) AS open_amount
        FROM supplier_invoices si
       WHERE si.clinic_id = payment.clinic_id AND si.supplier_id = payment.supplier_id AND si.status = 'posted'
       ORDER BY si.invoice_date, si.number
    LOOP
      EXIT WHEN left_over <= 0;
      CONTINUE WHEN invoice.open_amount <= 0;
      taking := least(left_over, invoice.open_amount);
      INSERT INTO supplier_allocations (clinic_id, payment_id, invoice_id, amount, created_at, updated_at, created_by, updated_by)
      VALUES (payment.clinic_id, payment.id, invoice.id, taking, payment.created_at, payment.created_at, payment.created_by, payment.created_by);
      left_over := left_over - taking;
    END LOOP;
  END LOOP;
END;
$$;
--> statement-breakpoint
ALTER TABLE stock_movements ENABLE TRIGGER stock_movements_ledger;
--> statement-breakpoint
ALTER TABLE supplier_payments ENABLE TRIGGER supplier_payments_ledger;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_document_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  changed text;
BEGIN
  SELECT string_agg(field.key, ', ')
    INTO changed
    FROM jsonb_each(to_jsonb(NEW)) AS field
   WHERE NOT (field.key = ANY (TG_ARGV))
     AND field.value IS DISTINCT FROM to_jsonb(OLD) -> field.key;

  IF changed IS NOT NULL THEN
    RAISE EXCEPTION '% is a posted document: % may not change; void it or post a correction', TG_TABLE_NAME, changed
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF to_jsonb(OLD) ->> 'status' = 'void' AND to_jsonb(NEW) ->> 'status' IS DISTINCT FROM 'void' THEN
    RAISE EXCEPTION '% is void and stays void', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER stock_receipts_document BEFORE UPDATE ON stock_receipts FOR EACH ROW EXECUTE FUNCTION guard_document_row('status', 'void_reason', 'voided_at', 'voided_by', 'note', 'updated_at', 'updated_by');
--> statement-breakpoint
CREATE TRIGGER supplier_invoices_document BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION guard_document_row('status', 'void_reason', 'voided_at', 'voided_by', 'note', 'supplier_ref', 'updated_at', 'updated_by');
--> statement-breakpoint
CREATE TRIGGER stock_receipt_lines_append_only BEFORE UPDATE ON stock_receipt_lines FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_invoice_lines_append_only BEFORE UPDATE ON supplier_invoice_lines FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER supplier_allocations_ledger BEFORE UPDATE ON supplier_allocations FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'updated_at', 'updated_by');
--> statement-breakpoint
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['stock_receipts', 'stock_receipt_lines', 'supplier_invoices', 'supplier_invoice_lines', 'supplier_allocations'] LOOP
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
