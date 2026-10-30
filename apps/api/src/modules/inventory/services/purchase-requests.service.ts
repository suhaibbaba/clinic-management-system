import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  DEFAULT_TIME_ZONE,
  PURCHASE_DOCUMENT_STATUS,
  PURCHASE_REQUEST_ERROR,
  PURCHASE_REQUEST_STATUS,
  RULE,
  localDate,
  toThousandths,
  type CreatePurchaseRequestInput,
  type ListPurchaseRequestsQuery,
  type OpenOrderLine,
  type OpenOrderLinesQuery,
  type Paginated,
  type PurchaseRequest,
  type PurchaseRequestStatus,
  type SendPurchaseRequestInput,
  type UpdatePurchaseRequestInput,
} from "@clinic/shared";
import { and, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { toOptionalPersonName } from "@api/common/person-name";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import {
  inventoryItems,
  purchaseRequestLines,
  purchaseRequestSends,
  purchaseRequests,
  stockReceiptLines,
  stockReceipts,
  suppliers,
  users,
} from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { InventoryDocumentsService } from "@api/modules/inventory/services/inventory-documents.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { InventoryReportsService } from "@api/modules/inventory/services/inventory-reports.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import {
  requestStatus,
  suggestedQuantity,
  toRequestLine,
  type RequestRow,
} from "@api/modules/inventory/lib/purchase-requests";
import { PURCHASE_REQUESTS_ENTITY } from "@api/common/constants/audit-entities";

const OPEN_STATUSES: readonly PurchaseRequestStatus[] = [
  PURCHASE_REQUEST_STATUS.REQUESTED,
  PURCHASE_REQUEST_STATUS.ORDERED,
];

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
    private readonly purchasing: PurchasingService,
    private readonly reports: InventoryReportsService,
    private readonly documents: InventoryDocumentsService,
    private readonly delivery: DocumentDeliveryService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    query: ListPurchaseRequestsQuery,
  ): Promise<Paginated<PurchaseRequest>> {
    const filters: (SQL | undefined)[] = [eq(purchaseRequests.clinicId, actor.clinicId)];

    if (query.supplierId) {
      filters.push(eq(purchaseRequests.supplierId, query.supplierId));
    }
    if (query.status) {
      const stored =
        query.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED ||
        query.status === PURCHASE_REQUEST_STATUS.RECEIVED
          ? inArray(purchaseRequests.status, [...OPEN_STATUSES])
          : eq(purchaseRequests.status, query.status);
      filters.push(stored);
    }

    const where = and(...filters);
    const { limit, offset } = toLimitOffset(query);
    const [rows, [count]] = await Promise.all([
      this.db
        .select({ id: purchaseRequests.id })
        .from(purchaseRequests)
        .where(where)
        .orderBy(desc(purchaseRequests.createdAt), desc(purchaseRequests.number))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(purchaseRequests)
        .where(where),
    ]);

    const loaded = await this.load(
      actor,
      rows.map((row) => row.id),
    );
    const items =
      query.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED ||
      query.status === PURCHASE_REQUEST_STATUS.RECEIVED
        ? loaded.filter((row) => row.status === query.status)
        : loaded;

    return toPaginated(items, count?.value ?? 0, query);
  }

  async openLines(actor: AuthenticatedUser, query: OpenOrderLinesQuery): Promise<OpenOrderLine[]> {
    const rows = await this.db
      .selectDistinct({ id: purchaseRequests.id, createdAt: purchaseRequests.createdAt })
      .from(purchaseRequests)
      .innerJoin(purchaseRequestLines, eq(purchaseRequestLines.requestId, purchaseRequests.id))
      .where(
        and(
          eq(purchaseRequests.clinicId, actor.clinicId),
          inArray(purchaseRequests.status, [...OPEN_STATUSES]),
          inArray(purchaseRequestLines.itemId, query.itemIds),
          isNull(purchaseRequestLines.removedAt),
          query.excludeRequestId ? ne(purchaseRequests.id, query.excludeRequestId) : undefined,
        ),
      )
      .orderBy(desc(purchaseRequests.createdAt));
    const wanted = new Set(query.itemIds);
    const loaded = await this.load(
      actor,
      rows.map((row) => row.id),
    );

    return loaded
      .filter((request) => request.status !== PURCHASE_REQUEST_STATUS.RECEIVED)
      .flatMap((request) =>
        request.lines
          .filter((line) => wanted.has(line.itemId) && toThousandths(line.open) > 0)
          .map((line) => ({
            itemId: line.itemId,
            requestId: request.id,
            number: request.number,
            status: request.status,
            supplierName: request.supplierName,
            createdByName: request.createdByName,
            createdAt: request.createdAt,
            unit: line.unit,
            quantity: line.quantity,
            open: line.open,
          })),
      );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<PurchaseRequest> {
    const [row] = await this.load(actor, [id]);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  async create(
    actor: AuthenticatedUser,
    input: CreatePurchaseRequestInput,
  ): Promise<PurchaseRequest> {
    if (input.requestId) {
      const [earlier] = await this.db
        .select({ id: purchaseRequests.id })
        .from(purchaseRequests)
        .where(
          and(
            eq(purchaseRequests.clinicId, actor.clinicId),
            eq(purchaseRequests.requestId, input.requestId),
          ),
        )
        .limit(1);

      if (earlier) {
        return this.findOne(actor, earlier.id);
      }
    }

    await this.validate(actor, input);

    const id = await this.db.transaction((tx) => this.insert(tx, actor, input));

    return this.findOne(actor, id);
  }

  async fromBelowMinimum(
    actor: AuthenticatedUser,
    supplierId: string | null | undefined,
  ): Promise<PurchaseRequest[]> {
    const { low } = await this.reports.alerts(actor);
    const wanted = low
      .filter((item) => !supplierId || item.defaultSupplierId === supplierId)
      .map((item) => ({ item, quantity: suggestedQuantity(item) }))
      .filter(({ quantity }) => quantity !== null);

    if (wanted.length === 0) {
      throw new ConflictException(PURCHASE_REQUEST_ERROR.NOTHING_BELOW_MINIMUM);
    }

    const bySupplier = new Map<string | null, typeof wanted>();

    for (const entry of wanted) {
      const key = entry.item.defaultSupplierId ?? null;
      bySupplier.set(key, [...(bySupplier.get(key) ?? []), entry]);
    }

    const ids = await this.db.transaction(async (tx) => {
      const created: string[] = [];

      for (const [supplier, entries] of bySupplier) {
        created.push(
          await this.insert(tx, actor, {
            supplierId: supplier,
            lines: entries.map(({ item, quantity }) => ({
              itemId: item.id,
              quantity: quantity ?? "0",
            })),
          }),
        );
      }

      return created;
    });

    return this.load(actor, ids);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdatePurchaseRequestInput,
  ): Promise<PurchaseRequest> {
    await this.validate(actor, input);

    await this.db.transaction(async (tx) => {
      const request = await this.lockOpen(tx, actor.clinicId, id);
      const received = await this.receivedByLine(tx, [id]);
      const current = await tx
        .select()
        .from(purchaseRequestLines)
        .where(and(eq(purchaseRequestLines.requestId, id), isNull(purchaseRequestLines.removedAt)));

      for (const line of current) {
        const keep = input.lines.find((wanted) => wanted.itemId === line.itemId);

        if (!keep && (received.get(line.id) ?? 0) > 0) {
          throw new ConflictException(PURCHASE_REQUEST_ERROR.WRONG_LINE);
        }
        if (!keep) {
          await tx
            .update(purchaseRequestLines)
            .set({ removedAt: new Date() })
            .where(eq(purchaseRequestLines.id, line.id));
        } else if (keep.quantity !== line.quantity || (keep.note ?? null) !== line.note) {
          await tx
            .update(purchaseRequestLines)
            .set({ quantity: keep.quantity, note: keep.note ?? null })
            .where(eq(purchaseRequestLines.id, line.id));
        }
      }

      const fresh = input.lines.filter(
        (wanted) => !current.some((line) => line.itemId === wanted.itemId),
      );

      if (fresh.length > 0) {
        await tx.insert(purchaseRequestLines).values(
          fresh.map((line) => ({
            clinicId: actor.clinicId,
            requestId: id,
            itemId: line.itemId,
            quantity: line.quantity,
            note: line.note ?? null,
          })),
        );
      }

      await tx
        .update(purchaseRequests)
        .set({
          supplierId: input.supplierId ?? null,
          neededBy: input.neededBy ?? null,
          note: input.note ?? null,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(purchaseRequests.id, id));

      await this.record(tx, actor, id, { status: request.status }, { ...input });
    });

    return this.findOne(actor, id);
  }

  async send(
    actor: AuthenticatedUser,
    id: string,
    input: SendPurchaseRequestInput,
  ): Promise<PurchaseRequest> {
    const request = await this.findOne(actor, id);

    if (!OPEN_STATUSES.includes(request.status)) {
      throw new ConflictException(PURCHASE_REQUEST_ERROR.NOT_OPEN);
    }
    if (!request.supplierId) {
      throw new ConflictException(PURCHASE_REQUEST_ERROR.NO_SUPPLIER);
    }

    const to = input.to ?? request.supplierPhone;

    if (!to) {
      throw new ConflictException(PURCHASE_REQUEST_ERROR.NO_PHONE);
    }

    const withPrices =
      input.withPrices === true && (await this.permissions.can(actor, RULE.INVENTORY_COSTS));
    const pdf = await this.documents.purchaseRequest(actor, request, withPrices);

    await this.delivery.send({
      clinicId: actor.clinicId,
      to,
      kind: "purchaseRequest",
      pdf,
      message: input.message,
    });

    return this.markOrdered(actor, id, { to, withPrices, message: input.message ?? null });
  }

  async markOrdered(
    actor: AuthenticatedUser,
    id: string,
    sent: { to: string; withPrices: boolean; message: string | null } | null = null,
  ): Promise<PurchaseRequest> {
    const sentTo = sent?.to ?? null;

    await this.db.transaction(async (tx) => {
      const request = await this.lockOpen(tx, actor.clinicId, id);

      await tx.insert(purchaseRequestSends).values({
        clinicId: actor.clinicId,
        requestId: id,
        sentTo,
        withPrices: sent?.withPrices ?? false,
        message: sent?.message ?? null,
        sentBy: actor.id,
      });

      await tx
        .update(purchaseRequests)
        .set({
          status: PURCHASE_REQUEST_STATUS.ORDERED,
          sentAt: new Date(),
          sentTo,
          sentBy: actor.id,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(purchaseRequests.id, id));

      await this.record(
        tx,
        actor,
        id,
        { status: request.status },
        { status: PURCHASE_REQUEST_STATUS.ORDERED, sentTo },
      );
    });

    return this.findOne(actor, id);
  }

  async close(actor: AuthenticatedUser, id: string): Promise<PurchaseRequest> {
    return this.finish(actor, id, PURCHASE_REQUEST_STATUS.CLOSED, null);
  }

  async cancel(actor: AuthenticatedUser, id: string, reason: string): Promise<PurchaseRequest> {
    return this.finish(actor, id, PURCHASE_REQUEST_STATUS.CANCELLED, reason);
  }

  private async finish(
    actor: AuthenticatedUser,
    id: string,
    status: PurchaseRequestStatus,
    reason: string | null,
  ): Promise<PurchaseRequest> {
    await this.db.transaction(async (tx) => {
      const request = await this.lockOpen(tx, actor.clinicId, id);

      await tx
        .update(purchaseRequests)
        .set({ status, cancelReason: reason, updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(purchaseRequests.id, id));

      await this.record(tx, actor, id, { status: request.status }, { status, reason });
    });

    return this.findOne(actor, id);
  }

  private async validate(
    actor: AuthenticatedUser,
    input: UpdatePurchaseRequestInput,
  ): Promise<void> {
    if (input.supplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.supplierId);
    }
    if (new Set(input.lines.map((line) => line.itemId)).size !== input.lines.length) {
      throw new BadRequestException(PURCHASE_REQUEST_ERROR.WRONG_LINE);
    }
    for (const line of input.lines) {
      await this.items.requireRow(actor.clinicId, line.itemId);
    }
  }

  private async insert(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    input: CreatePurchaseRequestInput,
  ): Promise<string> {
    const number = await this.purchasing.nextNumber(
      tx,
      actor.clinicId,
      "PR",
      localDate(new Date(), DEFAULT_TIME_ZONE),
    );
    const [row] = await tx
      .insert(purchaseRequests)
      .values({
        clinicId: actor.clinicId,
        number,
        supplierId: input.supplierId ?? null,
        neededBy: input.neededBy ?? null,
        note: input.note ?? null,
        requestId: input.requestId ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the request");
    }

    await tx.insert(purchaseRequestLines).values(
      input.lines.map((line) => ({
        clinicId: actor.clinicId,
        requestId: row.id,
        itemId: line.itemId,
        quantity: line.quantity,
        note: line.note ?? null,
      })),
    );

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.CREATE,
        entity: PURCHASE_REQUESTS_ENTITY,
        entityId: row.id,
        oldValue: null,
        newValue: { ...row, lines: input.lines },
      },
      tx,
    );

    return row.id;
  }

  private async lockOpen(tx: DatabaseExecutor, clinicId: string, id: string): Promise<RequestRow> {
    const [row] = await tx
      .select()
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.clinicId, clinicId)))
      .for("update");

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
    if (!OPEN_STATUSES.includes(row.status)) {
      throw new ConflictException(PURCHASE_REQUEST_ERROR.NOT_OPEN);
    }

    return row;
  }

  private async receivedByLine(
    executor: DatabaseExecutor,
    requestIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (requestIds.length === 0) {
      return new Map();
    }

    const rows = await executor
      .select({
        lineId: stockReceiptLines.requestLineId,
        received: sql<string>`sum((${stockReceiptLines.quantity} + ${stockReceiptLines.freeQuantity}) * ${stockReceiptLines.unitsPerPurchaseUnit})::text`,
      })
      .from(stockReceiptLines)
      .innerJoin(stockReceipts, eq(stockReceipts.id, stockReceiptLines.receiptId))
      .innerJoin(purchaseRequestLines, eq(purchaseRequestLines.id, stockReceiptLines.requestLineId))
      .where(
        and(
          inArray(purchaseRequestLines.requestId, [...requestIds]),
          eq(stockReceipts.status, PURCHASE_DOCUMENT_STATUS.POSTED),
        ),
      )
      .groupBy(stockReceiptLines.requestLineId);

    return new Map(rows.map((row) => [row.lineId ?? "", toThousandths(row.received)]));
  }

  private async load(actor: AuthenticatedUser, ids: readonly string[]): Promise<PurchaseRequest[]> {
    if (ids.length === 0) {
      return [];
    }

    const [rows, lines, received, seesCosts, sends] = await Promise.all([
      this.db
        .select({
          request: purchaseRequests,
          supplierName: suppliers.name,
          supplierPhone: suppliers.phone,
          createdByNameAr: users.nameAr,
          createdByNameEn: users.nameEn,
        })
        .from(purchaseRequests)
        .leftJoin(suppliers, eq(suppliers.id, purchaseRequests.supplierId))
        .leftJoin(users, eq(users.id, purchaseRequests.createdBy))
        .where(
          and(
            eq(purchaseRequests.clinicId, actor.clinicId),
            inArray(purchaseRequests.id, [...ids]),
          ),
        ),
      this.db
        .select({
          line: purchaseRequestLines,
          itemName: inventoryItems.name,
          unit: inventoryItems.unit,
        })
        .from(purchaseRequestLines)
        .innerJoin(inventoryItems, eq(inventoryItems.id, purchaseRequestLines.itemId))
        .where(
          and(
            inArray(purchaseRequestLines.requestId, [...ids]),
            isNull(purchaseRequestLines.removedAt),
          ),
        )
        .orderBy(purchaseRequestLines.createdAt, inventoryItems.name),
      this.receivedByLine(this.db, ids),
      this.permissions.can(actor, RULE.INVENTORY_COSTS),
      this.db
        .select({
          send: purchaseRequestSends,
          sentByNameAr: users.nameAr,
          sentByNameEn: users.nameEn,
        })
        .from(purchaseRequestSends)
        .leftJoin(users, eq(users.id, purchaseRequestSends.sentBy))
        .where(
          and(
            eq(purchaseRequestSends.clinicId, actor.clinicId),
            inArray(purchaseRequestSends.requestId, [...ids]),
          ),
        )
        .orderBy(desc(purchaseRequestSends.sentAt)),
    ]);

    const prices = seesCosts
      ? await this.lastPrices(actor.clinicId, rows)
      : new Map<string, string>();
    const byId = new Map(rows.map((row) => [row.request.id, row]));

    return ids.flatMap((id) => {
      const row = byId.get(id);

      if (!row) {
        return [];
      }

      const own = lines
        .filter(({ line }) => line.requestId === id)
        .map(({ line, itemName, unit }) =>
          toRequestLine(
            line,
            itemName,
            unit,
            received.get(line.id) ?? 0,
            seesCosts
              ? (prices.get(`${row.request.supplierId ?? ""}:${line.itemId}`) ?? null)
              : undefined,
          ),
        );

      return [
        {
          id: row.request.id,
          number: row.request.number,
          status: requestStatus(row.request.status, own),
          supplierId: row.request.supplierId,
          supplierName: row.supplierName,
          supplierPhone: row.supplierPhone,
          neededBy: row.request.neededBy,
          note: row.request.note,
          sentAt: row.request.sentAt?.toISOString() ?? null,
          sentTo: row.request.sentTo,
          cancelReason: row.request.cancelReason,
          createdByName: toOptionalPersonName(row.createdByNameAr, row.createdByNameEn),
          createdAt: row.request.createdAt.toISOString(),
          lines: own,
          sends: sends
            .filter(({ send }) => send.requestId === id)
            .map(({ send, sentByNameAr, sentByNameEn }) => ({
              id: send.id,
              sentAt: send.sentAt.toISOString(),
              sentTo: send.sentTo,
              sentByName: toOptionalPersonName(sentByNameAr, sentByNameEn),
            })),
        },
      ];
    });
  }

  private async lastPrices(
    clinicId: string,
    rows: readonly { readonly request: RequestRow }[],
  ): Promise<Map<string, string>> {
    const supplierIds = [
      ...new Set(rows.map((row) => row.request.supplierId).filter((id) => id !== null)),
    ];

    if (supplierIds.length === 0) {
      return new Map();
    }

    const prices = await this.db.execute<{ key: string; price: string }>(sql`
      select distinct on (r.supplier_id, l.item_id)
        r.supplier_id::text || ':' || l.item_id::text as key,
        round(l.unit_price / l.units_per_purchase_unit, 2)::text as price
      from stock_receipt_lines l
      join stock_receipts r on r.id = l.receipt_id
      where r.clinic_id = ${clinicId} and r.status = 'posted' and r.kind = 'receipt'
        and l.unit_price is not null
        and r.supplier_id in (${sql.join(
          supplierIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
      order by r.supplier_id, l.item_id, r.received_on desc, l.created_at desc
    `);

    return new Map([...prices].map((row) => [row.key, row.price]));
  }

  private async record(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    id: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.UPDATE,
        entity: PURCHASE_REQUESTS_ENTITY,
        entityId: id,
        oldValue,
        newValue,
      },
      tx,
    );
  }
}
