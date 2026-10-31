import { LOOKUP_LIST } from "@clinic/shared";
import type { SpecialtyPack } from "@api/database/specialty-packs/specialty-pack";

const drug = (
  name: string,
  regimen: { perDose?: number; timesPerDay?: number; days: number },
  note?: string,
) => ({
  code: name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48),
  nameAr: name,
  nameEn: name,
  meta: { ...regimen, ...(note && { note }) },
});

export const ORTHOPEDIC_PACK: SpecialtyPack = {
  procedures: [
    { code: "ORTHO-CONSULT", name: "Orthopedic consultation" },
    { code: "ORTHO-FOLLOW", name: "Follow-up visit" },
    { code: "CAST-UL", name: "Cast application, upper limb" },
    { code: "CAST-LL", name: "Cast application, lower limb" },
    { code: "CAST-OFF", name: "Cast removal" },
    { code: "SPLINT", name: "Splint application" },
    { code: "CLOSED-RED", name: "Closed reduction" },
    { code: "JOINT-ASP", name: "Joint aspiration" },
    { code: "INJ-STEROID", name: "Intra-articular steroid injection" },
    { code: "INJ-HA", name: "Hyaluronic acid injection" },
    { code: "INJ-PRP", name: "PRP injection" },
    { code: "INJ-TRIGGER", name: "Trigger point injection" },
    { code: "DRESSING", name: "Wound dressing" },
    { code: "SUTURE-OFF", name: "Suture removal" },
    { code: "KWIRE-OFF", name: "K-wire removal" },
    { code: "ORIF", name: "Open reduction and internal fixation (ORIF)" },
    { code: "ARTHRO-KNEE", name: "Knee arthroscopy" },
    { code: "TKR", name: "Total knee replacement" },
    { code: "THR", name: "Total hip replacement" },
    { code: "CTR", name: "Carpal tunnel release" },
    { code: "TRIGGER-REL", name: "Trigger finger release" },
    { code: "HW-REMOVAL", name: "Hardware removal" },
  ],

  lookups: {
    [LOOKUP_LIST.APPOINTMENT_TYPE]: [
      { code: "cast_check", nameAr: "فحص الجبس", nameEn: "Cast check" },
      { code: "cast_removal", nameAr: "فك الجبس", nameEn: "Cast removal" },
      { code: "post_op", nameAr: "مراجعة بعد العملية", nameEn: "Post-operative review" },
      { code: "injection", nameAr: "حقنة مفصل", nameEn: "Joint injection" },
    ],

    [LOOKUP_LIST.ATTACHMENT_TYPE]: [
      { code: "xray", nameAr: "صورة أشعة X-ray", nameEn: "X-ray" },
      { code: "mri", nameAr: "رنين مغناطيسي MRI", nameEn: "MRI" },
      { code: "ct", nameAr: "تصوير طبقي CT", nameEn: "CT scan" },
      { code: "dexa", nameAr: "فحص كثافة العظام DEXA", nameEn: "DEXA scan" },
      { code: "ultrasound", nameAr: "ألتراساوند", nameEn: "Ultrasound" },
      { code: "operative_report", nameAr: "تقرير عملية", nameEn: "Operative report" },
    ],

    [LOOKUP_LIST.FREQUENT_DRUG]: [
      drug("Paracetamol 500 mg", { perDose: 2, timesPerDay: 3, days: 5 }),
      drug("Ibuprofen 400 mg", { perDose: 1, timesPerDay: 3, days: 5 }, "بعد الأكل"),
      drug("Diclofenac sodium 50 mg", { perDose: 1, timesPerDay: 2, days: 5 }, "بعد الأكل"),
      drug("Naproxen 500 mg", { perDose: 1, timesPerDay: 2, days: 7 }, "بعد الأكل"),
      drug("Celecoxib 200 mg", { perDose: 1, timesPerDay: 1, days: 10 }),
      drug("Etoricoxib 90 mg", { perDose: 1, timesPerDay: 1, days: 7 }),
      drug("Meloxicam 15 mg", { perDose: 1, timesPerDay: 1, days: 10 }, "بعد الأكل"),
      drug("Tramadol 50 mg", { perDose: 1, timesPerDay: 2, days: 3 }, "عند اللزوم للألم الشديد"),
      drug("Orphenadrine 35 mg + Paracetamol 450 mg", { perDose: 1, timesPerDay: 3, days: 5 }),
      drug("Thiocolchicoside 4 mg", { perDose: 1, timesPerDay: 2, days: 5 }),
      drug("Methocarbamol 750 mg", { perDose: 1, timesPerDay: 3, days: 5 }),
      drug("Pregabalin 75 mg", { perDose: 1, timesPerDay: 2, days: 30 }),
      drug("Gabapentin 300 mg", { perDose: 1, timesPerDay: 3, days: 30 }),
      drug("Calcium 600 mg + Vitamin D3", { perDose: 1, timesPerDay: 2, days: 90 }),
      drug("Vitamin D3 50,000 IU", { perDose: 1, days: 56 }, "مرة واحدة في الأسبوع"),
      drug(
        "Alendronate 70 mg",
        { perDose: 1, days: 84 },
        "مرة في الأسبوع على معدة فارغة مع كوب ماء، والبقاء واقفاً نصف ساعة",
      ),
      drug("Glucosamine + Chondroitin", { perDose: 1, timesPerDay: 2, days: 90 }),
      drug(
        "Omeprazole 20 mg",
        { perDose: 1, timesPerDay: 1, days: 10 },
        "قبل الفطور، لحماية المعدة مع المسكنات",
      ),
      drug(
        "Enoxaparin 40 mg",
        { perDose: 1, timesPerDay: 1, days: 14 },
        "حقنة تحت الجلد للوقاية من الجلطات",
      ),
      drug("Cefuroxime 500 mg", { perDose: 1, timesPerDay: 2, days: 7 }),
      drug("Diclofenac gel 1%", { timesPerDay: 3, days: 10 }, "يدهن موضعياً على مكان الألم"),
    ],

    [LOOKUP_LIST.DRUG_INSTRUCTION]: [
      {
        code: "apply_locally",
        nameAr: "يدهن موضعياً على مكان الألم",
        nameEn: "Apply to the painful area",
      },
      {
        code: "once_weekly_upright",
        nameAr: "مرة في الأسبوع على معدة فارغة، والبقاء واقفاً نصف ساعة",
        nameEn: "Once a week on an empty stomach, stay upright for half an hour",
      },
      {
        code: "ice_after",
        nameAr: "كمادات ثلج بعد الحقنة",
        nameEn: "Ice packs after the injection",
      },
    ],

    [LOOKUP_LIST.ITEM_CATEGORY]: [
      { code: "casting", nameAr: "Casting materials", nameEn: "Casting materials" },
      { code: "orthoses", nameAr: "Splints and braces", nameEn: "Splints and braces" },
      { code: "injectables", nameAr: "Injectables", nameEn: "Injectables" },
    ],
  },
};
