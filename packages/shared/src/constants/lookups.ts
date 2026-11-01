import type { LocalizedText } from "@shared/locale/localized-text";
import { CHART_TYPE, type ChartType } from "@shared/enums";

export const LOOKUP_LIST = {
  TOOTH_STATE: "tooth_state",
  LAB_WORK_TYPE: "lab_work_type",
  LAB_MATERIAL: "lab_material",
  LAB_SHADE: "lab_shade",
  ATTACHMENT_TYPE: "attachment_type",
  APPOINTMENT_TYPE: "appointment_type",
  ITEM_CATEGORY: "item_category",
  ITEM_UNIT: "item_unit",
  PAYMENT_METHOD: "payment_method",
  FREQUENT_DRUG: "frequent_drug",
  DRUG_INSTRUCTION: "drug_instruction",
  EXPENSE_CATEGORY: "expense_category",
  WRITE_OFF_REASON: "write_off_reason",
  BODY_REGION: "body_region",
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
  LOOKUP_LIST.DRUG_INSTRUCTION,
  LOOKUP_LIST.EXPENSE_CATEGORY,
  LOOKUP_LIST.WRITE_OFF_REASON,
  LOOKUP_LIST.BODY_REGION,
] as const;

export const CHART_LOOKUP_LISTS: Partial<Record<LookupListKey, ChartType>> = {
  [LOOKUP_LIST.TOOTH_STATE]: CHART_TYPE.TOOTH_FDI,
  [LOOKUP_LIST.LAB_SHADE]: CHART_TYPE.TOOTH_FDI,
  [LOOKUP_LIST.BODY_REGION]: CHART_TYPE.BODY_REGION,
};

export function clinicLookupLists(chartTypes: readonly ChartType[]): LookupListKey[] {
  return LOOKUP_LIST_KEYS.filter((key) => {
    const chart = CHART_LOOKUP_LISTS[key];

    return chart === undefined || chartTypes.includes(chart);
  });
}

export const COLOURED_LOOKUP_LISTS: readonly LookupListKey[] = [LOOKUP_LIST.TOOTH_STATE];

export const ENGLISH_ONLY_LOOKUP_LISTS: readonly LookupListKey[] = [
  LOOKUP_LIST.ITEM_UNIT,
  LOOKUP_LIST.ITEM_CATEGORY,
  LOOKUP_LIST.FREQUENT_DRUG,
];

export const DEFAULT_LOOKUP_COLOUR = "#7c3aed";

export type ToothArea = "crown" | "root" | "whole";

export interface ToothChartBehaviour {
  readonly area: ToothArea;
  readonly shape?: "missing" | "implant" | "bridge";
  readonly stateOnly?: boolean;
}

export interface SystemLookupRow {
  readonly code: string;
  readonly name: LocalizedText;
  readonly color?: string;
  readonly meta?: Record<string, unknown>;
  readonly chart?: ChartType;
}

const onToothChart = (row: SystemLookupRow): SystemLookupRow => ({
  ...row,
  chart: CHART_TYPE.TOOTH_FDI,
});

