import { createZodDto } from "nestjs-zod";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  listInventoryItemsQuerySchema,
  listMovementsQuerySchema,
  purchaseStockSchema,
  consumeStockSchema,
  adjustStockSchema,
  reverseMovementSchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateItemDto extends createZodDto(createInventoryItemSchema) {}

export class UpdateItemDto extends createZodDto(updateInventoryItemSchema) {}

export class ListItemsQueryDto extends createZodDto(listInventoryItemsQuerySchema) {}

export class ListMovementsQueryDto extends createZodDto(listMovementsQuerySchema) {}

export class PurchaseDto extends createZodDto(purchaseStockSchema) {}

export class ConsumeDto extends createZodDto(consumeStockSchema) {}

export class AdjustDto extends createZodDto(adjustStockSchema) {}

export class ReverseDto extends createZodDto(reverseMovementSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
