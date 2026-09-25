export const LOOKUP_LIST = {
  TOOTH_STATE: "tooth_state",
  /** The kinds of work a lab does. Prices stay per lab; the names are shared. */
  LAB_WORK_TYPE: "lab_work_type",
  LAB_MATERIAL: "lab_material",
  LAB_SHADE: "lab_shade",
  ATTACHMENT_TYPE: "attachment_type",
  APPOINTMENT_TYPE: "appointment_type",
  ITEM_CATEGORY: "item_category",
  ITEM_UNIT: "item_unit",
  PAYMENT_METHOD: "payment_method",
  FREQUENT_DRUG: "frequent_drug",
} as const;

export type LookupListKey = (typeof LOOKUP_LIST)[keyof typeof LOOKUP_LIST];

export const LOOKUP_LIST_KEYS = [
  LOOKUP_LIST.TOOTH_STATE,
  LOOKUP_LIST.LAB_WORK_TYPE,
  LOOKUP_LIST.LAB_MATERIAL,
  LOOKUP_LIST.LAB_SHADE,
  LOOKUP_LIST.ATTACHMENT_TYPE,
  LOOKUP_LIST.APPOINTMENT_TYPE,
  LOOKUP_LIST.ITEM_CATEGORY,
  LOOKUP_LIST.ITEM_UNIT,
  LOOKUP_LIST.PAYMENT_METHOD,
  LOOKUP_LIST.FREQUENT_DRUG,
] as const;

export const COLOURED_LOOKUP_LISTS: readonly LookupListKey[] = [LOOKUP_LIST.TOOTH_STATE];

export const DEFAULT_LOOKUP_COLOUR = "#7c3aed";

export type ToothArea = "crown" | "root" | "whole";

export interface ToothChartBehaviour {
  readonly area: ToothArea;
  /** Drawing the shape itself changes: an outline, a post, a retainer bar. */
  readonly shape?: "missing" | "implant" | "bridge";
  // States a tooth can be in that no procedure produces — kept out of the catalogue's outcome
  // field. Only built-in rows carry it; anything a clinic adds is something done to a tooth.
  readonly stateOnly?: boolean;
}

export interface SystemLookupRow {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly color?: string;
  readonly meta?: Record<string, unknown>;
}

