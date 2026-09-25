import {
  CHART_TYPE,
  FDI_DECIDUOUS_TEETH,
  FDI_PERMANENT_TEETH,
  PERFORMED_PROCEDURE_STATUS,
  TOOTH_SURFACES,
  TREATMENT_PLAN_ITEM_STATUS,
  TREATMENT_PLAN_STATUS,
  type PerformedProcedureStatus,
  type PrescriptionItem,
  type ToothLocation,
} from "@clinic/shared";
import type { Rng } from "@api/database/seed/random";

/** The FDI numbers a mouth of this age actually has. */
export function teethFor(ageYears: number): readonly number[] {
  if (ageYears <= 6) {
    return FDI_DECIDUOUS_TEETH;
  }

  if (ageYears <= 12) {
    return [...FDI_DECIDUOUS_TEETH, ...FDI_PERMANENT_TEETH];
  }

  return FDI_PERMANENT_TEETH;
}

export function toothLocation(rng: Rng, tooth: number): ToothLocation {
  return {
    tooth,
    surfaces: rng.sample([...TOOTH_SURFACES], rng.int(1, 2)),
  };
}

export const CHART_MARK_TYPE = CHART_TYPE.TOOTH_FDI;

const DISCOUNT_REASONS: readonly string[] = [
  "خصم عائلي",
  "حالة اجتماعية",
  "خصم على الدفع النقدي",
  "مراجعة قديمة",
];

/** A discount on roughly one procedure in twelve, which is what a practice actually gives. */
export function discountFor(rng: Rng, price: number): { amount: string; reason: string | null } {
  if (!rng.bool(0.08)) {
    return { amount: "0.00", reason: null };
  }

  const percent = rng.pick([5, 10, 15, 20]);
  const amount = Math.round((price * percent) / 100);

  return { amount: `${amount}.00`, reason: rng.pick(DISCOUNT_REASONS) };
}

export function procedureStatus(rng: Rng, isPast: boolean): PerformedProcedureStatus {
  if (!isPast) {
    return PERFORMED_PROCEDURE_STATUS.PLANNED;
  }

  return rng.bool(0.05) ? PERFORMED_PROCEDURE_STATUS.IN_PROGRESS : PERFORMED_PROCEDURE_STATUS.DONE;
}

const PLAN_TITLES: readonly string[] = [
  "Comprehensive treatment plan",
  "Upper jaw rehabilitation",
  "Root canal and crown",
  "Cosmetic plan",
  "Periodontal therapy, then prosthetics",
];

export const PLAN_STATUSES = [
  TREATMENT_PLAN_STATUS.DRAFT,
  TREATMENT_PLAN_STATUS.ACTIVE,
  TREATMENT_PLAN_STATUS.ACTIVE,
  TREATMENT_PLAN_STATUS.COMPLETED,
  TREATMENT_PLAN_STATUS.CANCELLED,
] as const;

export const PLAN_ITEM_STATUSES = [
  TREATMENT_PLAN_ITEM_STATUS.PLANNED,
  TREATMENT_PLAN_ITEM_STATUS.PLANNED,
  TREATMENT_PLAN_ITEM_STATUS.CONVERTED,
  TREATMENT_PLAN_ITEM_STATUS.CANCELLED,
] as const;

export function planTitle(rng: Rng): string {
  return rng.pick(PLAN_TITLES);
}

const PLAN_NOTES: readonly string[] = [
  "Patient prefers morning appointments.",
  "Start with the lower molars.\nCrown the upper right premolar once the gum has healed.\nReview the X-ray before the final step.",
  "Staged over three months to spread the cost; agreed with the patient.",
  "Extraction first, then an implant consultation after four weeks of healing. The patient asked for a written estimate to take to their insurer before committing to the implant stage.",
];

/** Half the plans carry a note, some longer than a card's line. */
export function planNotes(rng: Rng): string | null {
  return rng.bool(0.5) ? rng.pick(PLAN_NOTES) : null;
}

const DRUGS: readonly PrescriptionItem[] = [
  {
    drug: "Amoxicillin 500 mg",
    dose: "1 capsule",
    frequency: "every 8 hours",
    duration: "5 days",
    note: null,
  },
  {
    drug: "Amoxicillin/clavulanate 1 g",
    dose: "1 tablet",
    frequency: "every 12 hours",
    duration: "7 days",
    note: null,
  },
  {
    drug: "Metronidazole 500 mg",
    dose: "1 tablet",
    frequency: "every 8 hours",
    duration: "5 days",
    note: "No alcohol",
  },
  {
    drug: "Ibuprofen 400 mg",
    dose: "1 tablet",
    frequency: "as needed",
    duration: "3 days",
    note: "After meals",
  },
  {
    drug: "Paracetamol 500 mg",
    dose: "1 tablet",
    frequency: "every 6 hours",
    duration: "3 days",
    note: null,
  },
  {
    drug: "Chlorhexidine rinse",
    dose: "10 ml",
    frequency: "twice daily",
    duration: "10 days",
    note: "Rinse, do not swallow",
  },
];

export function prescriptionItems(rng: Rng): PrescriptionItem[] {
  return rng.sample(DRUGS, rng.int(1, 3));
}

export interface MedicalHistorySeed {
  readonly chronicConditions: string[];
  readonly allergies: string[];
  readonly currentMedications: string[];
  readonly isPregnant: boolean | null;
  readonly notes: string | null;
}

const CONDITIONS: readonly string[] = [
  "Type 2 diabetes",
  "Hypertension",
  "Asthma",
  "Heart failure",
  "Anaemia",
  "Hypothyroidism",
];

const ALLERGIES: readonly string[] = [
  "Penicillin",
  "Latex",
  "Aspirin",
  "Iodine",
  "Local anaesthetic",
];

const MEDICATIONS: readonly string[] = [
  "Metformin 850 mg",
  "Amlodipine 5 mg",
  "Warfarin 5 mg",
  "Levothyroxine 50 mcg",
  "Salbutamol inhaler",
];

export function medicalHistory(
  rng: Rng,
  ageYears: number,
  isFemale: boolean,
): MedicalHistorySeed | null {
  if (!rng.bool(0.3)) {
    return null;
  }

  const pregnant = isFemale && ageYears >= 18 && ageYears <= 44 && rng.bool(0.12);
  const hasCondition = ageYears >= 35 && rng.bool(0.6);

  return {
    chronicConditions: hasCondition ? rng.sample(CONDITIONS, rng.int(1, 2)) : [],
    allergies: rng.bool(0.55) ? rng.sample(ALLERGIES, 1) : [],
    currentMedications: hasCondition ? rng.sample(MEDICATIONS, 1) : [],
    isPregnant: isFemale ? pregnant : null,
    notes: pregnant ? "حامل — تجنب الصور الشعاعية" : null,
  };
}
