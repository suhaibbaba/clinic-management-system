import type { CreateVisitingDoctorInput } from "@clinic/shared";

export const DEFAULT_APPOINTMENT_DURATION = 30;

export const DOCTOR_FORM_MODES = ["new", "link"] as const;

export const DOCTOR_KINDS = [
  { id: "staff", label: "doctors.kinds.staff" },
  { id: "visiting", label: "doctors.kinds.visiting" },
] as const;

export const VISITING_DOCTOR_FORM_ID = "visiting-doctor-form";

export const EMPTY_VISITING_DOCTOR: CreateVisitingDoctorInput = {
  firstName: {},
  lastName: {},
  phone: "",
  email: null,
  specialtyId: "",
  defaultAppointmentDurationMinutes: DEFAULT_APPOINTMENT_DURATION,
  weeklySchedule: [],
  clinicSharePercent: null,
};
