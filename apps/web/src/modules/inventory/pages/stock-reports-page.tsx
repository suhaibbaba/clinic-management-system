import {
  DEFAULT_TIME_ZONE,
  LOOKUP_LIST,
  localDate,
  type ValuationLine,
  type VarianceLine,
  type WasteLine,
} from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  type Column,
  DatePicker,
  DateRangePicker,
  EmptyState,
  Ltr,
  PageHeader,
  SegmentedControl,
  StatCard,
  Table,
  useTabParam,
} from "@clinic/ui";
import { formatDate } from "@web/shared/lib/format";
import { useDateRangeParam } from "@web/shared/hooks/use-date-range-param";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { Money } from "@web/shared/components/money";
import { STOCK_REPORTS, type StockReport } from "@web/modules/inventory/constants";
import { useValuation, useVarianceReport, useWasteReport } from "@web/modules/inventory/queries";

export function StockReportsPage(): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const reasonLabel = useLookupLabels(LOOKUP_LIST.WRITE_OFF_REASON);
  const [report, setReport] = useTabParam<StockReport>("report", STOCK_REPORTS, "valuation");
  const [params, setParams] = useSearchParams();
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
  const date = params.get("date") ?? today;
  const range = useDateRangeParam();
  const period = { from: range.from, to: range.to || today };

  const valuation = useValuation(report === "valuation" ? date : "");
  const waste = useWasteReport(period, report === "waste");
  const variance = useVarianceReport(period, report === "variance");

  const money = (amount: string): JSX.Element => (
    <Money cents amount={amount} currency={currency} />
  );

  const valuationColumns: readonly Column<ValuationLine>[] = [
    {
      key: "item",
      header: "inventory.reports.columns.item",
      primary: true,
      render: (row) => <bdi className="font-medium text-ink">{row.itemName}</bdi>,
    },
    {
      key: "quantity",
      header: "inventory.reports.columns.quantity",
      render: (row) => (
        <span>
          <Ltr>{row.quantity}</Ltr> {unitLabel(row.unit)}
          {Number(row.unknownQuantity) > 0 && (
            <span className="text-label text-ink-muted">
              {" · "}
              {t("inventory.reports.unknownCost", { quantity: row.unknownQuantity })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "value",
      header: "inventory.reports.columns.value",
      align: "numeric",
      render: (row) => money(row.value),
    },
  ];

  const wasteColumns: readonly Column<WasteLine>[] = [
    {
      key: "item",
      header: "inventory.reports.columns.item",
      primary: true,
      render: (row) => <bdi className="font-medium text-ink">{row.itemName}</bdi>,
    },
    {
      key: "reason",
      header: "inventory.reports.columns.reason",
      render: (row) => (row.reasonCode ? reasonLabel(row.reasonCode) : "—"),
    },
    {
      key: "quantity",
      header: "inventory.reports.columns.quantity",
      render: (row) => (
        <span>
          <Ltr>{row.quantity}</Ltr> {unitLabel(row.unit)}
        </span>
      ),
    },
    {
      key: "value",
      header: "inventory.reports.columns.value",
      align: "numeric",
      render: (row) => money(row.value),
    },
  ];

  const varianceColumns: readonly Column<VarianceLine>[] = [
    {
      key: "document",
      header: "inventory.reports.columns.document",
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start">
          <Ltr className="font-medium text-ink">{row.number}</Ltr>
          <bdi className="text-label text-ink-muted">{row.supplierName}</bdi>
        </span>
      ),
    },
    {
      key: "date",
      header: "inventory.reports.columns.date",
      render: (row) => <Ltr>{formatDate(`${row.date}T12:00:00.000Z`)}</Ltr>,
    },
    {
      key: "variance",
      header: "inventory.reports.columns.variance",
      align: "numeric",
      render: (row) => money(row.variance),
    },
  ];

  const total =
    report === "valuation"
      ? valuation.data?.total
      : report === "waste"
        ? waste.data?.total
        : variance.data?.total;

  return (
    <div data-testid="stock-reports-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="stock-reports-header"
        title="inventory.reports.title"
        subtitle="inventory.reports.subtitle"
      />

      <SegmentedControl<StockReport>
        data-testid="stock-reports-kind"
        label={t("inventory.reports.kind")}
        value={report}
        onChange={setReport}
        options={STOCK_REPORTS.map((value) => ({
          value,
          label: t(`inventory.reports.kinds.${value}`),
        }))}
      />

      <div className="flex flex-wrap items-end gap-3">
        {report === "valuation" ? (
          <DatePicker
            id="stock-reports-date"
            data-testid="stock-reports-date"
            className="w-full sm:w-56"
            label={t("inventory.reports.onDate")}
            value={date}
            max={today}
            onChange={(next) =>
              setParams(
                (current) => {
                  const updated = new URLSearchParams(current);
                  updated.set("date", next);
                  return updated;
                },
                { replace: true },
              )
            }
          />
        ) : (
          <DateRangePicker
            id="stock-reports-range"
            data-testid="stock-reports-range"
            className="w-full sm:w-72"
            label={t("inventory.reports.range")}
            value={period}
            onChange={(next) => range.setRange(next.from, next.to)}
          />
        )}
        <StatCard
          data-testid="stock-reports-total"
          label={t(`inventory.reports.totals.${report}`)}
          value={money(total ?? "0.00")}
        />
      </div>

      {report === "valuation" && (
        <Table
          data-testid="stock-reports-valuation"
          columns={valuationColumns}
          rows={valuation.data?.lines ?? []}
          rowKey={(row) => row.itemId}
          isLoading={valuation.isPending}
          empty={<EmptyState icon="package" title="inventory.reports.empty" />}
        />
      )}
      {report === "waste" && (
        <Table
          data-testid="stock-reports-waste"
          columns={wasteColumns}
          rows={waste.data?.lines ?? []}
          rowKey={(row) => `${row.itemId}-${row.reasonCode ?? ""}`}
          isLoading={waste.isPending}
          empty={<EmptyState icon="check" title="inventory.reports.empty" />}
        />
      )}
      {report === "variance" && (
        <Table
          data-testid="stock-reports-variance"
          columns={varianceColumns}
          rows={variance.data?.lines ?? []}
          rowKey={(row) => row.documentId}
          isLoading={variance.isPending}
          empty={<EmptyState icon="check" title="inventory.reports.empty" />}
        />
      )}
    </div>
  );
}