export const SYSTEM_LOOKUPS: Readonly<Record<LookupListKey, readonly SystemLookupRow[]>> = {
  [LOOKUP_LIST.TOOTH_STATE]: [
    {
      code: "healthy",
      name: { ar: "Healthy", en: "Healthy", tr: "Sağlıklı" },
      meta: { chartBehavior: { area: "whole", stateOnly: true } },
    },
    {
      code: "planned",
      name: { ar: "مخطّط", en: "Planned", tr: "Planlandı" },
      meta: { chartBehavior: { area: "whole", stateOnly: true } },
    },
    {
      code: "in_progress",
      name: { ar: "قيد المعالجة", en: "In progress", tr: "Devam ediyor" },
      meta: { chartBehavior: { area: "whole", stateOnly: true } },
    },
    {
      code: "filling",
      name: { ar: "Filling", en: "Filling", tr: "Dolgu" },
      meta: { chartBehavior: { area: "crown" } },
    },
    {
      code: "root_canal",
      name: { ar: "Root canal", en: "Root canal", tr: "Kanal tedavisi" },
      meta: { chartBehavior: { area: "root" } },
    },
    {
      code: "crown",
      name: { ar: "Crown", en: "Crown", tr: "Kron" },
      meta: { chartBehavior: { area: "crown" } },
    },
    {
      code: "implant",
      name: { ar: "Implant", en: "Implant", tr: "İmplant" },
      meta: { chartBehavior: { area: "root", shape: "implant" } },
    },
    {
      code: "bridge",
      name: { ar: "Bridge", en: "Bridge", tr: "Köprü" },
      meta: { chartBehavior: { area: "crown", shape: "bridge" } },
    },
    {
      code: "missing",
      name: { ar: "Missing", en: "Missing", tr: "Eksik" },
      meta: { chartBehavior: { area: "whole", shape: "missing" } },
    },
  ],

  [LOOKUP_LIST.LAB_WORK_TYPE]: [
    {
      code: "zirconia_crown",
      name: { ar: "Zirconia crown", en: "Zirconia crown", tr: "Zirkonyum kron" },
    },
    {
      code: "pfm_crown",
      name: {
        ar: "Porcelain-fused-to-metal crown",
        en: "Porcelain-fused-to-metal crown",
        tr: "Metal destekli porselen kron",
      },
    },
    {
      code: "bridge_3_unit",
      name: { ar: "Three-unit bridge", en: "Three-unit bridge", tr: "Üç üyeli köprü" },
    },
    { code: "full_denture", name: { ar: "Full denture", en: "Full denture", tr: "Tam protez" } },
    {
      code: "partial_denture",
      name: { ar: "Partial denture", en: "Partial denture", tr: "Parsiyel protez" },
    },
    { code: "veneer", name: { ar: "Veneer", en: "Veneer", tr: "Lamina" } },
    { code: "night_guard", name: { ar: "Night guard", en: "Night guard", tr: "Gece plağı" } },
    {
      code: "ortho_appliance",
      name: {
        ar: "Removable orthodontic appliance",
        en: "Removable orthodontic appliance",
        tr: "Hareketli ortodontik aparey",
      },
    },
  ].map(onToothChart),

  [LOOKUP_LIST.LAB_MATERIAL]: [
    { code: "zirconia", name: { ar: "Zirconia", en: "Zirconia", tr: "Zirkonyum" } },
    { code: "emax", name: { ar: "E.max", en: "E.max", tr: "E.max" } },
    {
      code: "pfm",
      name: {
        ar: "Porcelain-fused-to-metal",
        en: "Porcelain-fused-to-metal",
        tr: "Metal destekli porselen",
      },
    },
    { code: "acrylic", name: { ar: "Acrylic", en: "Acrylic", tr: "Akrilik" } },
    {
      code: "chrome_cobalt",
      name: { ar: "Chrome cobalt", en: "Chrome cobalt", tr: "Krom kobalt" },
    },
  ].map(onToothChart),

  [LOOKUP_LIST.LAB_SHADE]: [
    { code: "A1", name: { ar: "A1", en: "A1", tr: "A1" } },
    { code: "A2", name: { ar: "A2", en: "A2", tr: "A2" } },
    { code: "A3", name: { ar: "A3", en: "A3", tr: "A3" } },
    { code: "A3.5", name: { ar: "A3.5", en: "A3.5", tr: "A3.5" } },
    { code: "B1", name: { ar: "B1", en: "B1", tr: "B1" } },
    { code: "B2", name: { ar: "B2", en: "B2", tr: "B2" } },
    { code: "C2", name: { ar: "C2", en: "C2", tr: "C2" } },
    { code: "D3", name: { ar: "D3", en: "D3", tr: "D3" } },
  ],

  [LOOKUP_LIST.ATTACHMENT_TYPE]: [
    onToothChart({
      code: "xray_panoramic",
      name: { ar: "Panoramic X-ray", en: "Panoramic X-ray", tr: "Panoramik röntgen" },
    }),
    onToothChart({
      code: "xray_periapical",
      name: { ar: "Periapical X-ray", en: "Periapical X-ray", tr: "Periapikal röntgen" },
    }),
    onToothChart({
      code: "xray_bitewing",
      name: { ar: "Bitewing X-ray", en: "Bitewing X-ray", tr: "Bitewing röntgen" },
    }),
    onToothChart({ code: "cbct", name: { ar: "CBCT", en: "CBCT", tr: "CBCT" } }),
    {
      code: "clinical_photo",
      name: { ar: "Clinical photo", en: "Clinical photo", tr: "Klinik fotoğraf" },
    },
    { code: "document", name: { ar: "مستند", en: "Document", tr: "Belge" } },
  ],

  [LOOKUP_LIST.APPOINTMENT_TYPE]: [
    { code: "checkup", name: { ar: "فحص", en: "Check-up", tr: "Kontrol" } },
    { code: "treatment", name: { ar: "معالجة", en: "Treatment", tr: "Tedavi" } },
    { code: "followup", name: { ar: "مراجعة", en: "Follow-up", tr: "Takip" } },
    { code: "emergency", name: { ar: "طارئ", en: "Emergency", tr: "Acil" } },
  ],

  [LOOKUP_LIST.ITEM_CATEGORY]: [
    { code: "medication", name: { ar: "Medication", en: "Medication", tr: "İlaç" } },
    { code: "consumable", name: { ar: "Consumable", en: "Consumable", tr: "Sarf malzemesi" } },
    { code: "tool", name: { ar: "Tool", en: "Tool", tr: "Alet" } },
    {
      code: "sterilization",
      name: { ar: "Sterilisation", en: "Sterilisation", tr: "Sterilizasyon" },
    },
  ],

  [LOOKUP_LIST.ITEM_UNIT]: [
    { code: "piece", name: { ar: "piece", en: "piece", tr: "adet" } },
    { code: "box", name: { ar: "box", en: "box", tr: "kutu" } },
    { code: "pack", name: { ar: "pack", en: "pack", tr: "paket" } },
    { code: "ml", name: { ar: "ml", en: "ml", tr: "ml" } },
    { code: "g", name: { ar: "g", en: "g", tr: "g" } },
    { code: "ampoule", name: { ar: "ampoule", en: "ampoule", tr: "ampul" } },
  ],

  [LOOKUP_LIST.PAYMENT_METHOD]: [
    { code: "cash", name: { ar: "نقداً", en: "Cash", tr: "Nakit" } },
    { code: "card", name: { ar: "بطاقة", en: "Card", tr: "Kart" } },
    { code: "transfer", name: { ar: "حوالة", en: "Transfer", tr: "Havale" } },
  ],

  [LOOKUP_LIST.FREQUENT_DRUG]: [],

  [LOOKUP_LIST.EXPENSE_CATEGORY]: [
    { code: "rent", name: { ar: "إيجار", en: "Rent", tr: "Kira" } },
    { code: "utilities", name: { ar: "كهرباء وماء وإنترنت", en: "Utilities", tr: "Faturalar" } },
    { code: "maintenance", name: { ar: "صيانة", en: "Maintenance", tr: "Bakım" } },
    { code: "marketing", name: { ar: "تسويق", en: "Marketing", tr: "Pazarlama" } },
    {
      code: "fees",
      name: { ar: "رسوم وتراخيص", en: "Fees and licences", tr: "Harç ve lisanslar" },
    },
    { code: "other", name: { ar: "أخرى", en: "Other", tr: "Diğer" } },
  ],

  [LOOKUP_LIST.WRITE_OFF_REASON]: [
    { code: "expired", name: { ar: "منتهي الصلاحية", en: "Expired", tr: "Süresi geçmiş" } },
    { code: "damaged", name: { ar: "تالف", en: "Damaged", tr: "Hasarlı" } },
    {
      code: "wasted",
      name: {
        ar: "فُتح وتلف قبل الاستعمال",
        en: "Opened and wasted",
        tr: "Açılıp kullanılmadan atıldı",
      },
    },
    { code: "lost", name: { ar: "مفقود", en: "Lost", tr: "Kayıp" } },
    { code: "recalled", name: { ar: "مسحوب من المورّد", en: "Recalled", tr: "Geri çağrıldı" } },
    { code: "other", name: { ar: "أخرى", en: "Other", tr: "Diğer" } },
  ],

  [LOOKUP_LIST.BODY_REGION]: [
    {
      code: "cervical_spine",
      name: { ar: "الفقرات الرقبية", en: "Cervical spine", tr: "Servikal omurga" },
      meta: { paired: false },
    },
    {
      code: "clavicle",
      name: { ar: "الترقوة", en: "Clavicle", tr: "Klavikula" },
      meta: { paired: true },
    },
    {
      code: "shoulder",
      name: { ar: "مفصل الكتف", en: "Shoulder joint", tr: "Omuz eklemi" },
      meta: { paired: true },
    },
    {
      code: "scapula",
      name: { ar: "عظم اللوح", en: "Scapula", tr: "Skapula" },
      meta: { paired: true },
    },
    {
      code: "sternum",
      name: { ar: "عظم القص", en: "Sternum", tr: "Sternum" },
      meta: { paired: false },
    },
    {
      code: "thoracic_spine",
      name: { ar: "الفقرات الصدرية", en: "Thoracic spine", tr: "Torakal omurga" },
      meta: { paired: false },
    },
    { code: "ribs", name: { ar: "الأضلاع", en: "Ribs", tr: "Kaburgalar" }, meta: { paired: true } },
    {
      code: "humerus",
      name: { ar: "عظم العضد", en: "Humerus", tr: "Humerus" },
      meta: { paired: true },
    },
    {
      code: "elbow",
      name: { ar: "مفصل الكوع", en: "Elbow joint", tr: "Dirsek eklemi" },
      meta: { paired: true },
    },
    {
      code: "lumbar_spine",
      name: { ar: "الفقرات القطنية", en: "Lumbar spine", tr: "Lomber omurga" },
      meta: { paired: false },
    },
    {
      code: "radius",
      name: { ar: "عظم الكعبرة", en: "Radius", tr: "Radius" },
      meta: { paired: true },
    },
    { code: "ulna", name: { ar: "عظم الزند", en: "Ulna", tr: "Ulna" }, meta: { paired: true } },
    {
      code: "wrist",
      name: { ar: "مفصل الرسغ", en: "Wrist joint", tr: "El bileği eklemi" },
      meta: { paired: true },
    },
    {
      code: "hand",
      name: { ar: "عظام اليد", en: "Hand bones", tr: "El kemikleri" },
      meta: { paired: true },
    },
    {
      code: "sacrum",
      name: { ar: "عظم العجز", en: "Sacrum", tr: "Sakrum" },
      meta: { paired: false },
    },
    { code: "pelvis", name: { ar: "الحوض", en: "Pelvis", tr: "Pelvis" }, meta: { paired: false } },
    {
      code: "hip",
      name: { ar: "مفصل الورك", en: "Hip joint", tr: "Kalça eklemi" },
      meta: { paired: true },
    },
    { code: "femur", name: { ar: "عظم الفخذ", en: "Femur", tr: "Femur" }, meta: { paired: true } },
    {
      code: "knee",
      name: { ar: "مفصل الركبة", en: "Knee joint", tr: "Diz eklemi" },
      meta: { paired: true },
    },
    { code: "tibia", name: { ar: "عظم القصبة", en: "Tibia", tr: "Tibia" }, meta: { paired: true } },
    {
      code: "fibula",
      name: { ar: "عظم الشظية", en: "Fibula", tr: "Fibula" },
      meta: { paired: true },
    },
    {
      code: "ankle",
      name: { ar: "مفصل الكاحل", en: "Ankle joint", tr: "Ayak bileği eklemi" },
      meta: { paired: true },
    },
    {
      code: "foot",
      name: { ar: "عظام القدم", en: "Foot bones", tr: "Ayak kemikleri" },
      meta: { paired: true },
    },
  ],

  [LOOKUP_LIST.DRUG_INSTRUCTION]: [
    { code: "after_meals", name: { ar: "بعد الأكل", en: "After meals", tr: "Yemeklerden sonra" } },
    { code: "before_meals", name: { ar: "قبل الأكل", en: "Before meals", tr: "Yemeklerden önce" } },
    {
      code: "empty_stomach",
      name: { ar: "على معدة فارغة", en: "On an empty stomach", tr: "Aç karnına" },
    },
    {
      code: "with_water",
      name: { ar: "مع كوب ماء كامل", en: "With a full glass of water", tr: "Bir bardak su ile" },
    },
    { code: "at_bedtime", name: { ar: "قبل النوم", en: "At bedtime", tr: "Yatmadan önce" } },
    { code: "when_needed", name: { ar: "عند اللزوم", en: "When needed", tr: "Gerektiğinde" } },
    {
      code: "finish_course",
      name: {
        ar: "أكمل العلاج حتى آخره",
        en: "Finish the whole course",
        tr: "Tedaviyi tamamlayın",
      },
    },
    onToothChart({
      code: "rinse_spit",
      name: {
        ar: "مضمضة ثم بصق دون بلع",
        en: "Rinse and spit, do not swallow",
        tr: "Çalkalayıp tükürün, yutmayın",
      },
    }),
    {
      code: "nothing_after",
      name: {
        ar: "لا أكل ولا شرب نصف ساعة بعده",
        en: "Nothing to eat or drink for half an hour after",
        tr: "Sonrasında yarım saat bir şey yiyip içmeyin",
      },
    },
  ],
};

export function systemChartBehaviour(code: string): ToothChartBehaviour | undefined {
  const row = SYSTEM_LOOKUPS[LOOKUP_LIST.TOOTH_STATE].find((entry) => entry.code === code);
  const behaviour = row?.meta?.["chartBehavior"];

  return behaviour as ToothChartBehaviour | undefined;
}

export function lookupChart(
  listKey: LookupListKey,
  code: string,
  isSystem: boolean,
): ChartType | undefined {
  const listChart = CHART_LOOKUP_LISTS[listKey];

  if (listChart !== undefined || !isSystem) {
    return listChart;
  }

  return SYSTEM_LOOKUPS[listKey].find((row) => row.code === code)?.chart;
}

export function offersLookup(
  chartTypes: readonly ChartType[],
  option: { readonly listKey: LookupListKey; readonly code: string; readonly isSystem: boolean },
): boolean {
  const chart = lookupChart(option.listKey, option.code, option.isSystem);

  return chart === undefined || chartTypes.includes(chart);
}
