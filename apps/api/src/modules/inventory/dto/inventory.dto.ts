import { createZodDto } from "nestjs-zod";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  listInventoryItemsQuerySchema,
  listMovementsQuerySchema,
  purchaseStockSchema,
  correctPurchaseSchema,
  consumeStockSchema,
  adjustStockSchema,
  reverseMovementSchema,
  idParamSchema,
  writeOffSchema,
  createPackSizeSchema,
  valuationQuerySchema,
  reportRangeQuerySchema,
  blockLotSchema,
  liftLotBlockSchema,
  listLotBlocksQuerySchema,
} from "@clinic/shared";

export class CreateItemDto extends createZodDto(createInventoryItemSchema) {}

export class UpdateItemDto extends createZodDto(updateInventoryItemSchema) {}

export class ListItemsQueryDto extends createZodDto(listInventoryItemsQuerySchema) {}

export class ListMovementsQueryDto extends createZodDto(listMovementsQuerySchema) {}

export class PurchaseDto extends createZodDto(purchaseStockSchema) {}

export class ConsumeDto extends createZodDto(consumeStockSchema) {}

export class AdjustDto extends createZodDto(adjustStockSchema) {}

export class ReverseDto extends createZodDto(reverseMovementSchema) {}

export class CorrectPurchaseDto extends createZodDto(correctPurchaseSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}

export class WriteOffDto extends createZodDto(writeOffSchema) {}

export class BlockLotDto extends createZodDto(blockLotSchema) {}

export class LiftLotBlockDto extends createZodDto(liftLotBlockSchema) {}

export class ListLotBlocksQueryDto extends createZodDto(listLotBlocksQuerySchema) {}

export class CreatePackSizeDto extends createZodDto(createPackSizeSchema) {}

export class ValuationQueryDto extends createZodDto(valuationQuerySchema) {}

export class ReportRangeQueryDto extends createZodDto(reportRangeQuerySchema) {}
