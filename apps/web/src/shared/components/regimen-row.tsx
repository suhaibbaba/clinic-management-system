import type { InputHTMLAttributes, JSX, ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Input, QuantityInput } from "@clinic/ui";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "dir"> & {
  readonly ref?: Ref<HTMLInputElement> | undefined;
  readonly "data-testid": string;
};

const CENTRED = "w-18 [&_[data-part=input-control]]:text-center";

function Cell({ caption, children }: { caption: string; children: ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col items-center gap-1">
      {children}
      <span className="text-meta text-ink-muted">{caption}</span>
    </label>
  );
}

function Times(): JSX.Element {
  return (
    <span aria-hidden="true" className="flex h-(--control-h) items-center text-ink-subtle">
      ×
    </span>
  );
}

export function RegimenRow({
  perDose,
  timesPerDay,
  days,
  "data-testid": testId,
}: {
  readonly perDose: FieldProps;
  readonly timesPerDay: FieldProps;
  readonly days: FieldProps;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div dir="ltr" data-testid={testId} className="flex items-start justify-end gap-2">
      <Cell caption={t("prescriptions.perDoseShort")}>
        <Input
          aria-label={t("prescriptions.perDose")}
          inputMode="decimal"
          autoComplete="off"
          className={CENTRED}
          {...perDose}
        />
      </Cell>
      <Times />
      <Cell caption={t("prescriptions.timesPerDayShort")}>
        <QuantityInput
          aria-label={t("prescriptions.timesPerDay")}
          className={CENTRED}
          {...timesPerDay}
        />
      </Cell>
      <Times />
      <Cell caption={t("prescriptions.daysShort")}>
        <QuantityInput aria-label={t("prescriptions.days")} className={CENTRED} {...days} />
      </Cell>
    </div>
  );
}
