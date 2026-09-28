import type { CreateVisitingDoctorInput } from "@clinic/shared";

export const DEFAULT_APPOINTMENT_DURATION = 30;

export const DOCTOR_FORM_MODES = ["new", "link"] as const;

export const DOCTOR_NAME_FIELDS = [
  { key: "firstNameAr", label: "users.firstNameAr", id: "doctor-first-name-ar", ltr: false },
  { key: "lastNameAr", label: "users.lastNameAr", id: "doctor-last-name-ar", ltr: false },
  { key: "firstNameEn", label: "users.firstNameEn", id: "doctor-first-name-en", ltr: true },
  { key: "lastNameEn", label: "users.lastNameEn", id: "doctor-last-name-en", ltr: true },
] as const;

export const VISITING_DOCTOR_FORM_ID = "visiting-doctor-form";

export const EMPTY_VISITING_DOCTOR: CreateVisitingDoctorInput = {
  firstName: { ar: "", en: "" },
  lastName: { ar: "", en: "" },
  phone: "",
  email: null,
};
