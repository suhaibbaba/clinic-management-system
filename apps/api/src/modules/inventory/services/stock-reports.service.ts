import { Inject, Injectable } from "@nestjs/common";
import {
  MOVEMENT_TYPE,
  formatMinorUnits,
  formatThousandths,
  toMinorUnits,
  toThousandths,
  type ItemPrice,
  type ReportRangeQuery,
  type Valuation,
  type VarianceReport,
  type WasteReport,
} from "@clinic/shared";
import { sql } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { normalise } from "@api/modules/inventory/lib/stock";

@Injectable()
export class StockReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async itemPrices(actor: AuthenticatedUser, itemId: string): Promise<ItemPrice[]> {
    await this.items.requireRow(actor.clinicId, itemId);
    await this.suppliersService.assertSeesCosts(actor);

    const rows = await this.db.execute<{
      receipt_line_id: string;
      receipt_number: string;
      received_on: string;
      supplier_id: string | null;
      supplier_name: string | null;
      purchase_unit: string | null;
      units_per: string;
      quantity: string;
      unit_price: string | null;
      unit_cost: string | null;
    }>(sql`
      select l.id::text as receipt_line_id, r.number as receipt_number,
             r.received_on::text as received_on, r.supplier_id::text as supplier_id,
             s.name as supplier_name, l.purchase_unit, l.units_per_purchase_unit::text as units_per,
             l.quantity::text as quantity, l.unit_price::text as unit_price,
             case when m.quantity > 0 and m.unknown_quantity = 0
               then round((m.value + coalesce((
                 select sum(a.value) from stock_movements a
                 where a.receipt_line_id = l.id and a.type = ${MOVEMENT_TYPE.ADJUST}
                   and a.quantity = 0 and a.reverses_id is null and a.reversed_at is null
               ), 0)) / m.quantity, 4)::text
             end as unit_cost
      from stock_receipt_lines l
      join stock_receipts r on r.id = l.receipt_id
      join stock_movements m on m.id = l.movement_id
      left join suppliers s on s.id = r.supplier_id
      where l.clinic_id = ${actor.clinicId} and l.item_id = ${itemId}
        and r.kind = 'receipt' and r.status = 'posted'
      order by r.received_on desc, l.created_at desc
      limit 100
    `);

    return [...rows].map((row) => ({
      receiptLineId: row.receipt_line_id,
      receiptNumber: row.receipt_number,
      receivedOn: row.received_on,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      purchaseUnit: row.purchase_unit,
      unitsPer: normalise(row.units_per),
      quantity: normalise(row.quantity),
      unitPrice: row.unit_price,
      unitCost: row.unit_cost,
    }));
  }

  async valuation(actor: AuthenticatedUser, date: string): Promise<Valuation> {
    await this.suppliersService.assertSeesCosts(actor);

    const rows = await this.db.execute<{
      item_id: string;
      name: string;
      category: string;
      unit: string;
      quantity: string;
      unknown: string;
      value: string;
    }>(sql`
      select i.id::text as item_id, i.name, i.category, i.unit,
             coalesce(sum(m.quantity), 0)::text as quantity,
             coalesce(sum(m.unknown_quantity), 0)::text as unknown,
             coalesce(sum(m.value), 0)::text as value
      from inventory_items i
      join stock_movements m on m.item_id = i.id and m.occurred_on <= ${date}::date
      where i.clinic_id = ${actor.clinicId} and i.deleted_at is null
      group by i.id
      having sum(m.quantity) <> 0 or sum(m.value) <> 0
      order by i.category, i.name
    `);

    const lines = [...rows].map((row) => ({
      itemId: row.item_id,
      itemName: row.name,
      category: row.category,
      unit: row.unit,
      quantity: formatThousandths(toThousandths(row.quantity)),
      unknownQuantity: formatThousandths(toThousandths(row.unknown)),
      value: formatMinorUnits(toMinorUnits(row.value)),
    }));

    return {
      date,
      total: formatMinorUnits(lines.reduce((sum, line) => sum + toMinorUnits(line.value), 0)),
      lines,
    };
  }

  async waste(actor: AuthenticatedUser, range: ReportRangeQuery): Promise<WasteReport> {
    await this.suppliersService.assertSeesCosts(actor);

    const rows = await this.db.execute<{
      item_id: string;
      name: string;
      unit: string;
      reason_code: string | null;
      quantity: string;
      value: string;
    }>(sql`
      select i.id::text as item_id, i.name, i.unit, m.reason_code,
             (-sum(m.quantity))::text as quantity, (-sum(m.value))::text as value
      from stock_movements m
      join inventory_items i on i.id = m.item_id
      where m.clinic_id = ${actor.clinicId} and m.type = ${MOVEMENT_TYPE.WRITE_OFF}
        and m.occurred_on between ${range.from}::date and ${range.to}::date
      group by i.id, m.reason_code
      having sum(m.quantity) <> 0
      order by sum(m.value) asc
    `);

    const lines = [...rows].map((row) => ({
      itemId: row.item_id,
      itemName: row.name,
      unit: row.unit,
      reasonCode: row.reason_code,
      quantity: formatThousandths(toThousandths(row.quantity)),
      value: formatMinorUnits(toMinorUnits(row.value)),
    }));

    return {
      ...range,
      total: formatMinorUnits(lines.reduce((sum, line) => sum + toMinorUnits(line.value), 0)),
      lines,
    };
  }

  async variance(actor: AuthenticatedUser, range: ReportRangeQuery): Promise<VarianceReport> {
    await this.suppliersService.assertSeesCosts(actor);

    const rows = await this.db.execute<{
      id: string;
      number: string;
      kind: "invoice" | "credit_note" | "supplementary";
      invoice_date: string;
      supplier_name: string;
      variance: string;
    }>(sql`
      select * from (
        select i.id::text as id, i.number, i.kind, i.invoice_date::text as invoice_date,
               s.name as supplier_name,
               ((case when i.kind = 'credit_note' then -1 else 1 end) *
                 (case when i.kind = 'invoice' then coalesce((
                   select sum(l.variance) from supplier_invoice_lines l where l.invoice_id = i.id
                 ), 0) else i.variance end))::text as variance
        from supplier_invoices i
        join suppliers s on s.id = i.supplier_id
        where i.clinic_id = ${actor.clinicId} and i.status = 'posted'
          and i.invoice_date between ${range.from}::date and ${range.to}::date
      ) documents
      where variance::numeric <> 0
      order by invoice_date desc, number desc
    `);

    const lines = [...rows].map((row) => ({
      documentId: row.id,
      number: row.number,
      kind: row.kind,
      date: row.invoice_date,
      supplierName: row.supplier_name,
      variance: formatMinorUnits(toMinorUnits(row.variance)),
    }));

    return {
      ...range,
      total: formatMinorUnits(lines.reduce((sum, line) => sum + toMinorUnits(line.variance), 0)),
      lines,
    };
  }
}
