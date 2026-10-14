import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Icon } from "@clinic/ui";
import type { PayrollMonthState } from "@web/modules/payroll/hooks/use-payroll-month";
import { formatDate, formatMonth } from "@web/shared/lib/format";
import { shiftMonth } from "@web/shared/lib/months";

export function MonthSwitcher({
  state,
  closedAt,
}: {
  readonly state: PayrollMonthState;
  readonly closedAt: string | null | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { month, thisMonth, goTo } = state;

  return (
    <div data-testid="payroll-month-switcher" className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        icon={<Icon name="chevron-start" />}
        aria-label={t("payroll.previousMonth")}
        data-testid="payroll-previous"
        onClick={() => goTo(shiftMonth(month, -1))}
      />
      <span data-testid="payroll-month" className="text-section font-semibold text-ink">
        {formatMonth(month)}
      </span>
      <Button
        variant="secondary"
        size="sm"
        icon={<Icon name="chevron-end" />}
        aria-label={t("payroll.nextMonth")}
        data-testid="payroll-next"
        onClick={() => goTo(shiftMonth(month, 1))}
      />
      {month !== thisMonth && (
        <Button
          variant="quiet"
          size="sm"
          data-testid="payroll-this-month"
          onClick={() => goTo(thisMonth)}
        >
          {t("payroll.thisMonth")}
        </Button>
      )}
      {closedAt ? (
        <Badge tone="success" data-testid="payroll-closed">
          {t("payroll.closedOn", { date: formatDate(closedAt) })}
        </Badge>
      ) : (
        <Badge tone="warning" data-testid="payroll-open">
          {t("payroll.open")}
        </Badge>
      )}
    </div>
  );
}
