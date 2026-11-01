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
  name: { ar: name, en: name },
  meta: { ...regimen, ...(note && { note }) },
});

export const ORTHOPEDIC_PACK: SpecialtyPack = {
  procedures: [
    { code: "ORTHO-CONSULT", name: "Orthopedic consultation" },
    { code: "ORTHO-FOLLOW", name: "Follow-up visit" },
    { code: "ORTHO-EMERG", name: "Emergency orthopedic visit" },
    { code: "CAST-UL", name: "Cast application, upper limb" },
    { code: "CAST-LL", name: "Cast application, lower limb" },
    { code: "CAST-OFF", name: "Cast removal" },
    { code: "CAST-CHANGE", name: "Cast change" },
    { code: "BACKSLAB", name: "Back slab application" },
    { code: "SPICA", name: "Spica cast application" },
    { code: "PONSETI", name: "Clubfoot serial casting (Ponseti)" },
    { code: "SPLINT", name: "Splint application" },
    { code: "BRACE-FIT", name: "Brace fitting" },
    { code: "STRAPPING", name: "Strapping and taping" },
    { code: "CLOSED-RED", name: "Closed reduction" },
    { code: "DISLOC-RED", name: "Joint dislocation reduction" },
    { code: "JOINT-ASP", name: "Joint aspiration" },
    { code: "INJ-STEROID", name: "Intra-articular steroid injection" },
    { code: "INJ-HA", name: "Hyaluronic acid injection" },
    { code: "INJ-PRP", name: "PRP injection" },
    { code: "INJ-TRIGGER", name: "Trigger point injection" },
    { code: "INJ-TENDON", name: "Tendon sheath injection" },
    { code: "INJ-NERVE", name: "Nerve block injection" },
    { code: "INJ-EPIDURAL", name: "Epidural steroid injection" },
    { code: "DRESSING", name: "Wound dressing" },
    { code: "SUTURE", name: "Wound suturing" },
    { code: "DEBRIDE", name: "Wound debridement" },
    { code: "I-AND-D", name: "Incision and drainage" },
    { code: "PIN-CARE", name: "Pin site care" },
    { code: "SUTURE-OFF", name: "Suture removal" },
    { code: "KWIRE-OFF", name: "K-wire removal" },
    { code: "ORIF", name: "Open reduction and internal fixation (ORIF)" },
    { code: "KWIRE-FIX", name: "Percutaneous K-wire fixation" },
    { code: "IM-NAIL", name: "Intramedullary nailing" },
    { code: "DHS", name: "Dynamic hip screw fixation" },
    { code: "EX-FIX", name: "External fixator application" },
    { code: "ARTHRO-KNEE", name: "Knee arthroscopy" },
    { code: "MENISCUS", name: "Meniscus repair" },
    { code: "ACL", name: "ACL reconstruction" },
    { code: "ARTHRO-SHLDR", name: "Shoulder arthroscopy" },
    { code: "ROTATOR-CUFF", name: "Rotator cuff repair" },
    { code: "TKR", name: "Total knee replacement" },
    { code: "THR", name: "Total hip replacement" },
    { code: "HEMI-HIP", name: "Hip hemiarthroplasty" },
    { code: "CTR", name: "Carpal tunnel release" },
    { code: "TRIGGER-REL", name: "Trigger finger release" },
    { code: "DEQUERVAIN", name: "De Quervain release" },
    { code: "GANGLION", name: "Ganglion cyst excision" },
    { code: "TENDON-REP", name: "Tendon repair" },
    { code: "ACHILLES", name: "Achilles tendon repair" },
    { code: "HALLUX", name: "Hallux valgus correction" },
    { code: "DISCECTOMY", name: "Lumbar discectomy" },
    { code: "HW-REMOVAL", name: "Hardware removal" },
  ],

  lookups: {
    [LOOKUP_LIST.APPOINTMENT_TYPE]: [
      { code: "cast_check", name: { ar: "فحص الجبس", en: "Cast check" } },
      { code: "cast_removal", name: { ar: "فك الجبس", en: "Cast removal" } },
      { code: "post_op", name: { ar: "مراجعة بعد العملية", en: "Post-operative review" } },
      { code: "injection", name: { ar: "حقنة مفصل", en: "Joint injection" } },
    ],

    [LOOKUP_LIST.ATTACHMENT_TYPE]: [
      { code: "xray", name: { ar: "صورة أشعة X-ray", en: "X-ray" } },
      { code: "mri", name: { ar: "رنين مغناطيسي MRI", en: "MRI" } },
      { code: "ct", name: { ar: "تصوير طبقي CT", en: "CT scan" } },
      { code: "dexa", name: { ar: "فحص كثافة العظام DEXA", en: "DEXA scan" } },
      { code: "ultrasound", name: { ar: "ألتراساوند", en: "Ultrasound" } },
      { code: "operative_report", name: { ar: "تقرير عملية", en: "Operative report" } },
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
        name: { ar: "يدهن موضعياً على مكان الألم", en: "Apply to the painful area" },
      },
      {
        code: "once_weekly_upright",
        name: {
          ar: "مرة في الأسبوع على معدة فارغة، والبقاء واقفاً نصف ساعة",
          en: "Once a week on an empty stomach, stay upright for half an hour",
        },
      },
      {
        code: "ice_after",
        name: { ar: "كمادات ثلج بعد الحقنة", en: "Ice packs after the injection" },
      },
    ],

    [LOOKUP_LIST.ITEM_CATEGORY]: [
      { code: "casting", name: { ar: "Casting materials", en: "Casting materials" } },
      { code: "orthoses", name: { ar: "Splints and braces", en: "Splints and braces" } },
      { code: "injectables", name: { ar: "Injectables", en: "Injectables" } },
    ],
  },
};
