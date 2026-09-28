import { createZodDto } from "nestjs-zod";
import {
  createWaitingListEntrySchema,
  updateWaitingListEntrySchema,
  promoteWaitingListEntrySchema,
  declineWaitingListEntrySchema,
  listWaitingListQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateWaitingListEntryDto extends createZodDto(createWaitingListEntrySchema) {}

export class UpdateWaitingListEntryDto extends createZodDto(updateWaitingListEntrySchema) {}

export class PromoteWaitingListEntryDto extends createZodDto(promoteWaitingListEntrySchema) {}

export class DeclineWaitingListEntryDto extends createZodDto(declineWaitingListEntrySchema) {}

export class ListWaitingListQueryDto extends createZodDto(listWaitingListQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
