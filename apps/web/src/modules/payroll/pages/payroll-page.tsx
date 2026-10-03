import type { PayrollLine } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  MenuItem,
  Money,
  PageHeader,
  PersonName,
  RowMenu,
  StatCard,
  Table,
  useToast,
  type Column,
} from "@clinic/ui";
import {
  AdjustmentModal,
  type AdjustmentTarget,
} from "@web/modules/payroll/components/adjustment-modal";
import { EmployeeMonthModal } from "@web/modules/payroll/components/employee-month-modal";
import { PayrollPrint } from "@web/modules/payroll/components/payroll-print";
import { SalaryModal } from "@web/modules/payroll/components/salary-modal";
import { SalaryPaymentModal } from "@web/modules/payroll/components/salary-payment-modal";
import { currentMonth, isMonth, shiftMonth } from "@web/modules/payroll/lib/months";
import { useCloseMonth, usePayroll } from "@web/modules/payroll/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { todayIso } from "@web/shared/lib/dates";
import { formatDate, formatMonth, moneyText } from "@web/shared/lib/format";
import { useClinic } from "@web/shared/queries/clinic";
import { PrintRoot } from "@web/shared/components/print-root";
import { usePrint } from "@web/shared/hooks/use-print";

export function PayrollPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const clinic = useClinic();
  const currency = clinic.data?.currency;
  const [params, setParams] = useSearchParams();

  const thisMonth = currentMonth(todayIso());
  const requested = params.get("month") ?? thisMonth;
  const month = isMonth(requested) ? requested : thisMonth;

  const payroll = usePayroll(month, true);
  const close = useCloseMonth(month);

  const [salaryFor, setSalaryFor] = useState<PayrollLine | null>(null);
  const [adjusting, setAdjusting] = useState<AdjustmentTarget | null>(null);
  const [paying, setPaying] = useState<PayrollLine | null>(null);
  const [detailsFor, setDetailsFor] = useState<PayrollLine | null>(null);
  const [closing, setClosing] = useState(false);
  const { printing, print } = usePrint();

  const data = payroll.data;
  const isClosed = data?.closedAt !== null && data?.closedAt !== undefined;

  const goTo = (next: string): void =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set("month", next);
        return updated;
      },
      { replace: true },
    );

  const columns: Column<PayrollLine>[] = [
    {
      key: "employee",
      header: "payroll.employee",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <PersonName name={row.name} className="font-medium text-ink" />
          <span className="text-meta text-ink-muted">
            {t(`roles.${row.role}`)}
            {row.joinedOn && ` · ${t("payroll.joined", { date: formatDate(row.joinedOn) })}`}
          </span>
        </span>
      ),
    },
    {
      key: "base",
      header: "payroll.monthlySalary",
      align: "numeric",
      render: (row) =>
        row.base === "0.00" ? (
          <Badge tone="warning">{t("payroll.noSalary")}</Badge>
        ) : (
          <Money amount={row.base} currency={currency} />
        ),
    },
    {
      key: "extras",
      header: "payroll.extras",
      align: "numeric",
      render: (row) => <Money amount={row.extras} currency={currency} />,
    },
    {
      key: "cuts",
      header: "payroll.cuts",
      align: "numeric",
      render: (row) => <Money amount={row.cuts} currency={currency} />,
    },
    {
      key: "due",
      header: "payroll.due",
      align: "numeric",
      render: (row) => <Money amount={row.due} currency={currency} className="font-medium" />,
    },
    {
      key: "paid",
      header: "payroll.paidAmount",
      align: "numeric",
      render: (row) => <Money amount={row.paid} currency={currency} />,
    },
    {
      key: "remaining",
      header: "payroll.remaining",
      align: "numeric",
      render: (row) => <Money amount={row.remaining} currency={currency} />,
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) => (
        <RowMenu label={t("payroll.menu")} data-testid={`payroll-row-${row.userId}-menu`}>
          <MenuItem icon="money" data-testid="payroll-pay" onSelect={() => setPaying(row)}>
            {t("payroll.pay")}
          </MenuItem>
          {!isClosed && (
            <MenuItem
              icon="plus"
              data-testid="payroll-add-extra"
              onSelect={() => setAdjusting({ line: row, kind: "extra" })}
            >
              {t("payroll.addExtra")}
            </MenuItem>
          )}
          {!isClosed && (
            <MenuItem
              icon="x"
              data-testid="payroll-add-cut"
              onSelect={() => setAdjusting({ line: row, kind: "cut" })}
            >
              {t("payroll.addCut")}
            </MenuItem>
          )}
          {!isClosed && (
            <MenuItem
              icon="edit"
              data-testid="payroll-set-salary"
              onSelect={() => setSalaryFor(row)}
            >
              {t("payroll.setSalary")}
            </MenuItem>
          )}
          <MenuItem icon="list" data-testid="payroll-entries" onSelect={() => setDetailsFor(row)}>
            {t("payroll.entries")}
          </MenuItem>
        </RowMenu>
      ),
    },
  ];

  return (
    <div data-testid="payroll-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="payroll-header"
        title="payroll.title"
        subtitle="payroll.subtitle"
        actions={
          <Button
            variant="secondary"
            icon={<Icon name="print" />}
            data-testid="payroll-print"
            aria-disabled={!data || undefined}
            onClick={() => data && print()}
          >
            {t("payroll.print")}
          </Button>
        }
        primaryAction={
          !isClosed && data ? (
            <Button
              icon={<Icon name="lock" />}
              data-testid="payroll-close"
              aria-disabled={month > thisMonth || undefined}
              onClick={() => month <= thisMonth && setClosing(true)}
            >
              {t("payroll.close")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
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
        {isClosed ? (
          <Badge tone="success" data-testid="payroll-closed">
            {t("payroll.closedOn", { date: formatDate(data?.closedAt ?? "") })}
          </Badge>
        ) : (
          <Badge tone="warning" data-testid="payroll-open">
            {t("payroll.open")}
          </Badge>
        )}
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("payroll.due")}
            value={<Money amount={data.totals.due} currency={currency} />}
            caption={t("payroll.employees", { count: data.lines.length })}
            icon="users"
            tone="primary"
          />
          <StatCard
            label={t("payroll.paidAmount")}
            value={<Money amount={data.totals.paid} currency={currency} />}
            caption={t("payroll.remainingCaption", {
              amount: moneyText(data.totals.remaining, currency),
            })}
            icon="check"
            tone="success"
          />
          <StatCard
            label={t("payroll.visitingShares")}
            value={<Money amount={data.visitingShares} currency={currency} />}
            icon="stethoscope"
            tone="neutral"
          />
          <StatCard
            data-testid="payroll-staff-cost"
            label={t("payroll.staffCost")}
            value={<Money amount={data.staffCost} currency={currency} />}
            caption={t("payroll.staffCostCaption")}
            icon="coins"
            tone="warning"
          />
        </div>
      )}

      <Table
        data-testid="payroll-table"
        columns={columns}
        rows={data?.lines ?? []}
        rowKey={(row) => row.userId}
        isLoading={payroll.isPending}
        empty={<EmptyState icon="users" data-testid="payroll-empty" title="payroll.empty" />}
      />

      <SalaryModal line={salaryFor} month={month} onClose={() => setSalaryFor(null)} />
      <AdjustmentModal target={adjusting} month={month} onClose={() => setAdjusting(null)} />
      <SalaryPaymentModal line={paying} month={month} onClose={() => setPaying(null)} />
      <EmployeeMonthModal
        line={
          detailsFor ? (data?.lines.find((row) => row.userId === detailsFor.userId) ?? null) : null
        }
        closed={isClosed}
        onClose={() => setDetailsFor(null)}
      />

      <ConfirmDialog
        data-testid="payroll-close-confirm"
        open={closing}
        onOpenChange={setClosing}
        title="payroll.closeTitle"
        titleValues={{ month: formatMonth(month) }}
        consequences={[t("payroll.closeLocks"), t("payroll.closeStillPay")]}
        tone="primary"
        confirmLabel={t("payroll.close")}
        onConfirm={async () => {
          try {
            await close.mutateAsync(undefined);
            toast.success("payroll.closedDone");
          } catch (error) {
            toast.error(...errorToast(error));
            throw error;
          }
        }}
      />

      {printing && data && (
        <PrintRoot>
          <PayrollPrint payroll={data} clinic={clinic.data} />
        </PrintRoot>
      )}
    </div>
  );
}
