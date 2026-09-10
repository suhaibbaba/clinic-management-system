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

// A doctor consumes and nothing else; buying and correcting the count are the technician's, and
// both touch what the clinic has spent. Admin passes by the guard's own rule.
const MOVEMENT_ROLES: Record<MovementType, readonly UserRole[]> = {
  [MOVEMENT_TYPE.PURCHASE]: [USER_ROLE.TECHNICIAN],
  [MOVEMENT_TYPE.CONSUME]: [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN],
  [MOVEMENT_TYPE.ADJUST]: [USER_ROLE.TECHNICIAN],
};

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

  // The running total is a window over the whole item history, not the page: one that restarts on
  // page two is worse than none.
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

  // Stored negative — the sign is the type's, not the form's. The patient is read off the procedure
  // rather than trusted from the request.
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

  // Signed either way, and the reason is required: this is the movement where it is the only
  // explanation that will ever exist.
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

  // Every movement goes through here, which is what makes "the sign matches the type" a fact rather
  // than a convention.
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

  // The finer split inside the module, which a guard cannot express: all three acts live on sibling
  // routes of one controller.
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
