import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AUDIT_ACTION,
  USER_ROLE,
  adjustStockSchema,
  consumeStockSchema,
  createInventoryItemSchema,
  idParamSchema,
  listInventoryItemsQuerySchema,
  listMovementsQuerySchema,
  purchaseStockSchema,
  reverseMovementSchema,
  updateInventoryItemSchema,
  type InventoryAlerts,
  type InventoryItem,
  type InventoryItemRow,
  type ItemBatches,
  type Paginated,
  type ShoppingList,
  type StockMovement,
  type StockMovementRow,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { InventoryDocumentsService } from '@api/inventory/inventory-documents.service';
import {
  INVENTORY_ITEMS_ENTITY,
  InventoryItemsService,
} from '@api/inventory/inventory-items.service';
import { InventoryReportsService } from '@api/inventory/inventory-reports.service';
import {
  STOCK_MOVEMENTS_ENTITY,
  StockMovementsService,
} from '@api/inventory/stock-movements.service';

class CreateItemDto extends createZodDto(createInventoryItemSchema) {}
class UpdateItemDto extends createZodDto(updateInventoryItemSchema) {}
class ListItemsQueryDto extends createZodDto(listInventoryItemsQuerySchema) {}
class ListMovementsQueryDto extends createZodDto(listMovementsQuerySchema) {}
class PurchaseDto extends createZodDto(purchaseStockSchema) {}
class ConsumeDto extends createZodDto(consumeStockSchema) {}
class AdjustDto extends createZodDto(adjustStockSchema) {}
class ReverseDto extends createZodDto(reverseMovementSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// A receptionist is in no row of the matrix, so every call is a 403. A doctor reads all and writes
// only a consumption — hence three routes, since a guard sees the route, not a body.
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly items: InventoryItemsService,
    private readonly movements: StockMovementsService,
    private readonly reports: InventoryReportsService,
    private readonly documents: InventoryDocumentsService,
  ) {}

  /** Before `:id`, or Nest reads "alerts" as an item id. */
  @Get('alerts')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  alerts(@CurrentUser() actor: AuthenticatedUser): Promise<InventoryAlerts> {
    return this.reports.alerts(actor);
  }

  @Get('shopping-list')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  shoppingList(@CurrentUser() actor: AuthenticatedUser): Promise<ShoppingList> {
    return this.reports.shoppingList(actor);
  }

  /** The same list as paper. `@Header` rather than `@Res`: house style. */
  @Get('shopping-list.pdf')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="shopping-list.pdf"')
  shoppingListPdf(@CurrentUser() actor: AuthenticatedUser): Promise<Buffer> {
    return this.documents.shoppingList(actor);
  }

  @Get('movements')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listMovements(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListMovementsQueryDto,
  ): Promise<Paginated<StockMovementRow>> {
    return this.movements.list(actor, query);
  }

  /** Technician and admin (the service enforces it; the guard opens the door). */
  @Post('movements/purchase')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(STOCK_MOVEMENTS_ENTITY, AUDIT_ACTION.CREATE)
  purchase(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PurchaseDto,
  ): Promise<StockMovement> {
    return this.movements.purchase(actor, body);
  }

  @Post('movements/consume')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(STOCK_MOVEMENTS_ENTITY, AUDIT_ACTION.CREATE)
  consume(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ConsumeDto,
  ): Promise<StockMovement> {
    return this.movements.consume(actor, body);
  }

  @Post('movements/adjust')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(STOCK_MOVEMENTS_ENTITY, AUDIT_ACTION.CREATE)
  adjust(@CurrentUser() actor: AuthenticatedUser, @Body() body: AdjustDto): Promise<StockMovement> {
    return this.movements.adjust(actor, body);
  }

  @Patch('movements/:id/reverse')
  @Roles(USER_ROLE.ADMIN)
  @Audit(STOCK_MOVEMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReverseDto,
  ): Promise<StockMovement> {
    return this.movements.reverse(actor, params.id, body);
  }

  @Get('items')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListItemsQueryDto,
  ): Promise<Paginated<InventoryItemRow>> {
    return this.items.list(actor, query);
  }

  @Get('items/:id')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<InventoryItemRow> {
    return this.items.findOne(actor, params.id);
  }

  /** What is left of each batch, oldest first. Derived — see `StockService`. */
  @Get('items/:id/batches')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  batches(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<ItemBatches> {
    return this.items.batches(actor, params.id);
  }

  @Get('items/:id/movements')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  itemMovements(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: ListMovementsQueryDto,
  ): Promise<Paginated<StockMovementRow>> {
    return this.movements.list(actor, { ...query, itemId: params.id });
  }

  @Post('items')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(INVENTORY_ITEMS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateItemDto,
  ): Promise<InventoryItem> {
    return this.items.create(actor, body);
  }

  @Patch('items/:id')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(INVENTORY_ITEMS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateItemDto,
  ): Promise<InventoryItem> {
    return this.items.update(actor, params.id, body);
  }

  /** Admin only — an item carries a ledger, and retiring it is not housekeeping. */
  @Delete('items/:id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(INVENTORY_ITEMS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.items.softDelete(actor, params.id);
  }
}
