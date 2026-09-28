import { createZodDto } from "nestjs-zod";
import {
  createClinicNoteSchema,
  updateClinicNoteSchema,
  listClinicNotesQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateNoteDto extends createZodDto(createClinicNoteSchema) {}

export class UpdateNoteDto extends createZodDto(updateClinicNoteSchema) {}

export class ListNotesQueryDto extends createZodDto(listClinicNotesQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
