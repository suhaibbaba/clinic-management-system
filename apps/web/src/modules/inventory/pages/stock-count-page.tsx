import {
  DEFAULT_TIME_ZONE,
  LOOKUP_LIST,
  STOCK_COUNT_STATUS,
  addDays,
  localDate,
  type StockCountLine,
} from "@clinic/shared";
import { useEffect, useState, type JSX, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  type Column,
  DatePicker,
  EmptyState,
  Icon,
  Ltr,
  MoneyInput,
  PageHeader,
  QuantityInput,
  SearchField,
  SegmentedControl,
  StatCard,
  StatRow,
  Table,
  useConfirm,
  usePageParams,
  useTabParam,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate, formatDateTime } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";
import { Money } from "@web/shared/components/money";
import { UnsavedChanges } from "@web/shared/components/unsaved-changes";
import { canCountStock, canPostStockCount, canSeeCosts } from "@web/shared/permissions/inventory";
import { usePostStockCount, useRecordCounts, useStockCount } from "@web/modules/inventory/queries";
import {
  countChanges,
  countProgress,
  lineDifference,
  savedDetails,
  visibleCountLines,
  type SurplusDetails,
} from "@web/modules/inventory/lib/stock-count";
import {
  COUNT_FILTERS,
  EXPIRY_MIN_DAYS_AHEAD,
  type CountFilter,
} from "@web/modules/inventory/constants";

const COUNTED_INPUT = "stock-count-counted";

const focusNextCount = (event: KeyboardEvent<HTMLInputElement>): void => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  const inputs = [
    ...document.querySelectorAll<HTMLInputElement>(`input[data-testid="${COUNTED_INPUT}"]`),
  ];
  inputs[inputs.indexOf(event.currentTarget) + 1]?.focus();
};

