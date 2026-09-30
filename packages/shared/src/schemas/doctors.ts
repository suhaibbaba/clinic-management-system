import { z } from "zod";
import { paginationQuerySchema, pastDateSchema, weeklyScheduleSchema } from "@shared/schemas/common";
import { specialtySummarySchema } from "@shared/schemas/specialties";
import { passwordSchema } from "@shared/schemas/auth";
import { staffNameInputFields } from "@shared/schemas/person-name";
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
  isVisiting: z.boolean(),
});
export type Doctor = z.infer<typeof doctorSchema>;

const doctorWritableFields = {
  specialtyId: z.uuid(),
  weeklySchedule: weeklyScheduleSchema,
  defaultAppointmentDurationMinutes: appointmentDurationSchema,
};

export const newDoctorUserSchema = z.object({
  ...staffNameInputFields,
  phone: phoneSchema,
  email: z.email().max(255).nullish(),
  password: passwordSchema,
  joinedOn: pastDateSchema,
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

export const clinicSharePercentSchema = z.number().min(0).max(100);

export const createVisitingDoctorSchema = z.object({
  ...staffNameInputFields,
  phone: phoneSchema,
  email: z.email().max(255).nullish(),
  specialtyId: z.uuid(),
  defaultAppointmentDurationMinutes: appointmentDurationSchema,
  weeklySchedule: weeklyScheduleSchema,
  clinicSharePercent: clinicSharePercentSchema,
});
export type CreateVisitingDoctorInput = z.infer<typeof createVisitingDoctorSchema>;

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
