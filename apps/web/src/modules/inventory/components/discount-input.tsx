import { DISCOUNT_KIND, currencySymbol, type DiscountKind } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Input, SegmentedControl } from "@clinic/ui";

export function DiscountInput({
  id,
  kind,
  value,
  currency,
  onKindChange,
  onValueChange,
  "data-testid": testId,
}: {
  readonly id: string;
  readonly kind: DiscountKind;
  readonly value: string;
  readonly currency: string | undefined;
  readonly onKindChange: (kind: DiscountKind) => void;
  readonly onValueChange: (value: string) => void;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();
  const symbol = currencySymbol(currency);

  return (
    <Input
      id={id}
      data-testid={testId}
      dir="ltr"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      className="pe-1 tabular-nums"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      suffix={
        <SegmentedControl<DiscountKind>
          size="sm"
          data-testid={`${testId}-kind`}
          label={t("inventory.purchase.discountKind")}
          value={kind}
          onChange={onKindChange}
          options={[
            { value: DISCOUNT_KIND.PERCENT, label: "%" },
            {
              value: DISCOUNT_KIND.AMOUNT,
              label: symbol === "" ? t("inventory.purchase.amount") : symbol,
            },
          ]}
        />
      }
    />
  );
}
