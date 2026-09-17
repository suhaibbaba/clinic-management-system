import {
  BOOKING_CONFIRMATION_MODE,
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_CHANNEL,
  PROCEDURE_OUTCOME,
  USER_ROLE,
  type PersonName,
  type ProcedureOutcome,
  type WeeklySchedule,
} from "@clinic/shared";

import type { SeedAccount } from "@api/database/seed/users";

export const CLINIC_NAME: PersonName = {
  ar: "عيادة أبو عبيد لطب الأسنان",
  en: "Abu Obeid Dental Clinic",
};

export const CLINIC_SLUG = "abu-obeid";
export const CLINIC_TIME_ZONE = "Asia/Hebron";

export const CLINIC_HOURS: WeeklySchedule = [
  { weekday: 6, ranges: [{ start: "09:00", end: "14:00" }] },
  { weekday: 0, ranges: [{ start: "09:00", end: "17:00" }] },
  {
    weekday: 1,
    ranges: [
      { start: "09:00", end: "13:00" },
      { start: "16:00", end: "20:00" },
    ],
  },
  { weekday: 2, ranges: [{ start: "09:00", end: "17:00" }] },
  { weekday: 3, ranges: [{ start: "09:00", end: "17:00" }] },
  { weekday: 4, ranges: [{ start: "09:00", end: "15:00" }] },
];

const SENIOR_SCHEDULE: WeeklySchedule = [
  { weekday: 6, ranges: [{ start: "09:00", end: "14:00" }] },
  { weekday: 0, ranges: [{ start: "09:00", end: "17:00" }] },
  {
    weekday: 1,
    ranges: [
      { start: "09:00", end: "13:00" },
      { start: "16:00", end: "20:00" },
    ],
  },
  { weekday: 2, ranges: [{ start: "09:00", end: "17:00" }] },
  { weekday: 3, ranges: [{ start: "09:00", end: "13:00" }] },
];

const JUNIOR_SCHEDULE: WeeklySchedule = [
  { weekday: 0, ranges: [{ start: "10:00", end: "17:00" }] },
  { weekday: 1, ranges: [{ start: "10:00", end: "20:00" }] },
  { weekday: 2, ranges: [{ start: "10:00", end: "17:00" }] },
  { weekday: 3, ranges: [{ start: "10:00", end: "17:00" }] },
  { weekday: 4, ranges: [{ start: "10:00", end: "15:00" }] },
];

export const DOCTOR_SCHEDULES: readonly WeeklySchedule[] = [SENIOR_SCHEDULE, JUNIOR_SCHEDULE];

export const ACCOUNTS: readonly SeedAccount[] = [
  {
    role: USER_ROLE.ADMIN,
    name: { ar: "سائد أبو عبيد", en: "Saed Abu Obeid" },
    phone: "+970599000101",
    email: "admin@clinic.local",
  },
  {
    role: USER_ROLE.DOCTOR,
    name: { ar: "د. رشا أبو عبيد", en: "Dr. Rasha Abu Obeid" },
    phone: "+970599000102",
    email: "doctor@clinic.local",
  },
  {
    role: USER_ROLE.RECEPTIONIST,
    name: { ar: "دعاء حجاوي", en: "Duaa Hijjawi" },
    phone: "+970599000103",
    email: "reception@clinic.local",
  },
  {
    role: USER_ROLE.TECHNICIAN,
    name: { ar: "مؤيد كنعان", en: "Muayyad Kanaan" },
    phone: "+970599000104",
    email: "technician@clinic.local",
  },
  {
    role: USER_ROLE.DOCTOR,
    name: { ar: "د. باسل طوقان", en: "Dr. Basel Touqan" },
    phone: "+970599000105",
    email: "doctor2@clinic.local",
  },
];

export const CLINIC_DEFAULTS = {
  phone: "+97092345600",
  email: "info@abuobeid.ps",
  address: "نابلس، رفيديا، شارع تونس، عمارة الرؤية، الطابق الثاني",
  currency: "ILS",
  workingHours: CLINIC_HOURS,
  settings: {
    timezone: CLINIC_TIME_ZONE,
    booking: {
      enabled: true,
      maxDaysAhead: 30,
      minHoursBefore: 2,
      confirmationMode: BOOKING_CONFIRMATION_MODE.OTP,
      holdMinutes: 15,
      maxActivePerPhone: 3,
    },
    notifications: {
      enabled: true,
      channel: NOTIFICATION_CHANNEL.SMS,
      remind24h: true,
      remind2h: true,
      templates: { ...DEFAULT_NOTIFICATION_TEMPLATES },
    },
  },
};