export const SYSTEM_LOOKUPS: Readonly<Record<LookupListKey, readonly SystemLookupRow[]>> = {
  [LOOKUP_LIST.TOOTH_STATE]: [
    {
      code: "healthy",
      nameAr: "Healthy",
      nameEn: "Healthy",
      meta: { chartBehavior: { area: "whole", stateOnly: true } },
    },
    {
      code: "planned",
      nameAr: "مخطّط",
      nameEn: "Planned",
      meta: { chartBehavior: { area: "whole", stateOnly: true } },
    },
    {
      code: "in_progress",
      nameAr: "قيد المعالجة",
      nameEn: "In progress",
      meta: { chartBehavior: { area: "whole", stateOnly: true } },
    },
    {
      code: "filling",
      nameAr: "Filling",
      nameEn: "Filling",
      meta: { chartBehavior: { area: "crown" } },
    },
    {
      code: "root_canal",
      nameAr: "Root canal",
      nameEn: "Root canal",
      meta: { chartBehavior: { area: "root" } },
    },
    { code: "crown", nameAr: "Crown", nameEn: "Crown", meta: { chartBehavior: { area: "crown" } } },
    {
      code: "implant",
      nameAr: "Implant",
      nameEn: "Implant",
      meta: { chartBehavior: { area: "root", shape: "implant" } },
    },
    {
      code: "bridge",
      nameAr: "Bridge",
      nameEn: "Bridge",
      meta: { chartBehavior: { area: "crown", shape: "bridge" } },
    },
    {
      code: "missing",
      nameAr: "Missing",
      nameEn: "Missing",
      meta: { chartBehavior: { area: "whole", shape: "missing" } },
    },
  ],

  [LOOKUP_LIST.LAB_WORK_TYPE]: [
    { code: "zirconia_crown", nameAr: "Zirconia crown", nameEn: "Zirconia crown" },
    {
      code: "pfm_crown",
      nameAr: "Porcelain-fused-to-metal crown",
      nameEn: "Porcelain-fused-to-metal crown",
    },
    { code: "bridge_3_unit", nameAr: "Three-unit bridge", nameEn: "Three-unit bridge" },
    { code: "full_denture", nameAr: "Full denture", nameEn: "Full denture" },
    { code: "partial_denture", nameAr: "Partial denture", nameEn: "Partial denture" },
    { code: "veneer", nameAr: "Veneer", nameEn: "Veneer" },
    { code: "night_guard", nameAr: "Night guard", nameEn: "Night guard" },
    {
      code: "ortho_appliance",
      nameAr: "Removable orthodontic appliance",
      nameEn: "Removable orthodontic appliance",
    },
  ],

  [LOOKUP_LIST.LAB_MATERIAL]: [
    { code: "zirconia", nameAr: "Zirconia", nameEn: "Zirconia" },
    { code: "emax", nameAr: "E.max", nameEn: "E.max" },
    { code: "pfm", nameAr: "Porcelain-fused-to-metal", nameEn: "Porcelain-fused-to-metal" },
    { code: "acrylic", nameAr: "Acrylic", nameEn: "Acrylic" },
    { code: "chrome_cobalt", nameAr: "Chrome cobalt", nameEn: "Chrome cobalt" },
  ],

  [LOOKUP_LIST.LAB_SHADE]: [
    { code: "A1", nameAr: "A1", nameEn: "A1" },
    { code: "A2", nameAr: "A2", nameEn: "A2" },
    { code: "A3", nameAr: "A3", nameEn: "A3" },
    { code: "A3.5", nameAr: "A3.5", nameEn: "A3.5" },
    { code: "B1", nameAr: "B1", nameEn: "B1" },
    { code: "B2", nameAr: "B2", nameEn: "B2" },
    { code: "C2", nameAr: "C2", nameEn: "C2" },
    { code: "D3", nameAr: "D3", nameEn: "D3" },
  ],

  [LOOKUP_LIST.ATTACHMENT_TYPE]: [
    { code: "xray_panoramic", nameAr: "Panoramic X-ray", nameEn: "Panoramic X-ray" },
    { code: "xray_periapical", nameAr: "Periapical X-ray", nameEn: "Periapical X-ray" },
    { code: "xray_bitewing", nameAr: "Bitewing X-ray", nameEn: "Bitewing X-ray" },
    { code: "cbct", nameAr: "CBCT", nameEn: "CBCT" },
    { code: "clinical_photo", nameAr: "Clinical photo", nameEn: "Clinical photo" },
    { code: "document", nameAr: "مستند", nameEn: "Document" },
  ],

  [LOOKUP_LIST.APPOINTMENT_TYPE]: [
    { code: "checkup", nameAr: "فحص", nameEn: "Check-up" },
    { code: "treatment", nameAr: "معالجة", nameEn: "Treatment" },
    { code: "followup", nameAr: "مراجعة", nameEn: "Follow-up" },
    { code: "emergency", nameAr: "طارئ", nameEn: "Emergency" },
  ],

  [LOOKUP_LIST.ITEM_CATEGORY]: [
    { code: "medication", nameAr: "أدوية", nameEn: "Medication" },
    { code: "consumable", nameAr: "مستهلكات", nameEn: "Consumable" },
    { code: "tool", nameAr: "أدوات", nameEn: "Tool" },
    { code: "sterilization", nameAr: "تعقيم", nameEn: "Sterilisation" },
  ],

  [LOOKUP_LIST.ITEM_UNIT]: [
    { code: "piece", nameAr: "قطعة", nameEn: "piece" },
    { code: "box", nameAr: "علبة", nameEn: "box" },
    { code: "pack", nameAr: "رزمة", nameEn: "pack" },
    { code: "ml", nameAr: "مل", nameEn: "ml" },
    { code: "g", nameAr: "غ", nameEn: "g" },
    { code: "ampoule", nameAr: "أمبولة", nameEn: "ampoule" },
  ],

  [LOOKUP_LIST.PAYMENT_METHOD]: [
    { code: "cash", nameAr: "نقداً", nameEn: "Cash" },
    { code: "card", nameAr: "بطاقة", nameEn: "Card" },
    { code: "transfer", nameAr: "حوالة", nameEn: "Transfer" },
  ],

  [LOOKUP_LIST.FREQUENT_DRUG]: [
    { code: "amoxicillin_500", nameAr: "Amoxicillin 500 mg", nameEn: "Amoxicillin 500 mg" },
    {
      code: "amoxiclav_1g",
      nameAr: "Amoxicillin/clavulanate 1 g",
      nameEn: "Amoxicillin/clavulanate 1 g",
    },
    { code: "metronidazole_500", nameAr: "Metronidazole 500 mg", nameEn: "Metronidazole 500 mg" },
    { code: "ibuprofen_400", nameAr: "Ibuprofen 400 mg", nameEn: "Ibuprofen 400 mg" },
    { code: "paracetamol_500", nameAr: "Paracetamol 500 mg", nameEn: "Paracetamol 500 mg" },
    { code: "chlorhexidine_rinse", nameAr: "Chlorhexidine rinse", nameEn: "Chlorhexidine rinse" },
  ],
};

export function systemChartBehaviour(code: string): ToothChartBehaviour | undefined {
  const row = SYSTEM_LOOKUPS[LOOKUP_LIST.TOOTH_STATE].find((entry) => entry.code === code);
  const behaviour = row?.meta?.["chartBehavior"];

  return behaviour as ToothChartBehaviour | undefined;
}
