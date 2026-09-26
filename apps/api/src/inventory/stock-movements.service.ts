import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import {
  MOVEMENT_TYPE,
  STOCK_ERROR,
  formatThousandths,
  negateQuantity,
  toThousandths,
  type AdjustStockInput,
  type ConsumeStockInput,
  type ListMovementsQuery,
  type MovementType,
  type Paginated,
  type PurchaseStockInput,
  type ReverseMovementInput,
  type StockMovement,
  type StockMovementRow,
} from "@clinic/shared";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toOptionalPersonName } from "@api/common/person-name";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  patients,
  performedProcedures,
  procedureCatalog,
  stockMovements,
  suppliers,
  users,
} from "@api/database/schema";
import { InventoryItemsService } from "@api/inventory/inventory-items.service";
import { normalise } from "@api/inventory/stock.service";
import { SuppliersService } from "@api/inventory/suppliers.service";

type MovementRow = typeof stockMovements.$inferSelect;

export const STOCK_MOVEMENTS_ENTITY = "stock_movements";

// Append-only: a mistake is the opposite entry, so quantity stays a plain `sum()`. Three methods
// rather than one `type` field — three acts, three rules, a readable audit trail.
@Injectable()
export class StockMovementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(STOCK_MOVEMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.id, id), eq(stockMovements.clinicId, clinicId)))
        .limit(1);

      return row ? { ...toMovement(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListMovementsQuery,
  ): Promise<Paginated<StockMovementRow>> {
    const filters: (SQL | undefined)[] = [];

    if (query.itemId) {
      await this.items.requireRow(actor.clinicId, query.itemId);
      filters.push(eq(stockMovements.itemId, query.itemId));
    }
    if (query.type) {
      filters.push(eq(stockMovements.type, query.type));
    }
    if (query.supplierId) {
      filters.push(eq(stockMovements.supplierId, query.supplierId));
    }
    if (query.patientId) {
      filters.push(eq(stockMovements.patientId, query.patientId));
    }
    if (query.from) {
      filters.push(gte(stockMovements.createdAt, new Date(query.from)));
    }
    if (query.to) {
      filters.push(lt(stockMovements.createdAt, new Date(query.to)));
    }

    const where = and(eq(stockMovements.clinicId, actor.clinicId), ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          movement: stockMovements,
          supplierName: suppliers.name,
          patientName: patients.fullName,
          procedureName: procedureCatalog.name,
          createdByNameAr: users.nameAr,
          createdByNameEn: users.nameEn,
          runningQuantity: sql<string>`sum(${stockMovements.quantity}) over (
            partition by ${stockMovements.itemId}
            order by ${stockMovements.createdAt} asc, ${stockMovements.id} asc
            rows between unbounded preceding and current row
          )::text`,
        })
        .from(stockMovements)
        .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplierId))
        .leftJoin(patients, eq(patients.id, stockMovements.patientId))
        .leftJoin(
          performedProcedures,
          eq(performedProcedures.id, stockMovements.performedProcedureId),
        )
        .leftJoin(procedureCatalog, eq(procedureCatalog.id, performedProcedures.procedureId))
        .leftJoin(users, eq(users.id, stockMovements.createdBy))
        .where(where)
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(stockMovements)
        .where(where),
    ]);

    return toPaginated(
      rows.map((row) => ({
        ...toMovement(row.movement),
        supplierName: row.supplierName,
        patientName: row.patientName,
        procedureName: row.procedureName,
        createdByName: toOptionalPersonName(row.createdByNameAr, row.createdByNameEn),
        runningQuantity: normalise(row.runningQuantity),
      })),
      totals?.value ?? 0,
      query,
    );
  }

  /** Buying stock. Positive, and priced — that is what a supplier statement totals. */
  async purchase(actor: AuthenticatedUser, input: PurchaseStockInput): Promise<StockMovement> {
    await this.items.requireRow(actor.clinicId, input.itemId);

    if (input.supplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.supplierId);
    }

    return this.write(actor, {
      itemId: input.itemId,
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: input.quantity,
      unitPrice: input.unitPrice ?? null,
      supplierId: input.supplierId ?? null,
      batchNo: input.batchNo ?? null,
      expiryDate: input.expiryDate ?? null,
      reason: input.reason ?? null,
    });
  }

  // Stored negative — the sign is the type's, not the form's. The patient is read off the procedure
  // rather than trusted from the request.
  async consume(actor: AuthenticatedUser, input: ConsumeStockInput): Promise<StockMovement> {
    await this.items.requireRow(actor.clinicId, input.itemId);

    await this.assertOnHand(actor.clinicId, input.itemId, input.quantity);

    let patientId = input.patientId ?? null;

    if (input.performedProcedureId) {
      const [procedure] = await this.db
        .select({ id: performedProcedures.id, patientId: performedProcedures.patientId })
        .from(performedProcedures)
        .where(
          this.scope.where(
            performedProcedures,
            actor.clinicId,
            eq(performedProcedures.id, input.performedProcedureId),
          ),
        )
        .limit(1);

      if (!procedure) {
        throw new NotFoundException("Resource not found");
      }

      patientId = procedure.patientId;
    } else if (patientId) {
      await this.scope.findOneOrFail(patients, actor.clinicId, patientId);
    }

    return this.write(actor, {
      itemId: input.itemId,
      type: MOVEMENT_TYPE.CONSUME,
      quantity: negateQuantity(input.quantity),
      patientId,
      performedProcedureId: input.performedProcedureId ?? null,
      batchNo: input.batchNo ?? null,
      reason: input.reason ?? null,
    });
  }

  async adjust(actor: AuthenticatedUser, input: AdjustStockInput): Promise<StockMovement> {
    await this.items.requireRow(actor.clinicId, input.itemId);

    if (toThousandths(input.quantity) === 0) {
      throw new BadRequestException("An adjustment cannot be zero");
    }
    if (input.quantity.startsWith("-")) {
      if (toThousandths(input.quantity.slice(1)) < 1000) {
        throw new BadRequestException(STOCK_ERROR.BELOW_ONE);
      }
      await this.assertOnHand(actor.clinicId, input.itemId, input.quantity.slice(1));
    }

    return this.write(actor, {
      itemId: input.itemId,
      type: MOVEMENT_TYPE.ADJUST,
      quantity: input.quantity,
      reason: input.reason,
      batchNo: input.batchNo ?? null,
      expiryDate: input.expiryDate ?? null,
    });
  }

  // Nothing leaves the shelf that is not on it: a use, or a correction taking stock off, stops at
  // zero. A count found higher than recorded is the correction that adds.
  private async assertOnHand(clinicId: string, itemId: string, taking: string): Promise<void> {
    const [stock] = await this.db
      .select({ onHand: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text` })
      .from(stockMovements)
      .where(and(eq(stockMovements.clinicId, clinicId), eq(stockMovements.itemId, itemId)));

    if (toThousandths(taking) > toThousandths(stock?.onHand ?? "0")) {
      throw new ConflictException(STOCK_ERROR.INSUFFICIENT);
    }
  }

  // The original keeps everything but a `reversed_at` back-pointer, so the sum needs no special
  // case. `for update` makes two admins racing find it already set rather than double-correcting.
  async reverse(
    actor: AuthenticatedUser,
    id: string,
    input: ReverseMovementInput,
  ): Promise<StockMovement> {
    return this.db.transaction(async (tx) => {
      const [original] = await tx
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.id, id), eq(stockMovements.clinicId, actor.clinicId)))
        .limit(1)
        .for("update");

      if (!original) {
        throw new NotFoundException("Resource not found");
      }
      if (original.reversesId !== null) {
        throw new BadRequestException("A reversing entry cannot itself be reversed");
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException("This movement has already been reversed");
      }

      await tx
        .update(stockMovements)
        .set({ reversedAt: new Date() })
        .where(eq(stockMovements.id, original.id));

      const [row] = await tx
        .insert(stockMovements)
        .values({
          clinicId: original.clinicId,
          itemId: original.itemId,
          type: original.type,
          quantity: negateQuantity(normalise(original.quantity)),
          unitPrice: original.unitPrice,
          batchNo: original.batchNo,
          expiryDate: original.expiryDate,
          supplierId: original.supplierId,
          patientId: original.patientId,
          performedProcedureId: original.performedProcedureId,
          reason: input.reason,
          reversesId: original.id,
          createdBy: actor.id,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to reverse the movement");
      }

      return toMovement(row);
    });
  }

  private async write(
    actor: AuthenticatedUser,
    values: {
      itemId: string;
      type: MovementType;
      quantity: string;
      unitPrice?: string | null;
      supplierId?: string | null;
      patientId?: string | null;
      performedProcedureId?: string | null;
      batchNo?: string | null;
      expiryDate?: string | null;
      reason?: string | null;
    },
  ): Promise<StockMovement> {
    const thousandths = toThousandths(values.quantity);

    if (thousandths === 0) {
      throw new BadRequestException("A movement cannot be zero");
    }
    if (values.type === MOVEMENT_TYPE.PURCHASE && thousandths < 0) {
      throw new BadRequestException("A purchase must be positive");
    }
    if (values.type === MOVEMENT_TYPE.CONSUME && thousandths > 0) {
      throw new BadRequestException("A consumption must be negative");
    }

    const [row] = await this.db
      .insert(stockMovements)
      .values({
        clinicId: actor.clinicId,
        itemId: values.itemId,
        type: values.type,
        quantity: formatThousandths(thousandths),
        unitPrice: values.unitPrice ?? null,
        supplierId: values.supplierId ?? null,
        patientId: values.patientId ?? null,
        performedProcedureId: values.performedProcedureId ?? null,
        batchNo: values.batchNo ?? null,
        expiryDate: values.expiryDate ?? null,
        reason: values.reason ?? null,
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the movement");
    }

    return toMovement(row);
  }
}

export function toMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    clinicId: row.clinicId,
    itemId: row.itemId,
    type: row.type,
    quantity: normalise(row.quantity),
    unitPrice: row.unitPrice,
    expiryDate: row.expiryDate,
    batchNo: row.batchNo,
    supplierId: row.supplierId,
    patientId: row.patientId,
    performedProcedureId: row.performedProcedureId,
    reason: row.reason,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
