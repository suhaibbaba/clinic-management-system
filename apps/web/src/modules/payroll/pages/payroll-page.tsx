import type { PayrollLine } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Money,
  PageHeader,
  PersonName,
  StatCard,
  Table,
  usePersonName,
  useToast,
  type Column,
} from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { MonthSwitcher } from "@web/modules/payroll/components/month-switcher";
import { PAY_STATUS_TONES } from "@web/modules/payroll/constants";
import { usePayrollMonth } from "@web/modules/payroll/hooks/use-payroll-month";
import { payrollSource } from "@web/modules/payroll/lib/documents";
import { payStatus } from "@web/modules/payroll/lib/plans";
import { useCloseMonth, usePayroll } from "@web/modules/payroll/queries";
import { DocumentActions } from "@web/shared/components/document-actions";
import { errorToast } from "@web/shared/lib/api-error";
import { formatMonth, moneyText } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";

export function PayrollPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const nameOf = usePersonName();
  const { can } = useSession();
  const currency = useCurrency();
  const monthState = usePayrollMonth();
  const { month, thisMonth } = monthState;

  const payroll = usePayroll(month, true);
  const close = useCloseMonth(month);
  const [closing, setClosing] = useState(false);

  const data = payroll.data;
  const isClosed = Boolean(data?.closedAt);

  const open = (row: PayrollLine): void =>
    void navigate(`/payroll/${row.userId}${month === thisMonth ? "" : `?month=${month}`}`);

  const columns: Column<PayrollLine>[] = [
    {
      key: "person",
      header: "payroll.person",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <PersonName name={row.name} className="font-medium text-ink" />
          <span className="text-meta text-ink-muted">{t(`roles.${row.role}`)}</span>
        </span>
      ),
    },
    {
      key: "plan",
      header: "payroll.payType",
      render: (row) => (
        <Badge tone={row.plan === "salary" ? "neutral" : "info"}>
          {t(`payroll.plan.kinds.${row.plan}`)}
        </Badge>
      ),
    },
    {
      key: "expected",
      header: "payroll.expected",
      align: "numeric",
      render: (row) => (
        <Money amount={row.expected} currency={currency} className="font-semibold" />
      ),
    },
    {
      key: "received",
      header: "payroll.paidAmount",
      align: "numeric",
      hideOnMobile: true,
      render: (row) => <Money amount={row.received} currency={currency} />,
    },
    {
      key: "owed",
      header: "payroll.remaining",
      align: "numeric",
      render: (row) => <Money amount={row.owed} currency={currency} />,
    },
    {
      key: "status",
      header: "payroll.status",
      render: (row) => {
        const status = payStatus(row);

        return <Badge tone={PAY_STATUS_TONES[status]}>{t(`payroll.statuses.${status}`)}</Badge>;
      },
    },
  ];

  return (
    <div data-testid="payroll-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="payroll-header"
        title="payroll.title"
        subtitle="payroll.subtitle"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Icon name="gear" />}
              data-testid="payroll-rules"
              onClick={() => void navigate("/payroll/settings")}
            >
              {t("payroll.rules.title")}
            </Button>
            <DocumentActions
              data-testid="payroll-print"
              label={t("payroll.print")}
              source={data ? payrollSource(month, can("payroll.sendMonth")) : undefined}
            />
          </>
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

      <MonthSwitcher state={monthState} closedAt={data?.closedAt} />

      {data && (
        <div
          className={cn(
            "grid gap-3",
            Number(data.totals.owedToClinic) > 0
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-3",
          )}
        >
          <StatCard
            data-testid="payroll-expected"
            label={t("payroll.expected")}
            value={<Money amount={data.totals.expected} currency={currency} />}
            caption={t("payroll.people", { count: data.lines.length })}
            icon="users"
            tone="primary"
          />
          <StatCard
            data-testid="payroll-received"
            label={t("payroll.paidAmount")}
            value={<Money amount={data.totals.received} currency={currency} />}
            icon="check"
            tone="success"
          />
          <StatCard
            data-testid="payroll-owed"
            label={t("payroll.remaining")}
            value={<Money amount={data.totals.owed} currency={currency} />}
            icon="money"
            tone="warning"
          />
          {Number(data.totals.owedToClinic) > 0 && (
            <StatCard
              data-testid="payroll-owed-to-clinic"
              label={t("payroll.owedToClinic")}
              value={<Money amount={data.totals.owedToClinic} currency={currency} />}
              icon="money"
              tone="primary"
            />
          )}
        </div>
      )}

      <Table
        data-testid="payroll-table"
        columns={columns}
        rows={data?.lines ?? []}
        rowKey={(row) => row.userId}
        onRowClick={open}
        rowLabel={(row) =>
          t("payroll.openPerson", {
            name: nameOf(row.name),
            amount: moneyText(row.expected, currency),
          })
        }
        isLoading={payroll.isPending}
        empty={<EmptyState icon="users" data-testid="payroll-empty" title="payroll.empty" />}
      />

      <ConfirmDialog
        data-testid="payroll-close-confirm"
        open={closing}
        onOpenChange={setClosing}
        title="payroll.closeTitle"
        titleValues={{ month: formatMonth(month) }}
        consequences={[
          t("payroll.closeLocks"),
          t("payroll.closeDraw", {
            amount: moneyText(data?.profit.ownerProfit ?? "0.00", currency),
          }),
          t("payroll.closeStillPay"),
        ]}
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
    </div>
  );
}
