import { LOOKUP_LIST } from "@clinic/shared";
import type { SpecialtyPack } from "@api/database/specialty-packs/specialty-pack";

const drug = (
  name: string,
  turkish: string,
  regimen: { perDose?: number; timesPerDay?: number; days: number },
  note?: string,
) => ({
  code: name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48),
  name: { ar: name, en: name, tr: turkish },
  meta: { ...regimen, ...(note && { note }) },
});

export const ORTHOPEDIC_PACK: SpecialtyPack = {
  procedures: [
    { code: "ORTHO-CONSULT", name: { en: "Orthopedic consultation", tr: "Ortopedi muayenesi" } },
    { code: "ORTHO-FOLLOW", name: { en: "Follow-up visit", tr: "Kontrol muayenesi" } },
    {
      code: "ORTHO-EMERG",
      name: { en: "Emergency orthopedic visit", tr: "Acil ortopedi muayenesi" },
    },
    {
      code: "CAST-UL",
      name: { en: "Cast application, upper limb", tr: "Alçı uygulaması, üst ekstremite" },
    },
    {
      code: "CAST-LL",
      name: { en: "Cast application, lower limb", tr: "Alçı uygulaması, alt ekstremite" },
    },
    { code: "CAST-OFF", name: { en: "Cast removal", tr: "Alçı çıkarma" } },
    { code: "CAST-CHANGE", name: { en: "Cast change", tr: "Alçı değişimi" } },
    {
      code: "BACKSLAB",
      name: { en: "Back slab application", tr: "Arka atel (yarım alçı) uygulaması" },
    },
    { code: "SPICA", name: { en: "Spica cast application", tr: "Spika alçı uygulaması" } },
    {
      code: "PONSETI",
      name: {
        en: "Clubfoot serial casting (Ponseti)",
        tr: "Pes ekinovarus seri alçılama (Ponseti)",
      },
    },
    { code: "SPLINT", name: { en: "Splint application", tr: "Atel uygulaması" } },
    { code: "BRACE-FIT", name: { en: "Brace fitting", tr: "Ortez uygulaması" } },
    { code: "STRAPPING", name: { en: "Strapping and taping", tr: "Bandajlama ve bantlama" } },
    { code: "CLOSED-RED", name: { en: "Closed reduction", tr: "Kapalı redüksiyon" } },
    {
      code: "DISLOC-RED",
      name: { en: "Joint dislocation reduction", tr: "Eklem çıkığı redüksiyonu" },
    },
    { code: "JOINT-ASP", name: { en: "Joint aspiration", tr: "Eklem aspirasyonu" } },
    {
      code: "INJ-STEROID",
      name: { en: "Intra-articular steroid injection", tr: "Eklem içi steroid enjeksiyonu" },
    },
    {
      code: "INJ-HA",
      name: { en: "Hyaluronic acid injection", tr: "Hyaluronik asit enjeksiyonu" },
    },
    { code: "INJ-PRP", name: { en: "PRP injection", tr: "PRP enjeksiyonu" } },
    { code: "INJ-TRIGGER", name: { en: "Trigger point injection", tr: "Tetik nokta enjeksiyonu" } },
    {
      code: "INJ-TENDON",
      name: { en: "Tendon sheath injection", tr: "Tendon kılıfı enjeksiyonu" },
    },
    { code: "INJ-NERVE", name: { en: "Nerve block injection", tr: "Sinir bloğu enjeksiyonu" } },
    {
      code: "INJ-EPIDURAL",
      name: { en: "Epidural steroid injection", tr: "Epidural steroid enjeksiyonu" },
    },
    { code: "DRESSING", name: { en: "Wound dressing", tr: "Yara pansumanı" } },
    { code: "SUTURE", name: { en: "Wound suturing", tr: "Yara dikişi" } },
    { code: "DEBRIDE", name: { en: "Wound debridement", tr: "Yara debridmanı" } },
    { code: "I-AND-D", name: { en: "Incision and drainage", tr: "İnsizyon ve drenaj" } },
    { code: "PIN-CARE", name: { en: "Pin site care", tr: "Pin yeri bakımı" } },
    { code: "SUTURE-OFF", name: { en: "Suture removal", tr: "Dikiş alma" } },
    { code: "KWIRE-OFF", name: { en: "K-wire removal", tr: "K-teli çıkarma" } },
    {
      code: "ORIF",
      name: {
        en: "Open reduction and internal fixation (ORIF)",
        tr: "Açık redüksiyon ve iç tespit (ORIF)",
      },
    },
    {
      code: "KWIRE-FIX",
      name: { en: "Percutaneous K-wire fixation", tr: "Perkütan K-teli ile tespit" },
    },
    { code: "IM-NAIL", name: { en: "Intramedullary nailing", tr: "İntramedüller çivileme" } },
    {
      code: "DHS",
      name: { en: "Dynamic hip screw fixation", tr: "Dinamik kalça vidası ile tespit" },
    },
    {
      code: "EX-FIX",
      name: { en: "External fixator application", tr: "Eksternal fiksatör uygulaması" },
    },
    { code: "ARTHRO-KNEE", name: { en: "Knee arthroscopy", tr: "Diz artroskopisi" } },
    { code: "MENISCUS", name: { en: "Meniscus repair", tr: "Menisküs tamiri" } },
    { code: "ACL", name: { en: "ACL reconstruction", tr: "Ön çapraz bağ (ÖÇB) rekonstrüksiyonu" } },
    { code: "ARTHRO-SHLDR", name: { en: "Shoulder arthroscopy", tr: "Omuz artroskopisi" } },
    { code: "ROTATOR-CUFF", name: { en: "Rotator cuff repair", tr: "Rotator manşet tamiri" } },
    { code: "TKR", name: { en: "Total knee replacement", tr: "Total diz protezi" } },
    { code: "THR", name: { en: "Total hip replacement", tr: "Total kalça protezi" } },
    { code: "HEMI-HIP", name: { en: "Hip hemiarthroplasty", tr: "Kalça hemiartroplastisi" } },
    { code: "CTR", name: { en: "Carpal tunnel release", tr: "Karpal tünel gevşetme" } },
    { code: "TRIGGER-REL", name: { en: "Trigger finger release", tr: "Tetik parmak gevşetme" } },
    { code: "DEQUERVAIN", name: { en: "De Quervain release", tr: "De Quervain gevşetme" } },
    { code: "GANGLION", name: { en: "Ganglion cyst excision", tr: "Ganglion kisti eksizyonu" } },
    { code: "TENDON-REP", name: { en: "Tendon repair", tr: "Tendon tamiri" } },
    { code: "ACHILLES", name: { en: "Achilles tendon repair", tr: "Aşil tendonu tamiri" } },
    { code: "HALLUX", name: { en: "Hallux valgus correction", tr: "Halluks valgus düzeltme" } },
    { code: "DISCECTOMY", name: { en: "Lumbar discectomy", tr: "Lomber diskektomi" } },
    { code: "HW-REMOVAL", name: { en: "Hardware removal", tr: "İmplant çıkarma" } },
  ],

  lookups: {
    [LOOKUP_LIST.APPOINTMENT_TYPE]: [
      { code: "cast_check", name: { ar: "فحص الجبس", en: "Cast check", tr: "Alçı kontrolü" } },
      { code: "cast_removal", name: { ar: "فك الجبس", en: "Cast removal", tr: "Alçı çıkarma" } },
      {
        code: "post_op",
        name: {
          ar: "مراجعة بعد العملية",
          en: "Post-operative review",
          tr: "Ameliyat sonrası kontrol",
        },
      },
      {
        code: "injection",
        name: { ar: "حقنة مفصل", en: "Joint injection", tr: "Eklem enjeksiyonu" },
      },
    ],

    [LOOKUP_LIST.ATTACHMENT_TYPE]: [
      { code: "xray", name: { ar: "صورة أشعة X-ray", en: "X-ray", tr: "Röntgen" } },
      { code: "mri", name: { ar: "رنين مغناطيسي MRI", en: "MRI", tr: "MR" } },
      { code: "ct", name: { ar: "تصوير طبقي CT", en: "CT scan", tr: "BT taraması" } },
      { code: "dexa", name: { ar: "فحص كثافة العظام DEXA", en: "DEXA scan", tr: "DEXA taraması" } },
      { code: "ultrasound", name: { ar: "ألتراساوند", en: "Ultrasound", tr: "Ultrason" } },
      {
        code: "operative_report",
        name: { ar: "تقرير عملية", en: "Operative report", tr: "Ameliyat raporu" },
      },
    ],

    [LOOKUP_LIST.FREQUENT_DRUG]: [
      drug("Paracetamol 500 mg", "Parasetamol 500 mg", { perDose: 2, timesPerDay: 3, days: 5 }),
      drug(
        "Ibuprofen 400 mg",
        "İbuprofen 400 mg",
        { perDose: 1, timesPerDay: 3, days: 5 },
        "بعد الأكل",
      ),
      drug(
        "Diclofenac sodium 50 mg",
        "Diklofenak sodyum 50 mg",
        { perDose: 1, timesPerDay: 2, days: 5 },
        "بعد الأكل",
      ),
      drug(
        "Naproxen 500 mg",
        "Naproksen 500 mg",
        { perDose: 1, timesPerDay: 2, days: 7 },
        "بعد الأكل",
      ),
      drug("Celecoxib 200 mg", "Selekoksib 200 mg", { perDose: 1, timesPerDay: 1, days: 10 }),
      drug("Etoricoxib 90 mg", "Etorikoksib 90 mg", { perDose: 1, timesPerDay: 1, days: 7 }),
      drug(
        "Meloxicam 15 mg",
        "Meloksikam 15 mg",
        { perDose: 1, timesPerDay: 1, days: 10 },
        "بعد الأكل",
      ),
      drug(
        "Tramadol 50 mg",
        "Tramadol 50 mg",
        { perDose: 1, timesPerDay: 2, days: 3 },
        "عند اللزوم للألم الشديد",
      ),
      drug("Orphenadrine 35 mg + Paracetamol 450 mg", "Orfenadrin 35 mg + Parasetamol 450 mg", {
        perDose: 1,
        timesPerDay: 3,
        days: 5,
      }),
      drug("Thiocolchicoside 4 mg", "Tiyokolşikosid 4 mg", { perDose: 1, timesPerDay: 2, days: 5 }),
      drug("Methocarbamol 750 mg", "Metokarbamol 750 mg", { perDose: 1, timesPerDay: 3, days: 5 }),
      drug("Pregabalin 75 mg", "Pregabalin 75 mg", { perDose: 1, timesPerDay: 2, days: 30 }),
      drug("Gabapentin 300 mg", "Gabapentin 300 mg", { perDose: 1, timesPerDay: 3, days: 30 }),
      drug("Calcium 600 mg + Vitamin D3", "Kalsiyum 600 mg + D3 vitamini", {
        perDose: 1,
        timesPerDay: 2,
        days: 90,
      }),
      drug(
        "Vitamin D3 50,000 IU",
        "D3 vitamini 50.000 IU",
        { perDose: 1, days: 56 },
        "مرة واحدة في الأسبوع",
      ),
      drug(
        "Alendronate 70 mg",
        "Alendronat 70 mg",
        { perDose: 1, days: 84 },
        "مرة في الأسبوع على معدة فارغة مع كوب ماء، والبقاء واقفاً نصف ساعة",
      ),
      drug("Glucosamine + Chondroitin", "Glukozamin + Kondroitin", {
        perDose: 1,
        timesPerDay: 2,
        days: 90,
      }),
      drug(
        "Omeprazole 20 mg",
        "Omeprazol 20 mg",
        { perDose: 1, timesPerDay: 1, days: 10 },
        "قبل الفطور، لحماية المعدة مع المسكنات",
      ),
      drug(
        "Enoxaparin 40 mg",
        "Enoksaparin 40 mg",
        { perDose: 1, timesPerDay: 1, days: 14 },
        "حقنة تحت الجلد للوقاية من الجلطات",
      ),
      drug("Cefuroxime 500 mg", "Sefuroksim 500 mg", { perDose: 1, timesPerDay: 2, days: 7 }),
      drug(
        "Diclofenac gel 1%",
        "Diklofenak jel %1",
        { timesPerDay: 3, days: 10 },
        "يدهن موضعياً على مكان الألم",
      ),
    ],

    [LOOKUP_LIST.DRUG_INSTRUCTION]: [
      {
        code: "apply_locally",
        name: {
          ar: "يدهن موضعياً على مكان الألم",
          en: "Apply to the painful area",
          tr: "Ağrılı bölgeye sürülür",
        },
      },
      {
        code: "once_weekly_upright",
        name: {
          ar: "مرة في الأسبوع على معدة فارغة، والبقاء واقفاً نصف ساعة",
          en: "Once a week on an empty stomach, stay upright for half an hour",
          tr: "Haftada bir kez aç karnına, ardından yarım saat dik durulur",
        },
      },
      {
        code: "ice_after",
        name: {
          ar: "كمادات ثلج بعد الحقنة",
          en: "Ice packs after the injection",
          tr: "Enjeksiyondan sonra buz uygulaması",
        },
      },
    ],

    [LOOKUP_LIST.ITEM_CATEGORY]: [
      {
        code: "casting",
        name: { ar: "Casting materials", en: "Casting materials", tr: "Alçı malzemeleri" },
      },
      {
        code: "orthoses",
        name: { ar: "Splints and braces", en: "Splints and braces", tr: "Ateller ve ortezler" },
      },
      {
        code: "injectables",
        name: { ar: "Injectables", en: "Injectables", tr: "Enjeksiyonluk ürünler" },
      },
    ],
  },
};
