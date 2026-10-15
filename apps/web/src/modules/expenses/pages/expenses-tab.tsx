import { LOOKUP_LIST, type Expense } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Money,
  StatCard,
  Table,
  usePageParams,
  useToast,
  type Column,
} from "@clinic/ui";
import { ExpenseModal } from "@web/modules/expenses/components/expense-modal";
import { useExpenses, useReverseExpense } from "@web/modules/expenses/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { todayIso } from "@web/shared/lib/dates";
import { formatDate } from "@web/shared/lib/format";
import { monthDays } from "@web/shared/lib/months";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function ExpensesTab({
  month,
  closed,
}: {
  readonly month: string;
  readonly closed: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const categoryName = useLookupLabels(LOOKUP_LIST.EXPENSE_CATEGORY);
  const { page, perPage, setPage, setPerPage } = usePageParams();
  const expenses = useExpenses({ month, page, limit: perPage });
  const reverse = useReverseExpense();
  const [adding, setAdding] = useState(false);
  const [reversing, setReversing] = useState<Expense | null>(null);

  const today = todayIso();
  const { from, to } = monthDays(month);
  const defaultDay = to < today ? to : today;

  const columns: Column<Expense>[] = [
    {
      key: "category",
      header: "expenses.category",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{categoryName(row.category)}</span>
          {row.note && <span className="text-meta text-ink-muted">{row.note}</span>}
        </span>
      ),
    },
    {
      key: "date",
      header: "expenses.date",
      render: (row) => formatDate(row.spentOn),
    },
    {
      key: "amount",
      header: "expenses.amount",
      align: "numeric",
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          {(row.reversedAt !== null || row.reversesId !== null) && (
            <Badge tone="danger">{t("payroll.reversed")}</Badge>
          )}
          <Money amount={row.amount} currency={currency} className="font-medium" />
        </span>
      ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) =>
        closed || row.reversedAt !== null || row.reversesId !== null ? null : (
          <Button
            size="sm"
            variant="quiet"
            icon={<Icon name="reset" />}
            data-testid={`expense-reverse-${row.id}`}
            onClick={() => setReversing(row)}
          >
            {t("payroll.reverse")}
          </Button>
        ),
    },
  ];

  return (
    <section data-testid="expenses-tab" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <StatCard
          data-testid="expenses-total"
          label={t("expenses.monthTotal")}
          value={<Money amount={expenses.data?.monthTotal ?? "0.00"} currency={currency} />}
          icon="receipt"
          tone="warning"
        />
        {!closed && from <= today && (
          <Button
            icon={<Icon name="plus" />}
            data-testid="expenses-add"
            onClick={() => setAdding(true)}
          >
            {t("expenses.add")}
          </Button>
        )}
      </div>

      <Table
        data-testid="expenses-table"
        columns={columns}
        rows={expenses.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={expenses.isPending}
        empty={<EmptyState icon="receipt" data-testid="expenses-empty" title="expenses.empty" />}
        pagination={{
          page,
          totalPages: expenses.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <ExpenseModal open={adding} onOpenChange={setAdding} defaultDay={defaultDay} />

      <ConfirmDialog
        data-testid="expense-reverse-confirm"
        open={reversing !== null}
        onOpenChange={(open) => !open && setReversing(null)}
        title="expenses.reverseTitle"
        consequences={[t("payroll.reverseConsequence")]}
        note={{ label: t("payroll.reverseReason") }}
        confirmLabel={t("payroll.reverse")}
        onConfirm={async ({ note }) => {
          if (!reversing) {
            return;
          }

          try {
            await reverse.mutateAsync({ id: reversing.id, reason: note });
            toast.success("payroll.reversedDone");
          } catch (error) {
            toast.error(...errorToast(error));
            throw error;
          }
        }}
      />
    </section>
  );
}
