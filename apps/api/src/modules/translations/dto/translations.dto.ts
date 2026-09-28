import { createZodDto } from "nestjs-zod";
import {
  upsertTranslationOverrideSchema,
  deleteTranslationOverrideSchema,
  saveTranslationOverridesSchema,
} from "@clinic/shared";

export class UpsertTranslationDto extends createZodDto(upsertTranslationOverrideSchema) {}

export class ResetTranslationDto extends createZodDto(deleteTranslationOverrideSchema) {}

export class SaveTranslationsDto extends createZodDto(saveTranslationOverridesSchema) {}
