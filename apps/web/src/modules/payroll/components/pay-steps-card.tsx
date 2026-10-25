import type { DoctorSettlement, PayrollLine } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Card, Money } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { paySteps } from "@web/modules/payroll/lib/pay-steps";
import { moneyText } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

const ROW = "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 px-3 sm:gap-x-4";

export function PayStepsCard({
  line,
  settlement,
}: {
  readonly line: PayrollLine;
  readonly settlement: DoctorSettlement;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const { steps, owed } = paySteps(line, settlement);
  const values = (raw: Readonly<Record<string, string | number>>) =>
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        typeof value === "string" ? moneyText(value, currency) : value,
      ]),
    );

  return (
    <Card data-testid="pay-steps" className="flex flex-col gap-4">
      <h2 className="px-3 text-value font-semibold text-ink">
        {t("payroll.steps.title", { amount: moneyText(owed, currency) })}
      </h2>

      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li
            key={step.key}
            data-testid={`pay-steps-${step.key}`}
            className={cn(ROW, "relative pb-4 last:pb-0")}
          >
            {index < steps.length - 1 && (
              <span aria-hidden className="absolute start-[1.65rem] top-8 bottom-0 w-0.5 bg-line" />
            )}
            <span
              aria-hidden
              className={cn(
                "relative flex size-8 items-center justify-center rounded-pill text-label font-semibold",
                step.ready ? "bg-success-100 text-success-700" : "bg-primary-100 text-primary-700",
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-value font-semibold text-ink">
                {t(`payroll.steps.${step.key}.title`)}
              </p>
              <p className="mt-0.5 text-meta text-ink-muted">
                {t(`payroll.steps.${step.key}.detail`, values(step.values))}
              </p>
              {step.parts && (
                <dl className="mt-2 flex flex-col gap-1 rounded-panel bg-inset px-3 py-2 text-meta">
                  {step.parts.map((part, partIndex) => (
                    <div key={part.key} className="flex justify-between gap-3">
                      <dt className="text-ink-muted">{t(`payroll.steps.parts.${part.key}`)}</dt>
                      <dd className="text-ink">
                        {partIndex > 0 && "− "}
                        <Money amount={part.amount} currency={currency} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <Money
              amount={step.amount}
              currency={currency}
              className={cn(
                "pt-1 text-end text-section font-semibold",
                step.ready ? "text-success-800" : "text-ink",
              )}
            />
          </li>
        ))}
      </ol>

      <div
        data-testid="pay-steps-owed"
        className={cn(
          ROW,
          "items-center rounded-panel border border-success-300 bg-success-50 py-3 text-success-800",
        )}
      >
        <span aria-hidden />
        <span className="text-value font-semibold">{t("payroll.steps.owed")}</span>
        <Money amount={owed} currency={currency} className="text-end text-title font-semibold" />
      </div>
    </Card>
  );
}
