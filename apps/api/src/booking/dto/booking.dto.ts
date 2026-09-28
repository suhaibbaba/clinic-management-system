import { createZodDto } from "nestjs-zod";
import {
  createBookingSchema,
  createUrgentRequestSchema,
  verifyOtpSchema,
  rescheduleBookingSchema,
  cancelBookingSchema,
  publicSlotsQuerySchema,
} from "@clinic/shared";
import { slugParamSchema, tokenParamSchema } from "@api/booking/lib/booking";

export class CreateBookingDto extends createZodDto(createBookingSchema) {}

export class CreateUrgentRequestDto extends createZodDto(createUrgentRequestSchema) {}

export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}

export class RescheduleBookingDto extends createZodDto(rescheduleBookingSchema) {}

export class CancelBookingDto extends createZodDto(cancelBookingSchema) {}

export class PublicSlotsQueryDto extends createZodDto(publicSlotsQuerySchema) {}

export class SlugParamDto extends createZodDto(slugParamSchema) {}

export class TokenParamDto extends createZodDto(tokenParamSchema) {}