export function StockCountPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const toast = useToast();
  const currency = useCurrency();
  const { can } = useSession();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const count = useStockCount(id);
  const record = useRecordCounts();
  const post = usePostStockCount();
  const { confirm, dialog } = useConfirm("stock-count-confirm");
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, SurplusDetails>>({});
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const [filter, setFilter] = useTabParam<CountFilter>("show", COUNT_FILTERS, "all", ["page"]);
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";

  const data = count.data;
  const open = data?.status === STOCK_COUNT_STATUS.OPEN;
  const mayCount = open && canCountStock(can);
  const mayPost = open && canPostStockCount(can);
  const seesCosts = canSeeCosts(can);
  const minExpiry = addDays(localDate(new Date(), DEFAULT_TIME_ZONE), EXPIRY_MIN_DAYS_AHEAD);

  const savedCounts = (): Record<string, string> =>
    Object.fromEntries((data?.lines ?? []).map((line) => [line.itemId, line.counted ?? ""]));

  useEffect(() => {
    if (data) {
      setTyped(savedCounts());
      setDetails(savedDetails(data.lines));
    }
  }, [data]);

  const lines = data?.lines ?? [];
  const changes = countChanges(lines, typed, details, seesCosts);
  const progress = countProgress(lines, typed, open);
  const missing = progress.total - progress.counted;
  const pending = record.isPending || post.isPending;
  const shown = visibleCountLines(lines, typed, open, filter, search);
  const totalPages = Math.max(Math.ceil(shown.length / perPage), 1);
  const rows = shown.slice((page - 1) * perPage, page * perPage);

  const setSearch = (value: string): void => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === "") {
          next.delete("q");
        } else {
          next.set("q", value);
        }
        next.delete("page");

        return next;
      },
      { replace: true },
    );
  };

  const save = async (): Promise<boolean> => {
    if (changes.length === 0) {
      return true;
    }

    try {
      await record.mutateAsync({ id, body: { lines: changes } });
      return true;
    } catch (error) {
      toast.error(...errorToast(error));
      return false;
    }
  };

  const askPost = (): void => {
    if (!data || progress.counted === 0 || pending) {
      return;
    }

    confirm({
      title: "inventory.counts.confirmPost.title",
      titleValues: { number: data.number },
      tone: "primary",
      confirmLabel: "inventory.counts.post",
      consequences: [
        t("inventory.counts.confirmPost.counted", { count: progress.counted }),
        ...(missing > 0 ? [t("inventory.counts.confirmPost.skipped", { count: missing })] : []),
      ],
      onConfirm: async () => {
        if (!(await save())) {
          throw new Error("save failed");
        }
        try {
          await post.mutateAsync(id);
          toast.success("inventory.counts.posted");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  };

  const detailsOf = (line: StockCountLine): SurplusDetails =>
    details[line.itemId] ?? { unitPrice: "", expiryDate: "" };
  const changeDetails = (itemId: string, patch: Partial<SurplusDetails>): void =>
    setDetails((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? { unitPrice: "", expiryDate: "" }), ...patch },
    }));
  const surplus = (line: StockCountLine): boolean =>
    Number(lineDifference(line, typed, open) ?? 0) > 0;
  const showDetails =
    mayCount || lines.some((line) => line.unitPrice != null || line.expiryDate !== null);

  const columns: readonly Column<StockCountLine>[] = [
    {
      key: "item",
      header: "inventory.counts.columns.item",
      primary: true,
      render: (line) => (
        <span className="flex flex-col items-start">
          <bdi className="font-medium text-ink">{line.itemName}</bdi>
          <span className="text-label text-ink-muted">{unitLabel(line.unit)}</span>
        </span>
      ),
    },
    {
      key: "expected",
      header: "inventory.counts.columns.expected",
      align: "numeric",
      render: (line) => <Ltr>{open ? line.current : line.expected}</Ltr>,
    },
    {
      key: "counted",
      header: "inventory.counts.columns.counted",
      align: "numeric",
      render: (line) =>
        mayCount ? (
          <QuantityInput
            aria-label={`${t("inventory.counts.columns.counted")} — ${line.itemName}`}
            data-testid={COUNTED_INPUT}
            placeholder="—"
            className="ms-auto max-w-28"
            enterKeyHint="next"
            value={typed[line.itemId] ?? ""}
            onKeyDown={focusNextCount}
            onChange={(event) =>
              setTyped((current) => ({ ...current, [line.itemId]: event.target.value }))
            }
          />
        ) : (
          <Ltr>{line.counted ?? "—"}</Ltr>
        ),
    },
    {
      key: "difference",
      header: "inventory.counts.columns.difference",
      align: "numeric",
      render: (line) => {
        const difference = lineDifference(line, typed, open);

        return difference === null ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          <Ltr
            className={
              Number(difference) < 0
                ? "font-medium text-danger-600"
                : Number(difference) > 0
                  ? "font-medium text-success-700"
                  : "text-ink-muted"
            }
          >
            {Number(difference) > 0 ? `+${difference}` : difference}
          </Ltr>
        );
      },
    },
    ...(showDetails && seesCosts
      ? [
          {
            key: "unitPrice",
            header: "inventory.counts.columns.unitPrice",
            align: "numeric" as const,
            render: (line: StockCountLine) =>
              mayCount && surplus(line) ? (
                <MoneyInput
                  cents
                  aria-label={`${t("inventory.counts.columns.unitPrice")} — ${line.itemName}`}
                  data-testid="stock-count-price"
                  className="ms-auto max-w-32"
                  currency={currency}
                  placeholder={t("inventory.counts.averageCost")}
                  value={detailsOf(line).unitPrice}
                  onChange={(event) =>
                    changeDetails(line.itemId, { unitPrice: event.target.value })
                  }
                />
              ) : line.unitPrice && surplus(line) ? (
                <Money amount={line.unitPrice} currency={currency} />
              ) : (
                <span className="text-ink-subtle">—</span>
              ),
          } satisfies Column<StockCountLine>,
        ]
      : []),
    ...(showDetails
      ? [
          {
            key: "expiry",
            header: "inventory.counts.columns.expiry",
            render: (line: StockCountLine) =>
              mayCount && surplus(line) ? (
                <DatePicker
                  id={`stock-count-expiry-${line.itemId}`}
                  data-testid="stock-count-expiry"
                  label={`${t("inventory.counts.columns.expiry")} — ${line.itemName}`}
                  className="max-w-44"
                  min={minExpiry}
                  value={detailsOf(line).expiryDate}
                  onChange={(expiryDate) => changeDetails(line.itemId, { expiryDate })}
                />
              ) : line.expiryDate && surplus(line) ? (
                <Ltr>{formatDate(line.expiryDate)}</Ltr>
              ) : (
                <span className="text-ink-subtle">—</span>
              ),
          } satisfies Column<StockCountLine>,
        ]
      : []),
    ...(lines.some((line) => line.value !== undefined) && !open
      ? [
          {
            key: "value",
            header: "inventory.counts.columns.value",
            align: "numeric" as const,
            render: (line: StockCountLine) =>
              line.value ? <Money amount={line.value} currency={currency} /> : "—",
          } satisfies Column<StockCountLine>,
        ]
      : []),
  ];

  return (
    <div data-testid="stock-count-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="stock-count-header"
        title="inventory.counts.title"
        subtitle="inventory.counts.subtitle"
        actions={
          mayPost ? (
            <Button
              icon={<Icon name="check" />}
              data-testid="stock-count-post"
              isLoading={post.isPending}
              aria-disabled={progress.counted === 0 || pending || undefined}
              onClick={askPost}
            >
              {t("inventory.counts.post")}
            </Button>
          ) : undefined
        }
      />

      {data && (
        <div
          data-testid="stock-count-meta"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-label text-ink-muted"
        >
          <Badge
            tone={
              open ? "warning" : data.status === STOCK_COUNT_STATUS.POSTED ? "success" : "neutral"
            }
          >
            {t(`inventory.counts.status.${data.status}`)}
          </Badge>
          <Ltr className="font-medium text-ink">{data.number}</Ltr>
          <span>{t("inventory.counts.snapshot", { at: formatDateTime(data.snapshotAt) })}</span>
        </div>
      )}

      {data && (
        <StatRow data-testid="stock-count-stats" cards={3}>
          <StatCard
            data-testid="stock-count-progress"
            label={t("inventory.counts.columns.counted")}
            icon="clipboard"
            value={<Ltr>{`${progress.counted} / ${progress.total}`}</Ltr>}
            caption={
              missing > 0
                ? t("inventory.counts.missing", { count: missing })
                : t("inventory.counts.allCounted")
            }
          />
          <StatCard
            data-testid="stock-count-shortages"
            label={t("inventory.counts.shortages")}
            tone={progress.shortages > 0 ? "danger" : "neutral"}
            value={progress.shortages}
            caption={t("inventory.counts.differenceCaption", { count: progress.shortages })}
          />
          <StatCard
            data-testid="stock-count-surpluses"
            label={t("inventory.counts.surpluses")}
            tone={progress.surpluses > 0 ? "success" : "neutral"}
            value={progress.surpluses}
            caption={t("inventory.counts.differenceCaption", { count: progress.surpluses })}
          />
        </StatRow>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<CountFilter>
          data-testid="stock-count-filter"
          label={t("inventory.counts.show")}
          value={filter}
          onChange={(value) => {
            resetPage();
            setFilter(value);
          }}
          options={COUNT_FILTERS.map((value) => ({
            value,
            label: t(`inventory.counts.filters.${value}`),
          }))}
        />
        <SearchField
          data-testid="stock-count-search"
          label={t("inventory.counts.search")}
          placeholder={t("inventory.counts.search")}
          className="sm:max-w-(--field-max)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          clearLabel={t("common.clear")}
        />
      </div>

      {dialog}

      <Table
        data-testid="stock-count-table"
        columns={columns}
        rows={rows}
        rowKey={(line) => line.itemId}
        isLoading={count.isPending}
        pagination={{
          page,
          totalPages,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
        empty={
          <EmptyState
            icon="search"
            data-testid="stock-count-empty"
            title="inventory.counts.noMatch"
            hint="inventory.counts.noMatchHint"
          />
        }
      />

      <UnsavedChanges
        data-testid="stock-count-unsaved"
        dirty={mayCount && changes.length > 0}
        count={changes.length}
        saving={record.isPending}
        onSave={() => void save().then((saved) => saved && toast.success("inventory.counts.saved"))}
        onDiscard={() => {
          setTyped(savedCounts());
          setDetails(savedDetails(lines));
        }}
      />
    </div>
  );
}
