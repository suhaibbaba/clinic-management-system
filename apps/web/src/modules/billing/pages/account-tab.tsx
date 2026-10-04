import { LEDGER_ENTRY_KIND, type StatementEntry } from "@clinic/shared";
import { dayBounds } from "@web/shared/lib/dates";
import { useMemo, useState, type JSX } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Card,
  DateRangePicker,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  MenuSeparator,
  NotePreview,
  PersonName,
  RowMenu,
  Table,
  type Column,
  useConfirm,
  usePageParams,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { canDeletePayment } from "@web/shared/permissions/billing";
import { receiptSource, statementSource } from "@web/modules/billing/lib/documents";
import { DocumentActions } from "@web/shared/components/document-actions";
import { DocumentMenuItems } from "@web/shared/components/document-menu-items";
import { useDocumentActions } from "@web/shared/hooks/use-document-actions";
import { Money } from "@web/shared/components/money";
import { canRecordPayment, canReversePayment } from "@web/shared/permissions/billing";
import { PaymentModal } from "@web/modules/billing/components/payment-modal";
import { ReversePaymentModal } from "@web/modules/billing/components/reverse-payment-modal";
import { useDeletePayment, usePatientBalance, useStatement } from "@web/modules/billing/queries";
import { useClinic } from "@web/shared/queries/clinic";
import { errorToast } from "@web/shared/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { formatDate } from "@web/shared/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const receiptLabel = (receiptNumber: number | null): string =>
  receiptNumber === null ? "" : `#${String(receiptNumber).padStart(6, "0")}`;

interface AccountTabProps {
  patientId: string;
  recipient?: string | null | undefined;
}

