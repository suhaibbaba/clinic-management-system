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

/**
 * The store cupboard (ROLES.md inventory matrix).
 *
 * Every route here is closed to a **receptionist** — they appear in no row of
 * that matrix, so they are never listed and every call is a 403.
 *
 * A **doctor** reads everything and writes exactly one thing: a consumption.
 * That split is the module's whole authorization story, and it is why the
 * three movements are three routes rather than one endpoint with a `type` in
 * the body — a guard can only see the route, so the route has to be the act.
 *
 * The finer role rules inside `consume` (which patient, which procedure) and
 * the sign rules live in the service, where the data needed to check them is.
 */
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly items: InventoryItemsService,
    private readonly movements: StockMovementsService,
    private readonly reports: InventoryReportsService,
    private readonly documents: InventoryDocumentsService,
  ) {}

  /* -------------------------------- Alerts ------------------------------ */

  /**
   * Before `:id`, or Nest reads "alerts" as an item id.
   *
   * Read by every role that can see the module at all: a doctor who knows the
   * anaesthetic is nearly out is a doctor who mentions it.
   */
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

  /* ------------------------------ Movements ----------------------------- */

  /**
   * The ledger, filterable. Also the item card: `?itemId=…` with the running
   * quantity each movement left behind.
   */
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

  /** The one write a doctor makes in this module. */
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

  /**
   * Admin only: it is the one operation that makes stock — and money already
   * spent — appear to come back.
   */
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

  /* -------------------------------- Items ------------------------------- */

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

  /**
   * The item card: this item's whole history with a running quantity.
   *
   * A separate route from `/movements?itemId=` so the screen that wants one
   * item's history does not have to know the filter syntax, and so the id is
   * validated as a path parameter.
   */
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