export interface CatalogEntry {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly defaultPrice: string;
  readonly chartOutcome: ProcedureOutcome | null;
  /** Minutes of chair time, which is what the appointment beside it is booked for. */
  readonly minutes: number;
  /** Roughly how often it comes up, used to weight the generated history. */
  readonly weight: number;
  readonly needsLab?: boolean;
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    code: "EXAM",
    nameAr: "كشف وفحص",
    nameEn: "Examination",
    defaultPrice: "50.00",
    chartOutcome: null,
    minutes: 20,
    weight: 20,
  },
  {
    code: "CLEAN",
    nameAr: "تنظيف وتقليح",
    nameEn: "Scaling & polishing",
    defaultPrice: "150.00",
    chartOutcome: null,
    minutes: 30,
    weight: 14,
  },
  {
    code: "FILL-C",
    nameAr: "حشوة تجميلية",
    nameEn: "Composite filling",
    defaultPrice: "200.00",
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
    minutes: 40,
    weight: 18,
  },
  {
    code: "FILL-A",
    nameAr: "حشوة أملغم",
    nameEn: "Amalgam filling",
    defaultPrice: "150.00",
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
    minutes: 40,
    weight: 6,
  },
  {
    code: "RCT",
    nameAr: "معالجة عصب",
    nameEn: "Root canal treatment",
    defaultPrice: "600.00",
    chartOutcome: PROCEDURE_OUTCOME.ROOT_CANAL,
    minutes: 60,
    weight: 9,
  },
  {
    code: "CROWN-Z",
    nameAr: "تاج زيركون",
    nameEn: "Zirconia crown",
    defaultPrice: "900.00",
    chartOutcome: PROCEDURE_OUTCOME.CROWN,
    minutes: 45,
    weight: 6,
    needsLab: true,
  },
  {
    code: "CROWN-P",
    nameAr: "تاج خزف على معدن",
    nameEn: "PFM crown",
    defaultPrice: "650.00",
    chartOutcome: PROCEDURE_OUTCOME.CROWN,
    minutes: 45,
    weight: 3,
    needsLab: true,
  },
  {
    code: "BRIDGE-3",
    nameAr: "جسر ثلاثي",
    nameEn: "Three-unit bridge",
    defaultPrice: "2200.00",
    chartOutcome: PROCEDURE_OUTCOME.BRIDGE,
    minutes: 60,
    weight: 2,
    needsLab: true,
  },
  {
    code: "IMPL",
    nameAr: "زرعة سنية",
    nameEn: "Dental implant",
    defaultPrice: "2800.00",
    chartOutcome: PROCEDURE_OUTCOME.IMPLANT,
    minutes: 90,
    weight: 2,
    needsLab: true,
  },
  {
    code: "EXT",
    nameAr: "قلع بسيط",
    nameEn: "Simple extraction",
    defaultPrice: "150.00",
    chartOutcome: PROCEDURE_OUTCOME.MISSING,
    minutes: 30,
    weight: 10,
  },
  {
    code: "EXT-S",
    nameAr: "قلع جراحي",
    nameEn: "Surgical extraction",
    defaultPrice: "400.00",
    chartOutcome: PROCEDURE_OUTCOME.MISSING,
    minutes: 45,
    weight: 4,
  },
  {
    code: "ORTHO",
    nameAr: "تقويم أسنان",
    nameEn: "Orthodontic treatment",
    defaultPrice: "4500.00",
    chartOutcome: null,
    minutes: 45,
    weight: 3,
    needsLab: true,
  },
  {
    code: "XRAY-P",
    nameAr: "صورة بانوراما",
    nameEn: "Panoramic X-ray",
    defaultPrice: "80.00",
    chartOutcome: null,
    minutes: 15,
    weight: 8,
  },
  {
    code: "WHITEN",
    nameAr: "تبييض أسنان",
    nameEn: "Teeth whitening",
    defaultPrice: "700.00",
    chartOutcome: null,
    minutes: 60,
    weight: 3,
  },
];

export const COMPLAINTS: readonly string[] = [
  "ألم في الضرس السفلي الأيمن",
  "حساسية من البارد والساخن",
  "كسر في حشوة قديمة",
  "نزيف في اللثة عند التفريش",
  "ألم عند المضغ",
  "تورم في اللثة",
  "فحص دوري",
  "رائحة فم كريهة",
  "سن مخلوع جزئياً",
  "ألم بعد معالجة سابقة",
];

export const DIAGNOSES: readonly string[] = [
  "نخر عميق في السن",
  "التهاب لثة مزمن",
  "التهاب لب سني لا رجعي",
  "خراج حول ذروي",
  "تسوس سطحي",
  "انحسار لثوي",
  "كسر في الحافة القاطعة",
  "التهاب حوائط السن",
  "تراكم جير",
  "سن مطمور",
];

export const EXAMINATIONS: readonly string[] = [
  "الفحص السريري يظهر نخراً واضحاً على السطح الإطباقي",
  "اللثة محتقنة ونازفة عند السبر",
  "اختبار الحيوية سلبي",
  "إيلام بالقرع العمودي",
  "تراكم قلح على الأسطح اللسانية السفلية",
  "الفحص الشعاعي يظهر ظلاً حول ذروياً",
];
