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
  "خطة علاج شاملة",
  "إعادة تأهيل الفك العلوي",
  "معالجة لبية وتتويج",
  "خطة تجميلية",
  "علاج اللثة ثم التركيبات",
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

const DRUGS: readonly PrescriptionItem[] = [
  {
    drug: "Amoxicillin 500 mg",
    dose: "كبسولة",
    frequency: "كل 8 ساعات",
    duration: "5 أيام",
    note: null,
  },
  {
    drug: "Amoxicillin/clavulanate 1 g",
    dose: "قرص",
    frequency: "كل 12 ساعة",
    duration: "7 أيام",
    note: null,
  },
  {
    drug: "Metronidazole 500 mg",
    dose: "قرص",
    frequency: "كل 8 ساعات",
    duration: "5 أيام",
    note: "يُمنع مع الكحول",
  },
  {
    drug: "Ibuprofen 400 mg",
    dose: "قرص",
    frequency: "عند اللزوم",
    duration: "3 أيام",
    note: "بعد الأكل",
  },
  {
    drug: "Paracetamol 500 mg",
    dose: "قرص",
    frequency: "كل 6 ساعات",
    duration: "3 أيام",
    note: null,
  },
  {
    drug: "Chlorhexidine rinse",
    dose: "10 مل",
    frequency: "مرتين يومياً",
    duration: "10 أيام",
    note: "المضمضة دون بلع",
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
  "السكري من النمط الثاني",
  "ارتفاع ضغط الدم",
  "الربو",
  "قصور قلبي",
  "فقر دم",
  "قصور الغدة الدرقية",
];

const ALLERGIES: readonly string[] = ["البنسلين", "اللاتكس", "الأسبرين", "اليود", "مخدر موضعي"];

const MEDICATIONS: readonly string[] = [
  "ميتفورمين 850 ملغ",
  "أملوديبين 5 ملغ",
  "وارفارين 5 ملغ",
  "ليفوثيروكسين 50 مكغ",
  "بخاخ سالبوتامول",
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
