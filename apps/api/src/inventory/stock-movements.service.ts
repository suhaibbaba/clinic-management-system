import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  MOVEMENT_TYPE,
  USER_ROLE,
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
  type UserRole,
} from '@clinic/shared';
import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toOptionalPersonName } from '@api/common/person-name';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import {
  patients,
  performedProcedures,
  procedureCatalog,
  stockMovements,
  suppliers,
  users,
} from '@api/database/schema';
import { InventoryItemsService } from '@api/inventory/inventory-items.service';
import { normalise } from '@api/inventory/stock.service';
import { SuppliersService } from '@api/inventory/suppliers.service';

type MovementRow = typeof stockMovements.$inferSelect;

export const STOCK_MOVEMENTS_ENTITY = 'stock_movements';

/**
 * Who may write which kind of movement (ROLES.md inventory matrix).
 *
 * A doctor consumes and does nothing else: they use an ampoule at the chair
 * and say so, which is the only way the count ever matches the cupboard. They
 * do not buy stock and they do not correct the count after a stock take —
 * both are the technician's job, and both touch what the clinic has spent.
 *
 * Admin passes every check by the guard's own rule, so it is absent here.
 */
const MOVEMENT_ROLES: Record<MovementType, readonly UserRole[]> = {
  [MOVEMENT_TYPE.PURCHASE]: [USER_ROLE.TECHNICIAN],
  [MOVEMENT_TYPE.CONSUME]: [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN],
  [MOVEMENT_TYPE.ADJUST]: [USER_ROLE.TECHNICIAN],
};

/**
 * The stock ledger.
 *
 * Append-only, like every other ledger in this system: no update, no delete,
 * and a mistake corrected by writing the opposite entry with `reverses_id`
 * pointing back at the original. That is what lets an item's quantity be a
 * plain `sum(quantity)` with no special cases, and what keeps the reason a
 * number moved readable months later.
 *
 * The three kinds of movement are three methods rather than one with a `type`
 * field, because they are three different acts with three different rules: a
 * purchase carries a price and a batch, a consumption may name a patient, and
 * an adjustment must say why. One endpoint taking a discriminated union would
 * have pushed all of that into a validator and left the audit trail reading
 * "movement created" nine hundred times.
 */
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

  /* ------------------------------- Reads -------------------------------- */

  /**
   * The item card: every movement, newest first, each with what the item stood
   * at immediately after it.
   *
   * The running total is computed in SQL as a window over the *whole* item
   * history rather than over the page, because a running total that restarts
   * on page two is worse than none at all. It is ordered ascending inside the
   * window and reversed for display, which is the only way "after this
   * movement" means anything.
   */
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
          procedureName: procedureCatalog.nameAr,
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

  /* ------------------------------- Writes ------------------------------- */

  /** Buying stock. Positive, and priced — that is what a supplier statement totals. */
  async purchase(actor: AuthenticatedUser, input: PurchaseStockInput): Promise<StockMovement> {
    this.assertMayWrite(actor, MOVEMENT_TYPE.PURCHASE);
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

  /**
   * Using stock. Stored negative — the sign is the type's, not the form's.
   *
   * A procedure implies its patient: passing one without the other would leave
   * a consumption attached to a treatment but missing from the file that
   * treatment belongs to, so the patient is read off the procedure rather than
   * trusted from the request.
   */
  async consume(actor: AuthenticatedUser, input: ConsumeStockInput): Promise<StockMovement> {
    this.assertMayWrite(actor, MOVEMENT_TYPE.CONSUME);
    await this.items.requireRow(actor.clinicId, input.itemId);

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
        throw new NotFoundException('Resource not found');
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

  /**
   * Correcting the count. Signed either way, and the reason is required —
   * the schema demands it, and this is the movement where it is the only
   * explanation that will ever exist.
   */
  async adjust(actor: AuthenticatedUser, input: AdjustStockInput): Promise<StockMovement> {
    this.assertMayWrite(actor, MOVEMENT_TYPE.ADJUST);
    await this.items.requireRow(actor.clinicId, input.itemId);

    if (toThousandths(input.quantity) === 0) {
      throw new BadRequestException('An adjustment cannot be zero');
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

  /**
   * Cancels a movement by writing its opposite. Admin only.
   *
   * The original is left exactly as it was apart from a `reversed_at`
   * back-pointer, so both rows stay on the item card and the quantity moves
   * because the second row is negative — no special case in the sum, and no
   * history quietly rewritten.
   *
   * Locked with `for update`, so two admins reversing the same row race into
   * the second one finding `reversedAt` already set rather than both writing a
   * correction and taking the count twice as far.
   */
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
        .for('update');

      if (!original) {
        throw new NotFoundException('Resource not found');
      }
      if (original.reversesId !== null) {
        throw new BadRequestException('A reversing entry cannot itself be reversed');
      }
      if (original.reversedAt !== null) {
        throw new BadRequestException('This movement has already been reversed');
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
          // The batch travels with the reversal: putting six ampoules back
          // means putting them back where they came from.
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

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!row) {
        throw new Error('Failed to reverse the movement');
      }

      return toMovement(row);
    });
  }

  /* ------------------------------ Internals ----------------------------- */

  /**
   * The one insert.
   *
   * Every movement goes through here, which is what makes "the sign matches
   * the type" a fact rather than a convention — a future caller cannot write a
   * positive consumption without going past this check.
   */
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
      throw new BadRequestException('A movement cannot be zero');
    }
    if (values.type === MOVEMENT_TYPE.PURCHASE && thousandths < 0) {
      throw new BadRequestException('A purchase must be positive');
    }
    if (values.type === MOVEMENT_TYPE.CONSUME && thousandths > 0) {
      throw new BadRequestException('A consumption must be negative');
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

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to record the movement');
    }

    return toMovement(row);
  }

  /**
   * The role check for the *kind* of movement.
   *
   * The route guard already refuses anyone outside the module; this is the
   * finer split inside it, which a guard cannot express because all three acts
   * live on sibling routes of one controller.
   */
  private assertMayWrite(actor: AuthenticatedUser, type: MovementType): void {
    if (actor.role === USER_ROLE.ADMIN || MOVEMENT_ROLES[type].includes(actor.role)) {
      return;
    }

    throw new ForbiddenException('Your role cannot record this kind of movement');
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
