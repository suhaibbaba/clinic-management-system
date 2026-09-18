import { z } from "zod";
import { paginationQuerySchema, weeklyScheduleSchema } from "@shared/schemas/common";
import { specialtySummarySchema } from "@shared/schemas/specialties";
import { passwordSchema } from "@shared/schemas/auth";
import { personNameInputSchema } from "@shared/schemas/person-name";
import { phoneSchema } from "@shared/schemas/common";
import { userSchema } from "@shared/schemas/users";

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
  user: userSchema.pick({
    id: true,
    name: true,
    phone: true,
    email: true,
    isActive: true,
    photoUrl: true,
  }),
  specialty: specialtySummarySchema,
});
export type Doctor = z.infer<typeof doctorSchema>;

// No defaults here: a default survives `.partial()` and would silently rewrite a field the caller
// never sent.
const doctorWritableFields = {
  specialtyId: z.uuid(),
  weeklySchedule: weeklyScheduleSchema,
  defaultAppointmentDurationMinutes: appointmentDurationSchema,
};

// The staff account a doctor signs in with. No `role`: this endpoint only ever makes a doctor, and
// a role field here would be a second place the answer could be wrong.
export const newDoctorUserSchema = z.object({
  name: personNameInputSchema,
  phone: phoneSchema,
  email: z.email().max(255).nullish(),
  password: passwordSchema,
});
export type NewDoctorUserInput = z.infer<typeof newDoctorUserSchema>;

export const hasExactlyOneDoctorUser = (input: {
  readonly userId?: string | undefined;
  readonly newUser?: NewDoctorUserInput | undefined;
}): boolean => (input.userId === undefined) !== (input.newUser === undefined);

export const DOCTOR_USER_REF_MESSAGE = "Provide either userId or newUser";

export const createDoctorSchema = z
  .object({
    ...doctorWritableFields,
    /** An existing user in the caller's clinic; the API promotes them to the doctor role. */
    userId: z.uuid().optional(),
    newUser: newDoctorUserSchema.optional(),
    weeklySchedule: weeklyScheduleSchema.default([]),
    defaultAppointmentDurationMinutes: appointmentDurationSchema.default(
      DEFAULT_APPOINTMENT_DURATION_MINUTES,
    ),
  })
  .refine(hasExactlyOneDoctorUser, DOCTOR_USER_REF_MESSAGE);
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

export const updateDoctorSchema = z
  .object(doctorWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

// Separate from `updateDoctorSchema`: a doctor may edit their own schedule but nothing else about
// their row (ROLES.md).
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
