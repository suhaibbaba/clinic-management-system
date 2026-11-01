import { numberSeparators, type PortalAccount } from "@clinic/shared";
import { useSite } from "@web/site/hooks/use-site";
import {
  portalDate,
  portalDateParts,
  portalDateTime,
  portalMoney,
  portalTime,
  portalWeekday,
  type PortalDateParts,
} from "@web/site/lib/portal";

export interface PortalFormat {
  readonly date: (iso: string) => string;
  readonly dateTime: (iso: string) => string;
  readonly time: (iso: string) => string;
  readonly weekday: (iso: string) => string;
  readonly dateParts: (iso: string) => PortalDateParts;
  readonly money: (amount: string) => string;
}

export function usePortalFormat(account: PortalAccount): PortalFormat {
  const { site, language } = useSite();
  const { clock, numberLocale } = site.clinic.locale;
  const separators = numberSeparators(numberLocale);

  return {
    date: (iso) => portalDate(iso, account.timeZone),
    dateTime: (iso) => portalDateTime(iso, account.timeZone, clock),
    time: (iso) => portalTime(iso, account.timeZone, clock),
    weekday: (iso) => portalWeekday(iso, language, account.timeZone),
    dateParts: (iso) => portalDateParts(iso, account.timeZone),
    money: (amount) => portalMoney(amount, account.currency, separators),
  };
}
