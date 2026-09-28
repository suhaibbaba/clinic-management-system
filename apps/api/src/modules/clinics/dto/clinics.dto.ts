import { createZodDto } from "nestjs-zod";
import {
  updateClinicSchema,
  presignClinicLogoSchema,
  confirmClinicLogoSchema,
  presignClinicAppIconSchema,
  confirmClinicAppIconSchema,
  resolveLocationSchema,
} from "@clinic/shared";

export class UpdateClinicDto extends createZodDto(updateClinicSchema) {}

export class PresignLogoDto extends createZodDto(presignClinicLogoSchema) {}

export class ConfirmLogoDto extends createZodDto(confirmClinicLogoSchema) {}

export class PresignAppIconDto extends createZodDto(presignClinicAppIconSchema) {}

export class ConfirmAppIconDto extends createZodDto(confirmClinicAppIconSchema) {}

export class ResolveLocationDto extends createZodDto(resolveLocationSchema) {}
