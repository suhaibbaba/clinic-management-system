import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LOOKUP_LIST, STOCK_ERROR, type CreatePackSizeInput, type PackSize } from "@clinic/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { itemPackSizes, suppliers } from "@api/database/schema";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { normalise } from "@api/modules/inventory/lib/stock";
import { type ResolvedPack } from "@api/modules/inventory/lib/pack-sizes";
import { UNIQUE_VIOLATION } from "@api/common/constants/postgres-errors";
import { violatedConstraint } from "@api/common/lib/postgres-errors";

@Injectable()
export class PackSizesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly suppliersService: SuppliersService,
    private readonly lookups: LookupsService,
  ) {}

  async list(actor: AuthenticatedUser, itemId: string): Promise<PackSize[]> {
    await this.items.requireRow(actor.clinicId, itemId);

    const rows = await this.db
      .select({ pack: itemPackSizes, supplierName: suppliers.name })
      .from(itemPackSizes)
      .leftJoin(suppliers, eq(suppliers.id, itemPackSizes.supplierId))
      .where(
        and(
          eq(itemPackSizes.clinicId, actor.clinicId),
          eq(itemPackSizes.itemId, itemId),
          isNull(itemPackSizes.archivedAt),
        ),
      )
      .orderBy(asc(itemPackSizes.unitsPer));

    return rows.map(({ pack, supplierName }) => ({
      id: pack.id,
      itemId: pack.itemId,
      unit: pack.unit,
      unitsPer: normalise(pack.unitsPer),
      supplierId: pack.supplierId,
      supplierName,
    }));
  }

  async create(
    actor: AuthenticatedUser,
    itemId: string,
    input: CreatePackSizeInput,
  ): Promise<PackSize[]> {
    await this.items.requireRow(actor.clinicId, itemId);
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.ITEM_UNIT, input.unit);

    if (input.supplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.supplierId);
    }

    try {
      await this.db.insert(itemPackSizes).values({
        clinicId: actor.clinicId,
        itemId,
        unit: input.unit,
        unitsPer: input.unitsPer,
        supplierId: input.supplierId ?? null,
        createdBy: actor.id,
      });
    } catch (error) {
      if (violatedConstraint(error, UNIQUE_VIOLATION)) {
        throw new ConflictException(STOCK_ERROR.PACK_SIZE_EXISTS);
      }

      throw error;
    }

    return this.list(actor, itemId);
  }

  async archive(actor: AuthenticatedUser, id: string): Promise<void> {
    const [row] = await this.db
      .update(itemPackSizes)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(itemPackSizes.id, id),
          eq(itemPackSizes.clinicId, actor.clinicId),
          isNull(itemPackSizes.archivedAt),
        ),
      )
      .returning({ id: itemPackSizes.id });

    if (!row) {
      throw new NotFoundException("Resource not found");
    }
  }

  async resolve(
    clinicId: string,
    lines: readonly { readonly itemId: string; readonly packSizeId?: string | undefined }[],
  ): Promise<Map<number, ResolvedPack>> {
    const ids = lines.flatMap((line) => (line.packSizeId ? [line.packSizeId] : []));

    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(itemPackSizes)
      .where(
        and(
          eq(itemPackSizes.clinicId, clinicId),
          inArray(itemPackSizes.id, ids),
          isNull(itemPackSizes.archivedAt),
        ),
      );
    const resolved = new Map<number, ResolvedPack>();

    for (const [index, line] of lines.entries()) {
      if (!line.packSizeId) {
        continue;
      }

      const pack = rows.find((row) => row.id === line.packSizeId);

      if (!pack || pack.itemId !== line.itemId) {
        throw new BadRequestException("The pack size does not belong to this item");
      }

      resolved.set(index, { unit: pack.unit, unitsPer: pack.unitsPer });
    }

    return resolved;
  }
}
