import { createZodDto } from "nestjs-zod";
import { listAppointmentsQuerySchema, uuidSchema } from "@clinic/shared";
import { z } from "zod";
import { rejectBookingSchema } from "@clinic/shared";

export class PendingQueryDto extends createZodDto(
  listAppointmentsQuerySchema.omit({ status: true }),
) {}

export class IdParamDto extends createZodDto(z.object({ id: uuidSchema })) {}

export class RejectBookingDto extends createZodDto(rejectBookingSchema) {}
