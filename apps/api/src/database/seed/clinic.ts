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
    firstName: { ar: "سائد", en: "Saed" },
    lastName: { ar: "أبو عبيد", en: "Abu Obeid" },
    phone: "+970599000101",
    email: "admin@clinic.local",
  },
  {
    role: USER_ROLE.DOCTOR,
    firstName: { ar: "رشا", en: "Rasha" },
    lastName: { ar: "أبو عبيد", en: "Abu Obeid" },
    phone: "+970599000102",
    email: "doctor@clinic.local",
  },
  {
    role: USER_ROLE.RECEPTIONIST,
    firstName: { ar: "دعاء", en: "Duaa" },
    lastName: { ar: "حجاوي", en: "Hijjawi" },
    phone: "+970599000103",
    email: "reception@clinic.local",
  },
  {
    role: USER_ROLE.TECHNICIAN,
    firstName: { ar: "مؤيد", en: "Muayyad" },
    lastName: { ar: "كنعان", en: "Kanaan" },
    phone: "+970599000104",
    email: "technician@clinic.local",
  },
  {
    role: USER_ROLE.DOCTOR,
    firstName: { ar: "باسل", en: "Basel" },
    lastName: { ar: "طوقان", en: "Touqan" },
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
  readonly name: string;
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
    name: "Examination",
    defaultPrice: "50.00",
    chartOutcome: null,
    minutes: 20,
    weight: 20,
  },
  {
    code: "CLEAN",
    name: "Scaling & polishing",
    defaultPrice: "150.00",
    chartOutcome: null,
    minutes: 30,
    weight: 14,
  },
  {
    code: "FILL-C",
    name: "Composite filling",
    defaultPrice: "200.00",
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
    minutes: 40,
    weight: 18,
  },
  {
    code: "FILL-A",
    name: "Amalgam filling",
    defaultPrice: "150.00",
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
    minutes: 40,
    weight: 6,
  },
  {
    code: "RCT",
    name: "Root canal treatment",
    defaultPrice: "600.00",
    chartOutcome: PROCEDURE_OUTCOME.ROOT_CANAL,
    minutes: 60,
    weight: 9,
  },
  {
    code: "CROWN-Z",
    name: "Zirconia crown",
    defaultPrice: "900.00",
    chartOutcome: PROCEDURE_OUTCOME.CROWN,
    minutes: 45,
    weight: 6,
    needsLab: true,
  },
  {
    code: "CROWN-P",
    name: "PFM crown",
    defaultPrice: "650.00",
    chartOutcome: PROCEDURE_OUTCOME.CROWN,
    minutes: 45,
    weight: 3,
    needsLab: true,
  },
  {
    code: "BRIDGE-3",
    name: "Three-unit bridge",
    defaultPrice: "2200.00",
    chartOutcome: PROCEDURE_OUTCOME.BRIDGE,
    minutes: 60,
    weight: 2,
    needsLab: true,
  },
  {
    code: "IMPL",
    name: "Dental implant",
    defaultPrice: "2800.00",
    chartOutcome: PROCEDURE_OUTCOME.IMPLANT,
    minutes: 90,
    weight: 2,
    needsLab: true,
  },
  {
    code: "EXT",
    name: "Simple extraction",
    defaultPrice: "150.00",
    chartOutcome: PROCEDURE_OUTCOME.MISSING,
    minutes: 30,
    weight: 10,
  },
  {
    code: "EXT-S",
    name: "Surgical extraction",
    defaultPrice: "400.00",
    chartOutcome: PROCEDURE_OUTCOME.MISSING,
    minutes: 45,
    weight: 4,
  },
  {
    code: "ORTHO",
    name: "Orthodontic treatment",
    defaultPrice: "4500.00",
    chartOutcome: null,
    minutes: 45,
    weight: 3,
    needsLab: true,
  },
  {
    code: "XRAY-P",
    name: "Panoramic X-ray",
    defaultPrice: "80.00",
    chartOutcome: null,
    minutes: 15,
    weight: 8,
  },
  {
    code: "WHITEN",
    name: "Teeth whitening",
    defaultPrice: "700.00",
    chartOutcome: null,
    minutes: 60,
    weight: 3,
  },
];

export const COMPLAINTS: readonly string[] = [
  "Pain in the lower right molar",
  "Sensitivity to hot and cold",
  "Broken old filling",
  "Gums bleed when brushing",
  "Pain on chewing",
  "Swollen gums",
  "Routine check-up",
  "Bad breath",
  "Partially erupted tooth",
  "Pain after previous treatment",
];

export const DIAGNOSES: readonly string[] = [
  "Deep caries",
  "Chronic gingivitis",
  "Irreversible pulpitis",
  "Periapical abscess",
  "Superficial caries",
  "Gingival recession",
  "Incisal edge fracture",
  "Periodontitis",
  "Calculus build-up",
  "Impacted tooth",
];

export const EXAMINATIONS: readonly string[] = [
  "Clinical exam shows obvious caries on the occlusal surface",
  "Gums inflamed and bleeding on probing",
  "Negative vitality test",
  "Tender to vertical percussion",
  "Calculus on the lower lingual surfaces",
  "Radiograph shows a periapical radiolucency",
];
