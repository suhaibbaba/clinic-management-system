import type {
  PortalAccount,
  PortalAppointment,
  PortalPrescription,
  PortalTreatment,
  SiteLanguage,
} from "@clinic/shared";
import { APPOINTMENT_STATUS } from "@shared/enums";
import { currencySymbol, formatWholeMoney, subtractMoney } from "@shared/schemas/money";
import { PORTAL_PAGE_TAIL, PORTAL_TABS } from "@web/site/constants";
import type { Translate } from "@web/site/i18n";

export type PortalTab = (typeof PORTAL_TABS)[number];

const LOCALES: Record<SiteLanguage, string> = { ar: "ar-u-nu-latn", en: "en-GB" };

const stripBidiMarks = (text: string): string => text.replaceAll(/[‎‏؜]/g, "");

export function portalDate(iso: string, timeZone: string): string {
  const { day, month, year } = portalDateParts(iso, timeZone);

  return `${day}/${month}/${year}`;
}

export function portalTime(iso: string, timeZone: string): string {
  return stripBidiMarks(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(
      new Date(iso),
    ),
  );
}

export const portalDateTime = (iso: string, timeZone: string): string =>
  `${portalDate(iso, timeZone)} · ${portalTime(iso, timeZone)}`;

export interface PortalDateParts {
  readonly day: string;
  readonly month: string;
  readonly year: string;
}

export function portalDateParts(iso: string, timeZone: string): PortalDateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return { day: part("day"), month: part("month"), year: part("year") };
}

export function portalWeekday(iso: string, language: SiteLanguage, timeZone: string): string {
  return stripBidiMarks(
    new Intl.DateTimeFormat(LOCALES[language], { weekday: "long", timeZone }).format(new Date(iso)),
  );
}

export function partOfDay(now: Date, timeZone: string): "morning" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(now),
  );

  return hour < 12 ? "morning" : "evening";
}

export type PortalTone = "success" | "warning" | "neutral" | "primary";

export function appointmentTone(status: PortalAppointment["status"]): PortalTone {
  switch (status) {
    case APPOINTMENT_STATUS.COMPLETED:
      return "success";
    case APPOINTMENT_STATUS.NO_SHOW:
      return "warning";
    case APPOINTMENT_STATUS.CANCELLED:
      return "neutral";
    default:
      return "primary";
  }
}

export function treatmentTone(status: PortalTreatment["status"]): PortalTone {
  return status === "done" ? "success" : status === "cancelled" ? "neutral" : "warning";
}

export const portalMoney = (amount: string, currency: string): string =>
  `\u2066${formatWholeMoney(amount)}\u00A0${currencySymbol(currency)}\u2069`;

export const netPrice = (price: string, discount: string): string => subtractMoney(price, discount);

export const portalTab = (value: string | null): PortalTab =>
  PORTAL_TABS.find((tab) => tab === value) ?? "overview";

export const chosenPatient = (account: PortalAccount, value: string | null): string | undefined =>
  account.patients.find((patient) => patient.id === value)?.id ?? account.patients[0]?.id;

const CLOSED: readonly string[] = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.COMPLETED,
];

export function splitAppointments(
  appointments: readonly PortalAppointment[],
  now: Date,
): { upcoming: PortalAppointment[]; past: PortalAppointment[] } {
  const upcoming = appointments
    .filter((item) => new Date(item.startsAt) >= now && !CLOSED.includes(item.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shown = new Set(upcoming.map((item) => item.id));

  return { upcoming, past: appointments.filter((item) => !shown.has(item.id)) };
}

export function regimenText(item: PortalPrescription["items"][number], t: Translate): string {
  const parts = [
    item.perDose != null && t("portal.regimen.perDose", { count: item.perDose }),
    item.timesPerDay != null && t("portal.regimen.timesPerDay", { count: item.timesPerDay }),
    item.days != null && t("portal.regimen.days", { count: item.days }),
    item.dose,
    item.frequency,
    item.duration,
    item.note,
  ];

  return parts
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" · ");
}

export const revealedCount = (wanted: number, total: number): number =>
  total - wanted <= PORTAL_PAGE_TAIL ? total : wanted;
