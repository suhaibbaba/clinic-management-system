import type { PortalAccount } from "@clinic/shared";
import { useSite } from "@web/site/hooks/use-site";
import { portalDate, portalDateTime, portalMoney } from "@web/site/lib/portal";

export interface PortalFormat {
  readonly date: (iso: string) => string;
  readonly dateTime: (iso: string) => string;
  readonly money: (amount: string) => string;
}

export function usePortalFormat(account: PortalAccount): PortalFormat {
  const { language } = useSite();

  return {
    date: (iso) => portalDate(iso, language, account.timeZone),
    dateTime: (iso) => portalDateTime(iso, language, account.timeZone),
    money: (amount) => portalMoney(amount, account.currency),
  };
}
