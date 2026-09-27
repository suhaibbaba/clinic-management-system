import { MOVEMENT_TYPES, type StockMovementRow } from "@clinic/shared";
import { subMonths } from "date-fns";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  type Column,
  DateRangePicker,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  Modal,
  PersonName,
  RowMenu,
  Select,
  Table,
  Textarea,
  TotalBadge,
  usePageParams,
  useToast,
} from "@clinic/ui";
import { toIsoDate } from "@web/features/appointments/calendar-time";
import { useSession } from "@web/features/auth/session";
import { useClinic } from "@web/features/clinic/queries";
import { MOVEMENT_TONES, movementLabel } from "@web/features/inventory/display";
import { canReverseMovement } from "@web/features/inventory/permissions";
import { useItemMovements, useReverseMovement } from "@web/features/inventory/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { endOfNextDayIso, moneyText, startOfDayIso, visitMoment } from "@web/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const DEFAULT_MONTHS = 3;

// An absent `from` is the default window; a present but empty one is the reader asking for all of it.
function useRange(): {
  readonly from: string;
  readonly to: string;
  readonly isNarrowed: boolean;
  readonly setRange: (from: string, to: string) => void;
} {
  const [params, setParams] = useSearchParams();
  const rawFrom = params.get("from");
  const from = rawFrom ?? toIsoDate(subMonths(new Date(), DEFAULT_MONTHS));
  const to = params.get("to") ?? "";

  return {
    from,
    to,
    isNarrowed: from !== "" || to !== "",
    setRange: (nextFrom, nextTo) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          next.set("from", nextFrom);
          next.set("to", nextTo);
          next.delete("page");

          return next;
        },
        { replace: true },
      ),
  };
}

