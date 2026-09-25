import {
  LEDGER_ENTRY_KIND,
  USER_ROLE,
  type PatientView,
  type StatementEntry,
} from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
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
  NotePreview,
  PersonName,
  RowMenu,
  Table,
  type Column,
  useConfirm,
  usePageParams,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { downloadStatement, openReceipt } from "@web/features/billing/documents";
import { Money } from "@web/features/billing/money";
import { canRecordPayment, canReversePayment } from "@web/features/billing/permissions";
import { PaymentModal } from "@web/features/billing/payment-modal";
import { ReversePaymentModal } from "@web/features/billing/reverse-payment-modal";
import { useDeletePayment, usePatientBalance, useStatement } from "@web/features/billing/queries";
import { useClinic } from "@web/features/clinic/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { endOfNextDayIso, formatDate, shortDate, startOfDayIso } from "@web/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const STATEMENT_PER_PAGE = 10;

const receiptLabel = (receiptNumber: number | null): string =>
  receiptNumber === null ? "" : `#${String(receiptNumber).padStart(6, "0")}`;

interface AccountTabProps {
  patientId: string;
  patient: PatientView | undefined;
}

export function AccountTab({ patientId, patient }: AccountTabProps): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const toast = useToast();
  const isAdmin = user?.role === USER_ROLE.ADMIN;
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
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  const clinic = useClinic();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paying, setPaying] = useState(false);
  const [reversing, setReversing] = useState<StatementEntry | null>(null);

  const query = useMemo(
    () => ({
      ...(startOfDayIso(from) && { from: startOfDayIso(from) as string }),
      ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) as string }),
    }),
    [from, to],
  );

  const balance = usePatientBalance(patientId);
  const statement = useStatement(patientId, query);

  const currency = clinic.data?.currency;
  // The API runs the balance oldest first; the page reads newest first, so each row keeps its own.
  const newestFirst = useMemo(
    () => [...(statement.data?.entries ?? [])].reverse(),
    [statement.data?.entries],
  );
  // The whole statement comes at once, since every line's balance needs the ones before it.
  const { page, perPage, setPage, setPerPage } = usePageParams(STATEMENT_PER_PAGE);
  const pageRows = newestFirst.slice((page - 1) * perPage, page * perPage);

  const print = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const columns: readonly Column<StatementEntry>[] = [
    {
      key: "date",
      header: "billing.columns.date",
      render: (entry) => <Ltr className="whitespace-nowrap">{shortDate(entry.occurredAt)}</Ltr>,
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
              <Ltr>{shortDate(entry.deletedAt)}</Ltr>
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
            // A table sizes a column to its widest line; this caps it at one line's worth.
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
      // The running balance is the point of a statement, so it stays on the
      // card at every width — it is never the column that gets dropped.
      align: "numeric",
      // A deleted payment never touched the balance, so its row shows none.
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
            <MenuItem
              icon="print"
              data-testid="statement-receipt"
              onSelect={() => void print(() => openReceipt(entry.id))}
            >
              {t("billing.receipt")}
            </MenuItem>
            {canReversePayment(can) && !entry.isReversed && (
              <MenuItem
                icon="reset"
                data-testid="statement-reverse"
                onSelect={() => setReversing(entry)}
              >
                {t("billing.reverse")}
              </MenuItem>
            )}
            {isAdmin && !entry.isReversed && (
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
          <Button
            icon={<Icon name="file" />}
            variant="secondary"
            data-testid="account-download-statement"
            onClick={() =>
              void print(() => downloadStatement(patientId, patient?.fileNumber ?? "", query))
            }
          >
            {t("billing.downloadStatement")}
          </Button>
        </div>
      </Card>

      <Card data-testid="account-filters" className="flex flex-wrap items-end gap-3">
        <label className="flex w-full flex-col gap-1 text-label text-ink-muted sm:w-auto">
          {t("billing.period")}
          <DateRangePicker
            id="statement-period"
            data-testid="account-period"
            className="w-full sm:w-64"
            label={t("billing.period")}
            value={{ from, to }}
            onChange={(range) => {
              setFrom(range.from);
              setTo(range.to);
            }}
          />
        </label>
        {(from || to) && (
          <Button
            icon={<Icon name="reset" />}
            variant="ghost"
            data-testid="account-reset-period"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            {t("common.reset")}
          </Button>
        )}
      </Card>

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