export function AccountTab({ patientId, recipient }: AccountTabProps): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const mayDelete = canDeletePayment(can);
  const deletePayment = useDeletePayment();
  const { confirm, dialog } = useConfirm("statement-confirm-delete");

  const askDelete = (entry: StatementEntry): void =>
    confirm({
      title: "billing.confirmDelete.title",
      titleValues: { receipt: receiptLabel(entry.receiptNumber) },
      consequences: [t("billing.confirmDelete.balance"), t("billing.confirmDelete.kept")],
      onConfirm: async () => {
        try {
          await deletePayment.mutateAsync(entry.id);
          toast.success("billing.paymentDeleted");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  const clinic = useClinic();

  const [params, setParams] = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const setPeriod = (nextFrom: string, nextTo: string): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextFrom) next.set("from", nextFrom);
        else next.delete("from");
        if (nextTo) next.set("to", nextTo);
        else next.delete("to");
        return next;
      },
      { replace: true },
    );
  const [paying, setPaying] = useState(false);
  const [reversing, setReversing] = useState<StatementEntry | null>(null);

  const query = useMemo(
    () => ({
      ...dayBounds(from, to),
    }),
    [from, to],
  );

  const balance = usePatientBalance(patientId);
  const statement = useStatement(patientId, query);

  const currency = clinic.data?.currency;

  const newestFirst = useMemo(
    () => [...(statement.data?.entries ?? [])].reverse(),
    [statement.data?.entries],
  );

  const { page, perPage, setPage, setPerPage } = usePageParams();
  const pageRows = newestFirst.slice((page - 1) * perPage, page * perPage);

  const receipts = useDocumentActions("statement-receipt");
  const maySendReceipts = can("payments.sendReceipt");

  const columns: readonly Column<StatementEntry>[] = [
    {
      key: "date",
      header: "billing.columns.date",
      render: (entry) => <Ltr className="whitespace-nowrap">{formatDate(entry.occurredAt)}</Ltr>,
    },
    {
      key: "description",
      header: "billing.columns.description",
      primary: true,
      render: (entry) => (
        <span
          className={cn("flex flex-wrap items-center gap-2", entry.deletedAt && "text-ink-subtle")}
        >
          {(entry.kind === LEDGER_ENTRY_KIND.CHARGE && entry.description) ||
            t(`billing.kinds.${entry.kind}`)}
          {entry.deletedAt && (
            <Badge tone="danger" data-testid="statement-deleted">
              {t("billing.deleted")}
            </Badge>
          )}
          {entry.isReversal && (
            <Badge tone="warning" data-testid="statement-reversal">
              {t("billing.reversal")}
            </Badge>
          )}
          {entry.receiptNumber !== null && (
            <Ltr className="text-label text-ink-muted">{receiptLabel(entry.receiptNumber)}</Ltr>
          )}
          {entry.deletedAt && (
            <span
              data-testid="statement-deleted-by"
              className="w-full whitespace-nowrap text-meta text-ink-muted"
            >
              {t("billing.deletedBy")} <PersonName name={entry.deletedBy} /> ·{" "}
              <Ltr>{formatDate(entry.deletedAt)}</Ltr>
            </span>
          )}
        </span>
      ),
    },
    {
      key: "note",
      header: "billing.columns.note",
      render: (entry) =>
        entry.note &&
        !(entry.kind === LEDGER_ENTRY_KIND.CHARGE && entry.description === entry.note) ? (
          <NotePreview
            data-testid={`statement-note-${entry.id}`}
            className="w-full max-w-xs"
            text={entry.note}
            title="billing.noteTitle"
          />
        ) : (
          <span className="text-ink-subtle">—</span>
        ),
    },
    {
      key: "charge",
      header: "billing.columns.charge",
      align: "numeric",
      render: (entry) =>
        entry.kind === LEDGER_ENTRY_KIND.CHARGE ? (
          <Money amount={entry.amount} currency={currency} />
        ) : null,
    },
    {
      key: "payment",
      header: "billing.columns.payment",
      align: "numeric",
      render: (entry) =>
        entry.kind === LEDGER_ENTRY_KIND.PAYMENT ? (
          <Money
            amount={entry.amount.replace("-", "")}
            currency={currency}
            className={cn(entry.deletedAt && "text-ink-subtle line-through")}
          />
        ) : null,
    },
    {
      key: "balance",
      header: "billing.columns.balance",
      align: "numeric",
      render: (entry) =>
        entry.deletedAt ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          <Money amount={entry.runningBalance} currency={currency} className="font-medium" />
        ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      besideTitleOnMobile: true,
      render: (entry) =>
        entry.kind === LEDGER_ENTRY_KIND.PAYMENT && !entry.isReversal && !entry.deletedAt ? (
          <RowMenu label={t("billing.entryMenu")} data-testid={`statement-menu-${entry.id}`}>
            <DocumentMenuItems
              actions={receipts}
              source={receiptSource(entry.id, entry.receiptNumber, recipient, maySendReceipts)}
              title={t("billing.receipt")}
              data-testid="statement-receipt"
            />
            <MenuSeparator />
            {canReversePayment(can) && !entry.isReversed && (
              <MenuItem
                icon="reset"
                data-testid="statement-reverse"
                onSelect={() => setReversing(entry)}
              >
                {t("billing.reverse")}
              </MenuItem>
            )}
            {mayDelete && !entry.isReversed && (
              <MenuItem
                icon="trash"
                tone="danger"
                data-testid="statement-delete"
                onSelect={() => askDelete(entry)}
              >
                {t("common.delete")}
              </MenuItem>
            )}
          </RowMenu>
        ) : null,
    },
  ];

  return (
    <div data-testid="account-tab" className="flex flex-col gap-4">
      {dialog}
      {receipts.dialog}
      <Card
        data-testid="account-balance-card"
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <span className="block text-label font-medium text-ink-muted">
            {t("billing.outstanding")}
          </span>
          <Money
            amount={balance.data?.balance ?? "0.00"}
            currency={currency}
            signed
            data-testid="account-balance"
            className="text-kpi font-medium tabular-nums"
          />
          {balance.data?.lastPaymentAt && (
            <span className="mt-1 block text-label text-ink-muted">
              {t("billing.lastPayment")}: <Ltr>{formatDate(balance.data.lastPaymentAt)}</Ltr>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canRecordPayment(can) && (
            <Button
              icon={<Icon name="money" />}
              data-testid="account-record-payment"
              onClick={() => setPaying(true)}
            >
              {t("billing.recordPayment")}
            </Button>
          )}
          <DocumentActions
            data-testid="account-print-statement"
            label={t("billing.printStatement")}
            source={statementSource(
              patientId,
              query,
              recipient,
              can("patient-billing.sendStatement"),
            )}
          />
        </div>
      </Card>

      <div data-testid="account-filters" className="flex flex-wrap items-end gap-3">
        <label className="flex w-full flex-col gap-1 text-label text-ink-muted sm:w-auto">
          {t("billing.period")}
          <DateRangePicker
            id="statement-period"
            data-testid="account-period"
            className="w-full sm:w-64"
            label={t("billing.period")}
            value={{ from, to }}
            onChange={(range) => setPeriod(range.from, range.to)}
          />
        </label>
        {(from || to) && (
          <Button
            icon={<Icon name="reset" />}
            variant="ghost"
            data-testid="account-reset-period"
            onClick={() => setPeriod("", "")}
          >
            {t("billing.clearPeriod")}
          </Button>
        )}
      </div>

      <Table
        data-testid="statement-table"
        columns={columns}
        rows={pageRows}
        rowKey={(entry) => entry.id}
        isLoading={statement.isPending}
        isRefreshing={isRefetching(statement)}
        pagination={{
          page,
          totalPages: Math.ceil(newestFirst.length / perPage),
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
        empty={
          <EmptyState
            icon="money"
            data-testid="statement-empty"
            title="billing.empty"
            hint="billing.emptyHint"
          />
        }
      />

      {statement.data && Number(statement.data.openingBalance) !== 0 && (
        <p data-testid="account-opening-balance" className="text-value text-ink-muted">
          {t("billing.openingBalance")}:{" "}
          <Money amount={statement.data.openingBalance} currency={currency} />
        </p>
      )}

      <PaymentModal
        data-testid="account-payment-modal"
        open={paying}
        onOpenChange={setPaying}
        patientId={patientId}
        balance={balance.data?.balance}
        currency={currency}
      />

      <ReversePaymentModal
        data-testid="account-reverse-modal"
        payment={reversing}
        onOpenChange={(open) => !open && setReversing(null)}
        currency={currency}
      />
    </div>
  );
}
