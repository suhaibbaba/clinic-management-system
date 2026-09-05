import { z } from 'zod';

import { paginationQuerySchema, weeklyScheduleSchema } from '@shared/schemas/common';
import { specialtySummarySchema } from '@shared/schemas/specialties';
import { userSchema } from '@shared/schemas/users';

/** Guard rails for slot computation later on. */
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

export const appointmentDurationSchema = z.number().int().min(5).max(480);

export const doctorSchema = z.object({
  id: z.uuid(),
  clinicId: z.uuid(),
  userId: z.uuid(),
  specialtyId: z.uuid(),
  weeklySchedule: weeklyScheduleSchema,
  defaultAppointmentDurationMinutes: appointmentDurationSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Joined for convenience; the doctor's login account. */
  user: userSchema.pick({ id: true, name: true, phone: true, email: true, isActive: true }),
  specialty: specialtySummarySchema,
});
export type Doctor = z.infer<typeof doctorSchema>;

/**
 * Writable fields without defaults — a default survives `.partial()` and would
 * silently rewrite a field the caller never sent.
 */
const doctorWritableFields = {
  specialtyId: z.uuid(),
  weeklySchedule: weeklyScheduleSchema,
  defaultAppointmentDurationMinutes: appointmentDurationSchema,
};

export const createDoctorSchema = z.object({
  ...doctorWritableFields,
  /** An existing user in the caller's clinic, whose role must be `doctor`. */
  userId: z.uuid(),
  weeklySchedule: weeklyScheduleSchema.default([]),
  defaultAppointmentDurationMinutes: appointmentDurationSchema.default(
    DEFAULT_APPOINTMENT_DURATION_MINUTES,
  ),
});
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

export const updateDoctorSchema = z
  .object(doctorWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

/**
 * Separate from `updateDoctorSchema`: a doctor may edit their own schedule but
 * nothing else about their doctor row (ROLES.md core matrix).
 */
export const updateDoctorScheduleSchema = z.object({
  weeklySchedule: weeklyScheduleSchema,
});
export type UpdateDoctorScheduleInput = z.infer<typeof updateDoctorScheduleSchema>;

export const listDoctorsQuerySchema = paginationQuerySchema.extend({
  specialtyId: z.uuid().optional(),
  isActive: z.stringbool().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
