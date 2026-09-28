import { createZodDto } from "nestjs-zod";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  cancelAppointmentSchema,
  listAppointmentsQuerySchema,
  calendarQuerySchema,
  availabilityQuerySchema,
  idParamSchema,
} from "@clinic/shared";

export class CreateAppointmentDto extends createZodDto(createAppointmentSchema) {}

export class UpdateAppointmentDto extends createZodDto(updateAppointmentSchema) {}

export class CancelAppointmentDto extends createZodDto(cancelAppointmentSchema) {}

export class ListAppointmentsQueryDto extends createZodDto(listAppointmentsQuerySchema) {}

export class CalendarQueryDto extends createZodDto(calendarQuerySchema) {}

export class AvailabilityQueryDto extends createZodDto(availabilityQuerySchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
