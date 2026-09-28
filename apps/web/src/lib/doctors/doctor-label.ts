import type { Doctor } from "@clinic/shared";
import type { TFunction } from "i18next";

export const doctorOptionLabel = (doctor: Doctor, name: string, t: TFunction): string =>
  doctor.isVisiting ? t("doctors.visiting.optionLabel", { name }) : name;
