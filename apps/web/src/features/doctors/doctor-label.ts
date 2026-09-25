import type { Doctor } from "@clinic/shared";
import type { TFunction } from "i18next";

/** A doctor's name as a picker lists it, a visiting doctor marked as one. */
export const doctorOptionLabel = (doctor: Doctor, name: string, t: TFunction): string =>
  doctor.isVisiting ? t("doctors.visiting.optionLabel", { name }) : name;