export function ItemMovements({ itemId }: { readonly itemId: string }): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const clinic = useClinic();
  const { page, perPage, setPage, setPerPage } = usePageParams();
  const [params, setParams] = useSearchParams();
  const { from, to, isNarrowed, setRange } = useRange();
  const [reversing, setReversing] = useState<StockMovementRow | null>(null);

  const rawType = params.get("type");
  const type = MOVEMENT_TYPES.find((value) => value === rawType);

  const setType = (value: string): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === "") {
          next.delete("type");
        } else {
          next.set("type", value);
        }
        next.delete("page");

        return next;
      },
      { replace: true },
    );

  const query = useMemo(
    () => ({
      page,
      limit: perPage,
      ...(type && { type }),
      ...(startOfDayIso(from) && { from: startOfDayIso(from) as string }),
      ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) as string }),
    }),
    [page, perPage, type, from, to],
  );

  const movements = useItemMovements(itemId, query);
  const mayReverse = canReverseMovement(can);

  const columns: readonly Column<StockMovementRow>[] = [
    {
      key: "date",
      header: "inventory.history.columns.date",
      primary: true,
      render: (row) => <Ltr className="whitespace-nowrap">{visitMoment(row.createdAt)}</Ltr>,
    },
    {
      key: "type",
      header: "inventory.history.columns.type",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={MOVEMENT_TONES[row.type]} data-testid="item-movement-type">
            {t(movementLabel(row.type))}
          </Badge>
          {row.reversesId && (
            <Badge tone="neutral" data-testid="item-movement-reversal">
              {t("inventory.history.reversal")}
            </Badge>
          )}
          {row.reversedAt && (
            <Badge tone="neutral" data-testid="item-movement-reversed">
              {t("inventory.history.reversed")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "inventory.history.columns.quantity",
      align: "numeric",
      render: (row) => {
        const out = row.quantity.startsWith("-");

        return (
          <Ltr
            data-testid="item-movement-quantity"
            className={cn("font-semibold", out ? "text-danger-600" : "text-success-700")}
          >
            {out ? `−${row.quantity.slice(1)}` : `+${row.quantity}`}
          </Ltr>
        );
      },
    },
    {
      key: "after",
      header: "inventory.history.after",
      align: "numeric",
      render: (row) => <Ltr data-testid="item-movement-after">{row.runningQuantity}</Ltr>,
    },
    {
      key: "details",
      header: "inventory.history.columns.details",
      render: (row) => <Details row={row} currency={clinic.data?.currency} />,
    },
    {
      key: "by",
      header: "inventory.history.columns.by",
      hideOnMobile: true,
      render: (row) => (row.createdByName ? <PersonName name={row.createdByName} /> : "—"),
    },
    ...(mayReverse
      ? [
          {
            key: "actions",
            header: "inventory.history.menu",
            actions: true,
            besideTitleOnMobile: true,
            render: (row: StockMovementRow) =>
              row.reversedAt === null && row.reversesId === null ? (
                <RowMenu
                  label={t("inventory.history.menu")}
                  data-testid={`item-movement-${row.id}-menu`}
                >
                  <MenuItem
                    icon="reset"
                    data-testid="item-movement-reverse"
                    onSelect={() => setReversing(row)}
                  >
                    {t("inventory.history.reverse")}
                  </MenuItem>
                </RowMenu>
              ) : null,
          } satisfies Column<StockMovementRow>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-48">
          <label htmlFor="item-movement-type" className="mb-1 block text-label text-ink-muted">
            {t("inventory.history.filterType")}
          </label>
          <Select
            id="item-movement-type"
            data-testid="item-movements-type"
            value={type ?? ""}
            placeholder={t("common.all")}
            onChange={(event) => setType(event.target.value)}
            options={MOVEMENT_TYPES.map((value) => ({
              value,
              label: t(movementLabel(value)),
            }))}
          />
        </div>

        <div className="w-full sm:w-72">
          <label htmlFor="item-movements-range" className="mb-1 block text-label text-ink-muted">
            {t("inventory.history.range")}
          </label>
          <DateRangePicker
            id="item-movements-range"
            data-testid="item-movements-range"
            className="w-full"
            label={t("inventory.history.range")}
            value={{ from, to }}
            onChange={(range) => setRange(range.from, range.to)}
          />
        </div>

        {movements.data !== undefined && (
          <span className="ms-auto flex h-(--control-h) items-center">
            <TotalBadge data-testid="item-movements-count" total={movements.data.total} />
          </span>
        )}
      </div>

      <Table
        data-testid="item-movements"
        columns={columns}
        rows={movements.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={movements.isPending}
        isRefreshing={isRefetching(movements)}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="item-movements-empty"
            title={isNarrowed ? "inventory.history.emptyRange" : "inventory.history.empty"}
          />
        }
        pagination={{
          page,
          totalPages: movements.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <ReverseModal movement={reversing} onClose={() => setReversing(null)} />
    </div>
  );
}

function Details({
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
        // Its own reading order, the page's alignment: `dir="auto"` would push an Arabic reason to
        // the far edge of an English page.
        <span className="text-meta text-ink [unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left">
          {row.reason}
        </span>
      )}
      {!row.patientId && details.length === 0 && !row.reason && "—"}
    </span>
  );
}

// A reversal writes the opposite entry rather than deleting anything, so it asks for the sentence
// that will sit beside it forever.
function ReverseModal({
  movement,
  onClose,
}: {
  readonly movement: StockMovementRow | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reverse = useReverseMovement();
  const [reason, setReason] = useState("");

  const close = (): void => {
    setReason("");
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!movement) {
      return;
    }

    try {
      await reverse.mutateAsync({ id: movement.id, reason: reason.trim() });
      toast.success("inventory.movement.reversed");
      close();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      data-testid="movement-reverse-modal"
      open={movement !== null}
      onOpenChange={(open) => !open && close()}
      title="inventory.history.reverseTitle"
      description={t("inventory.history.reverseDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="movement-reverse-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="reset" />}
            data-testid="movement-reverse-confirm"
            isLoading={reverse.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => void submit()}
          >
            {t("inventory.history.reverse")}
          </Button>
        </>
      }
    >
      <label htmlFor="reverse-reason" className="mb-1.5 block text-label font-medium text-ink">
        {t("inventory.movement.reason")}
      </label>
      <Textarea
        id="reverse-reason"
        data-testid="movement-reverse-reason"
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}
