import type { StockMovementRow } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { moneyText } from "@web/lib/format";

export function MovementDetails({
  row,
  currency,
}: {
  readonly row: StockMovementRow;
  readonly currency: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const details = [
    row.supplierName,
    row.batchNo ? t("inventory.history.batch", { batch: row.batchNo }) : null,
    row.unitPrice
      ? t("inventory.history.unitPrice", { price: moneyText(row.unitPrice, currency) })
      : null,
  ].filter(Boolean);

  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {row.patientId && (
        <Link
          to={`/patients/${row.patientId}`}
          data-testid="item-movement-patient"
          className="truncate font-medium text-primary-700 hover:underline"
        >
          {row.patientName}
          {row.procedureName ? ` · ${row.procedureName}` : ""}
        </Link>
      )}
      {details.length > 0 && <span className="text-meta text-ink">{details.join(" · ")}</span>}
      {row.reason && (
        <span className="text-meta text-ink [unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left">
          {row.reason}
        </span>
      )}
      {!row.patientId && details.length === 0 && !row.reason && "—"}
    </span>
  );
}
