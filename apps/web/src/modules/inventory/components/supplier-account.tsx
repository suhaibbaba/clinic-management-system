import {
  LOOKUP_LIST,
  SUPPLIER_ENTRY_KIND,
  type SupplierStatementEntry,
  type SupplierSummary,
} from "@clinic/shared";
import { dayBounds } from "@web/shared/lib/dates";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  type Column,
  DateRangePicker,
  EmptyState,
  Icon,
  Ltr,
  StatCard,
  Table,
  usePageParams,
} from "@clinic/ui";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { Money } from "@web/shared/components/money";
import { useClinic } from "@web/shared/queries/clinic";
import { useSession } from "@web/shared/providers/session";
import { canReverseSupplierPayment, canVoidInvoice } from "@web/shared/permissions/inventory";
import { useSupplierStatement } from "@web/modules/inventory/queries";
import { ReverseSupplierPaymentModal } from "@web/modules/inventory/components/reverse-supplier-payment-modal";
import { VoidInvoiceModal } from "@web/modules/inventory/components/void-invoice-modal";
import { formatDate } from "@web/shared/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function SupplierAccount({
  supplier,
}: {
  readonly supplier: Pick<SupplierSummary, "id">;
}): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const methodLabel = useLookupLabels(LOOKUP_LIST.PAYMENT_METHOD);
  const clinic = useClinic();
  const currency = clinic.data?.currency;
  const mayReversePayment = canReverseSupplierPayment(can);
  const mayVoidInvoice = canVoidInvoice(can);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reversing, setReversing] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);

  const isOpen = (row: SupplierStatementEntry): boolean => !row.isReversal && !row.isReversed;
  const rowActions = (row: SupplierStatementEntry): JSX.Element | null => {
    if (!isOpen(row)) {
      return null;
    }

    if (
      (row.kind === SUPPLIER_ENTRY_KIND.PURCHASE || row.kind === SUPPLIER_ENTRY_KIND.CREDIT) &&
      mayVoidInvoice
    ) {
      return (
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="reset" />}
          data-testid="supplier-invoice-void"
          onClick={() => setVoiding(row.id)}
        >
          {t("inventory.suppliers.invoice.void")}
        </Button>
      );
    }

    if (row.kind === SUPPLIER_ENTRY_KIND.PAYMENT && mayReversePayment) {
      return (
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="reset" />}
          data-testid="supplier-statement-reverse"
          onClick={() => setReversing(row.id)}
        >
          {t("inventory.suppliers.payment.reverse")}
        </Button>
      );
    }

    return null;
  };

  const query = useMemo(() => ({ ...dayBounds(from, to) }), [from, to]);
  const statement = useSupplierStatement(supplier.id, query);

  const { page, perPage, setPage, setPerPage } = usePageParams();
  const entries = [...(statement.data?.entries ?? [])].reverse();
  const pageEntries = entries.slice((page - 1) * perPage, page * perPage);

  const describe = (row: SupplierStatementEntry): JSX.Element => {
    if (row.kind === SUPPLIER_ENTRY_KIND.PURCHASE || row.kind === SUPPLIER_ENTRY_KIND.CREDIT) {
      return (
        <span className="flex flex-col items-start">
          <span className="flex items-baseline gap-1.5 font-medium text-ink">
            {t(
              row.kind === SUPPLIER_ENTRY_KIND.CREDIT
                ? "inventory.suppliers.statement.kinds.credit"
                : "inventory.suppliers.statement.kinds.invoice",
            )}
            <Ltr className="text-label text-ink-muted">{row.reference}</Ltr>
          </span>
          {row.note && <span className="text-label text-ink-muted">{row.note}</span>}
        </span>
      );
    }

    if (row.kind === SUPPLIER_ENTRY_KIND.PAYMENT) {
      return (
        <span className="flex flex-col items-start">
          <span className="font-medium text-ink">
            {t("inventory.suppliers.statement.kinds.payment")}
            {row.method ? ` · ${methodLabel(row.method)}` : ""}
          </span>
          {row.note && <span className="text-label text-ink-muted">{row.note}</span>}
        </span>
      );
    }

    return (
      <span className="font-medium text-ink">
        {t("inventory.suppliers.statement.kinds.opening")}
      </span>
    );
  };

  const columns: readonly Column<SupplierStatementEntry>[] = [
    {
      key: "date",
      header: "inventory.suppliers.statement.date",
      render: (row) => <Ltr>{formatDate(row.occurredAt)}</Ltr>,
    },
    {
      key: "description",
      header: "inventory.suppliers.statement.description",
      primary: true,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          {describe(row)}
          {row.isReversal && (
            <Badge tone="neutral" data-testid="supplier-statement-reversal">
              {t("inventory.history.reversal")}
            </Badge>
          )}
          {row.isReversed && !row.isReversal && (
            <Badge tone="neutral" data-testid="supplier-statement-reversed">
              {t("inventory.suppliers.statement.reversed")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: "inventory.suppliers.statement.amount",
      align: "numeric",
      render: (row) =>
        row.amount === null ? (
          "—"
        ) : (
          <Money amount={row.amount} currency={currency} signed className="font-medium" />
        ),
    },
    {
      key: "balance",
      header: "inventory.suppliers.statement.balance",
      align: "numeric",
      hideOnMobile: true,
      render: (row) => <Money amount={row.runningBalance} currency={currency} />,
    },
    ...(mayReversePayment || mayVoidInvoice
      ? [
          {
            key: "actions",
            header: "common.actions",
            actions: true,
            render: rowActions,
          } satisfies Column<SupplierStatementEntry>,
        ]
      : []),
  ];

  return (
    <section data-testid="supplier-account" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          data-testid="supplier-statement-opening"
          label={t("inventory.suppliers.statement.opening")}
          value={<Money amount={statement.data?.openingBalance ?? "0.00"} currency={currency} />}
        />
        <StatCard
          data-testid="supplier-statement-purchased"
          label={t("inventory.suppliers.purchased")}
          value={<Money amount={statement.data?.purchased ?? "0.00"} currency={currency} />}
        />
        <StatCard
          data-testid="supplier-statement-paid"
          label={t("inventory.suppliers.paid")}
          value={<Money amount={statement.data?.paid ?? "0.00"} currency={currency} />}
        />
        <StatCard
          data-testid="supplier-statement-remaining"
          label={t("inventory.suppliers.balance")}
          value={<Money amount={statement.data?.closingBalance ?? "0.00"} currency={currency} />}
        />
      </div>

      <DateRangePicker
        id="supplier-statement-range"
        data-testid="supplier-statement-range"
        className="w-full sm:w-72"
        label={t("inventory.suppliers.statement.range")}
        value={{ from, to }}
        onChange={(range) => {
          setFrom(range.from);
          setTo(range.to);
        }}
      />

      <Table
        data-testid="supplier-statement-table"
        columns={columns}
        rows={pageEntries}
        rowKey={(row) => row.id}
        isLoading={statement.isPending}
        isRefreshing={isRefetching(statement)}
        pagination={{
          page,
          totalPages: Math.ceil(entries.length / perPage),
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="supplier-statement-empty"
            title="inventory.suppliers.statement.empty"
            hint="inventory.suppliers.statement.emptyHint"
          />
        }
      />

      <ReverseSupplierPaymentModal paymentId={reversing} onClose={() => setReversing(null)} />
      <VoidInvoiceModal invoiceId={voiding} onClose={() => setVoiding(null)} />
    </section>
  );
}
